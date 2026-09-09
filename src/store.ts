import type { Unsubscribe } from 'firebase/database';

import { bindPresence } from './presence';
import { beginPlay, claimHost, subscribeRoom } from './room';
import { allBriefed, isHost, nextHost, type RoomSnapshot } from './roomLogic';
import { rememberRoom } from './session';

let uid: string | null = null;
let room: RoomSnapshot | null = null;
let unsubRoom: Unsubscribe | null = null;
let unbindPresence: (() => void) | null = null;
let notify: () => void = () => {};

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

  if (nextHost(next) === uid && next.meta.hostUid !== uid) {
    void claimHost(next, uid);
    return;
  }
  if (isHost(next, uid) && next.meta.status === 'briefing' && allBriefed(next)) {
    void beginPlay(next.code);
  }
}
