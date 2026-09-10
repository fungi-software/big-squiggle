import type { Unsubscribe } from 'firebase/database';

import { assertPresence, bindPresence } from './presence';
import { beginPlay, claimHost, subscribeRoom } from './room';
import { allBriefed, isHost, nextHost, type RoomSnapshot } from './roomLogic';
import { rememberRoom } from './session';

let uid: string | null = null;
let room: RoomSnapshot | null = null;
let unsubRoom: Unsubscribe | null = null;
let unbindPresence: (() => void) | null = null;
let notify: () => void = () => {};
let hostWatch: ReturnType<typeof setTimeout> | null = null;

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

export function enterRoom(code: string): void {
  if (!uid) throw new Error('not signed in');
  exitRoom();
  rememberRoom(code);
  unbindPresence = bindPresence(code, uid);
  unsubRoom = subscribeRoom(code, (next) => {
    room = next;
    if (next) react(next);
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
}

/**
 * The two transitions nobody presses a button for. Both are idempotent and guarded on
 * the state that triggered them, so every client running this at once is harmless.
 */
function react(next: RoomSnapshot): void {
  if (!uid) return;

  // we are in the room but the room does not think we are here, so say so again
  if (next.players[uid] && !next.online[uid]) assertPresence(next.code, uid);

  const hostAway = nextHost(next) === uid && next.meta.hostUid !== uid;
  if (hostAway) {
    // wait out the grace period before taking over. A host who is merely reloading
    // comes back within it, and the room should still be theirs when they do
    if (!hostWatch) {
      hostWatch = setTimeout(() => {
        hostWatch = null;
        const now = room;
        if (now && uid && nextHost(now) === uid && now.meta.hostUid !== uid) {
          void claimHost(now, uid);
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
