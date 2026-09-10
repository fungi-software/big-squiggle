import {
  get, onDisconnect, onValue, ref, remove, runTransaction, serverTimestamp, update,
  type Unsubscribe,
} from 'firebase/database';

import { randomCode } from './codes';
import { db } from './firebase';
import { serverNow } from './presence';
import {
  assignSeats, isStale, MAX_PLAYERS, onlineUids,
  type RoomMeta, type RoomSnapshot,
} from './roomLogic';

export class RoomError extends Error {
  constructor(readonly kind: 'not-found' | 'in-progress' | 'full' | 'no-code') {
    super(kind);
  }
}

function roomRef(code: string, path = '') {
  return ref(db, `rooms/${code}${path}`);
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12);
}

export function subscribeRoom(
  code: string,
  cb: (room: RoomSnapshot | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onValue(
    roomRef(code),
    (snap) => {
      const v = snap.val();
      if (!v?.meta) {
        cb(null);
        return;
      }
      cb({
        code,
        meta: v.meta as RoomMeta,
        players: v.players ?? {},
        seats: v.seats ?? {},
        online: v.online ?? {},
        live: v.live ?? {},
      });
    },
    // a denied read reports here and nowhere else; without this the screen just never fills
    (err) => {
      console.error('room subscription failed', err);
      onError?.(err);
      cb(null);
    },
  );
}

/**
 * Claims a code nobody is using. The transaction is what makes two people pressing
 * Create at the same instant safe: the loser sees the room already exists and rolls again.
 */
export async function createRoom(uid: string, name: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const result = await runTransaction(roomRef(code, '/meta'), (current: RoomMeta | null) => {
      if (!isStale(current, serverNow())) return undefined; // taken and alive — abort
      return {
        hostUid: uid,
        status: 'lobby',
        roundId: 1,
        playerCount: 0,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      };
    });

    if (!result.committed) continue;

    // a reclaimed room may still hold the last table's players; the host may only clear
    await update(roomRef(code), { players: null, seats: null, online: null, live: null });
    await addPlayer(code, uid, name);
    return code;
  }
  throw new RoomError('no-code');
}

/**
 * Reads only what a non-member is allowed to: the room's meta, their own player row,
 * and the presence list. Fetching the whole room here would be denied.
 */
export async function joinRoom(code: string, uid: string, name: string): Promise<void> {
  const [metaSnap, mineSnap, onlineSnap] = await Promise.all([
    get(roomRef(code, '/meta')),
    get(roomRef(code, `/players/${uid}`)),
    get(roomRef(code, '/online')),
  ]);

  const meta = metaSnap.val() as RoomMeta | null;
  if (!meta) throw new RoomError('not-found');

  const alreadyIn = mineSnap.exists();
  if (!alreadyIn) {
    if (meta.status !== 'lobby') throw new RoomError('in-progress');
    if (Object.keys(onlineSnap.val() ?? {}).length >= MAX_PLAYERS) throw new RoomError('full');
  }
  await addPlayer(code, uid, name, alreadyIn);
}

async function addPlayer(code: string, uid: string, name: string, keepState = false): Promise<void> {
  const row: Record<string, unknown> = { name: name.slice(0, 24) || 'Player' };
  if (!keepState) {
    row.joinedAt = serverTimestamp();
    row.ready = 0;
    row.briefed = 0;
  }
  await update(roomRef(code, `/players/${uid}`), row);
  await touch(code);
}

export async function leaveRoom(code: string, uid: string, room?: RoomSnapshot | null): Promise<void> {
  await Promise.all([
    remove(roomRef(code, `/players/${uid}`)),
    remove(roomRef(code, `/online/${uid}`)),
    remove(roomRef(code, `/live/${uid}`)),
  ]);

  // the last one out takes the room with them, rather than leaving a husk holding a
  // code nobody can use until it goes stale a day later
  const others = room ? Object.keys(room.players).filter((u) => u !== uid) : ['unknown'];
  if (others.length === 0) {
    // only the host is allowed to; anyone else leaves it for the stale-claim to reap
    await remove(roomRef(code, '/meta')).catch(() => {});
  }
}

export function touch(code: string): Promise<void> {
  return update(roomRef(code, '/meta'), { lastActive: serverTimestamp() });
}

export function setReady(code: string, uid: string, roundId: number, ready: boolean): Promise<void> {
  return update(roomRef(code, `/players/${uid}`), { ready: ready ? roundId : 0 });
}

export function setBriefed(code: string, uid: string, roundId: number): Promise<void> {
  return update(roomRef(code, `/players/${uid}`), { briefed: roundId });
}

/**
 * Every seat in a single multi-path update, so there is no window in which two players
 * hold the same one.
 */
export function startRound(room: RoomSnapshot, roundId: number): Promise<void> {
  const seats = assignSeats(room);
  return update(roomRef(room.code), {
    seats,
    'meta/status': 'briefing',
    'meta/roundId': roundId,
    'meta/playerCount': Object.keys(seats).length,
    'meta/lastActive': serverTimestamp(),
  });
}

export function beginPlay(code: string): Promise<void> {
  return update(roomRef(code, '/meta'), { status: 'playing', lastActive: serverTimestamp() });
}

export function nextRound(room: RoomSnapshot): Promise<void> {
  return startRound(room, room.meta.roundId + 1);
}

/** Sends everyone back to the lobby — the way out when a player drops mid-round. */
export function abandonRound(code: string): Promise<void> {
  return update(roomRef(code, '/meta'), { status: 'lobby', lastActive: serverTimestamp() });
}

/**
 * Promotes the longest-present player when the host disappears. Guarded on the old host
 * still being the one recorded, so several clients racing to do this settle on one.
 */
export async function claimHost(room: RoomSnapshot, uid: string): Promise<void> {
  const was = room.meta.hostUid;
  await runTransaction(roomRef(room.code, '/meta/hostUid'), (current: string | null) =>
    current === was ? uid : undefined,
  );
}

export async function pressHold(code: string, uid: string, correct: boolean): Promise<void> {
  const r = roomRef(code, `/live/${uid}`);
  // clear it server-side too: a closed laptop must not keep holding the button down
  void onDisconnect(r).remove();
  await update(r, { holding: true, correct, heldSince: serverTimestamp() });
}

export function releaseHold(code: string, uid: string): Promise<void> {
  return update(roomRef(code, `/live/${uid}`), { holding: false });
}

/** Whoever sees the win first records it; the guard makes the race between them harmless. */
export async function declareWon(code: string): Promise<void> {
  await runTransaction(roomRef(code, '/meta/status'), (current: string | null) =>
    current === 'playing' ? 'won' : undefined,
  );
}

export function shareLink(code: string): string {
  return `${location.origin}/r/${code}`;
}

export { onlineUids };
