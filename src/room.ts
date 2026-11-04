import {
  get, onDisconnect, onValue, ref, remove, runTransaction, serverTimestamp, set, update,
  type Unsubscribe,
} from 'firebase/database';

import { track, type HoldRelease } from './analytics';
import { randomCode } from './codes';
import type { GameMode } from './restrictions';
import { db } from './firebase';
import { serverNow } from './presence';
import {
  assignSeats, deriveScreen, gameMode, isNewBest, isStale, MAX_PLAYERS, onlineUids,
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
      if (!isStale(current, serverNow())) return undefined; // taken and alive, so abort
      return {
        hostUid: uid,
        status: 'lobby',
        mode: 'call',
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
    track('room_created', { room_code: code, attempts: attempt });
    return code;
  }
  throw new RoomError('no-code');
}

/**
 * Reads only what a non-member is allowed to: the room's meta, their own player row,
 * and the presence list. Fetching the whole room here would be denied.
 */
export async function joinRoom(
  code: string,
  uid: string,
  name: string,
  via: 'invite' | 'code',
): Promise<void> {
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
  track('room_joined', { room_code: code, via, already_in: alreadyIn });
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
  if (room) {
    track('room_left', { screen: deriveScreen(room, uid), rounds_played: roundsPlayed(room.meta) });
  }
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

/** Set in the lobby, where the table can see which game they are agreeing to. */
export function setMode(code: string, mode: GameMode): Promise<void> {
  track('mode_changed', { mode });
  return update(roomRef(code, '/meta'), { mode, lastActive: serverTimestamp() });
}

export function setReady(code: string, uid: string, roundId: number, ready: boolean): Promise<void> {
  track('player_ready', { ready });
  return update(roomRef(code, `/players/${uid}`), { ready: ready ? roundId : 0 });
}

export function setBriefed(code: string, uid: string, roundId: number, msOnBrief: number): Promise<void> {
  track('brief_acknowledged', { ms_on_brief: msOnBrief });
  return update(roomRef(code, `/players/${uid}`), { briefed: roundId });
}

/** Rounds that reached a verdict: the current one counts once it is won. */
export function roundsPlayed(meta: RoomMeta): number {
  return meta.roundId - (meta.status === 'won' ? 0 : 1);
}

/**
 * Every seat in a single multi-path update, so there is no window in which two players
 * hold the same one.
 */
export function startRound(room: RoomSnapshot, roundId: number): Promise<void> {
  const seats = assignSeats(room);
  track('round_started', { player_count: Object.keys(seats).length, mode: gameMode(room), round_id: roundId });
  return update(roomRef(room.code), {
    seats,
    'meta/status': 'briefing',
    'meta/roundId': roundId,
    'meta/playerCount': Object.keys(seats).length,
    'meta/playStartedAt': null,
    'meta/solvedAt': null,
    'meta/lastActive': serverTimestamp(),
  });
}

export function beginPlay(code: string): Promise<void> {
  return update(roomRef(code, '/meta'), {
    status: 'playing',
    playStartedAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  });
}

export function nextRound(room: RoomSnapshot): Promise<void> {
  track('new_round', { rounds_so_far: roundsPlayed(room.meta) });
  return startRound(room, room.meta.roundId + 1);
}

/**
 * Sends everyone back to the lobby: the way out when a player drops mid-round.
 *
 * The round number moves on even though nothing was solved, for two reasons: the next
 * start deals a fresh puzzle rather than the one they half-saw, and the round-scoped
 * ready flags stop matching, so the table has to agree to play again rather than the
 * button arming itself.
 */
export function abandonRound(room: RoomSnapshot): Promise<void> {
  track('round_abandoned', {
    round_id: room.meta.roundId,
    seated: Object.keys(room.seats).length,
    player_count: room.meta.playerCount,
  });
  return update(roomRef(room.code, '/meta'), {
    status: 'lobby',
    roundId: room.meta.roundId + 1,
    playStartedAt: null,
    solvedAt: null,
    lastActive: serverTimestamp(),
  });
}

/**
 * Promotes the longest-present player when the host disappears. Guarded on the old host
 * still being the one recorded, so several clients racing to do this settle on one.
 */
export async function claimHost(room: RoomSnapshot, uid: string): Promise<boolean> {
  const was = room.meta.hostUid;
  const result = await runTransaction(roomRef(room.code, '/meta/hostUid'), (current: string | null) =>
    current === was ? uid : undefined,
  );
  return result.committed;
}

/** When this device's press began, so the release can say how long it lasted. */
let holdBegan: number | null = null;

function othersDown(room: RoomSnapshot, uid: string): number {
  return Object.keys(room.live).filter((u) => u !== uid && room.live[u]?.holding).length;
}

export async function pressHold(room: RoomSnapshot, uid: string, correct: boolean): Promise<void> {
  holdBegan = Date.now();
  track('hold_started', { others_down: othersDown(room, uid) });
  const r = roomRef(room.code, `/live/${uid}`);
  // clear it server-side too: a closed laptop must not keep holding the button down
  void onDisconnect(r).remove();
  await update(r, { holding: true, correct, heldSince: serverTimestamp() });
}

export function releaseHold(room: RoomSnapshot, uid: string, reason: HoldRelease): Promise<void> {
  // pointer and focus listeners fire whether or not a press was in progress
  if (holdBegan != null) {
    track('hold_released', {
      held_ms: Date.now() - holdBegan,
      others_down: othersDown(room, uid),
      released_by: reason,
    });
    holdBegan = null;
  }
  return update(roomRef(room.code, `/live/${uid}`), { holding: false });
}

/**
 * Whoever sees the win first records it; the guards make the race between them harmless.
 *
 * `solvedAt` is the moment the hold completed, which every device computes to the same
 * server-clock value. Using a fresh timestamp here would instead record whichever
 * client's write landed first, and the table would disagree about its own time.
 */
export async function declareWon(
  room: RoomSnapshot,
  solvedAt: number,
  elapsedMs: number,
  prevBest: number | undefined,
): Promise<void> {
  const code = room.code;
  track('round_won', {
    elapsed_ms: elapsedMs,
    is_new_best: isNewBest(elapsedMs, prevBest),
    prev_best_ms: prevBest,
    round_id: room.meta.roundId,
    player_count: room.meta.playerCount,
    mode: gameMode(room),
  });
  await runTransaction(roomRef(code, '/meta/status'), (current: string | null) =>
    current === 'playing' ? 'won' : undefined,
  );
  // rules let this land only while unset, so the first writer wins and the rest are denied
  await set(roomRef(code, '/meta/solvedAt'), solvedAt).catch(() => {});
  if (isNewBest(elapsedMs, prevBest)) {
    await set(roomRef(code, '/meta/bestMs'), elapsedMs).catch(() => {});
  }
}

export function shareLink(code: string): string {
  return `${location.origin}/r/${code}`;
}

export { onlineUids };
