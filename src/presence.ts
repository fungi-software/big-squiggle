import { onDisconnect, onValue, ref, remove, set } from 'firebase/database';

import { db } from './firebase';

let offset = 0;

/**
 * RTDB timestamps are server-side and `Date.now()` is not. Without this correction a
 * laptop with a wrong clock reads every hold as either instant or never-ending.
 */
export function bindServerTime(): () => void {
  return onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    offset = snap.val() ?? 0;
  });
}

export function serverNow(): number {
  return Date.now() + offset;
}

let lastAssert = 0;

/**
 * Re-declares presence. A frozen or backgrounded tab loses its socket, and iOS in
 * particular may not resume it until the page is touched again — so anything that looks
 * like the app waking up calls this, as does noticing our own flag missing from a
 * snapshot. Throttled so a rejected write cannot become a loop.
 */
export function assertPresence(code: string, uid: string): void {
  const now = Date.now();
  if (now - lastAssert < 3000) return;
  lastAssert = now;
  const onlineRef = ref(db, `rooms/${code}/online/${uid}`);
  void onDisconnect(onlineRef).remove();
  void set(onlineRef, true);
}

/**
 * Marks the player present, and — the reason presence lives in RTDB at all — clears the
 * flag from the server side when the connection drops, however it drops.
 */
export function bindPresence(code: string, uid: string): () => void {
  const onlineRef = ref(db, `rooms/${code}/online/${uid}`);
  const liveRef = ref(db, `rooms/${code}/live/${uid}`);

  const stop = onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() !== true) return;
    // re-arm on every reconnect; a stale onDisconnect does not survive one
    void onDisconnect(onlineRef).remove();
    void onDisconnect(liveRef).remove();
    void set(onlineRef, true);
  });

  const wake = () => {
    if (document.visibilityState === 'visible') assertPresence(code, uid);
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);

  return () => {
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('focus', wake);
    window.removeEventListener('online', wake);
    stop();
    void onDisconnect(onlineRef).cancel();
    void onDisconnect(liveRef).cancel();
    void remove(onlineRef);
    void remove(liveRef);
  };
}
