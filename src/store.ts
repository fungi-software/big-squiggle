import type { Unsubscribe } from 'firebase/database';

import {
  describeRoom, enterRoomContext, leaveRoomContext, noteFirstMode, setRoomContext, track,
  type RoomContext, type RoomGroup,
} from './analytics';
import { assertPresence, bindPresence } from './presence';
import { beginPlay, claimHost, subscribeRoom } from './room';
import { allBriefed, gameMode, isHost, nextHost, roundsPlayed, type RoomSnapshot } from './roomLogic';
import { rememberRoom } from './session';

let uid: string | null = null;
let room: RoomSnapshot | null = null;
let unsubRoom: Unsubscribe | null = null;
let unbindPresence: (() => void) | null = null;
let notify: () => void = () => {};
let hostWatch: ReturnType<typeof setTimeout> | null = null;
let lastGroup = '';

/** A refresh drops presence for a moment; only a real departure should move the room. */
const HOST_GRACE_MS = 6000;

export function setUid(value: string): void {
  uid = value;
}

export function getUid(): string | null {
  return uid;
}

export function getRoom(): RoomSnapshot | null {
  return room;
}

export function onChange(cb: () => void): void {
  notify = cb;
}

export function enterRoom(code: string, via?: 'rejoin'): void {
  if (!uid) throw new Error('not signed in');
  exitRoom();
  rememberRoom(code);
  enterRoomContext(code);
  if (via === 'rejoin') track('room_joined', { room_code: code, via, already_in: true });
  unbindPresence = bindPresence(code, uid);
  unsubRoom = subscribeRoom(code, (next) => {
    const prev = room;
    room = next;
    if (next) {
      react(next);
      observe(prev, next);
    }
    notify();
  }, () => {
    exitRoom();
    notify();
  });
}

export function exitRoom(): void {
  if (hostWatch) {
    clearTimeout(hostWatch);
    hostWatch = null;
  }
  unsubRoom?.();
  unbindPresence?.();
  unsubRoom = null;
  unbindPresence = null;
  room = null;
  rememberRoom('');
  lastGroup = '';
  leaveRoomContext();
}

/** Keeps the analytics context in step with the room; captures nothing the game acts on. */
function observe(prev: RoomSnapshot | null, next: RoomSnapshot): void {
  if (!uid) return;
  if (!prev) noteFirstMode(gameMode(next));

  // registering is a local write, so every snapshot refreshes it; a group identify is an
  // event, so that one goes out only when its record changes
  const context: RoomContext = {
    room_code: next.code,
    mode: gameMode(next),
    player_count: next.meta.playerCount,
    round_id: next.meta.roundId,
    is_host: isHost(next, uid),
    seat: next.seats[uid] ?? null,
  };
  setRoomContext(context);

  const group: RoomGroup = {
    mode: gameMode(next),
    player_count: next.meta.playerCount,
    created_at: next.meta.createdAt ? new Date(next.meta.createdAt).toISOString() : undefined,
    rounds_played: roundsPlayed(next.meta),
  };
  if (next.meta.bestMs) group.best_ms = next.meta.bestMs;
  const groupKey = JSON.stringify(group);
  if (groupKey !== lastGroup) {
    lastGroup = groupKey;
    describeRoom(next.code, group);
  }

  if (prev && prev.meta.status !== 'playing' && next.meta.status === 'playing') {
    track('play_began', { round_id: next.meta.roundId });
  }
}

/**
 * The two transitions nobody presses a button for. Both are idempotent and guarded on
 * the state that triggered them, so every client running this at once is harmless.
 */
function react(next: RoomSnapshot): void {
  if (!uid) return;

  // we are in the room but the room does not think we are here, so say so again
  if (next.players[uid] && !next.online[uid]) assertPresence(next.code, uid, 'snapshot');

  const hostAway = nextHost(next) === uid && next.meta.hostUid !== uid;
  if (hostAway) {
    // wait out the grace period before taking over. A host who is merely reloading
    // comes back within it, and the room should still be theirs when they do
    if (!hostWatch) {
      hostWatch = setTimeout(() => {
        hostWatch = null;
        const now = room;
        if (now && uid && nextHost(now) === uid && now.meta.hostUid !== uid) {
          void claimHost(now, uid).then((claimed) => {
            if (claimed) track('host_claimed', { grace_ms: HOST_GRACE_MS });
          });
        }
      }, HOST_GRACE_MS);
    }
  } else if (hostWatch) {
    clearTimeout(hostWatch);
    hostWatch = null;
  }

  if (isHost(next, uid) && next.meta.status === 'briefing' && allBriefed(next)) {
    void beginPlay(next.code);
  }
}
