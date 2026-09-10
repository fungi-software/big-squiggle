import { byId } from '../dom';
import { leaveRoom } from '../room';
import { exitRoom, getRoom, getUid } from '../store';

/**
 * Leaving is two taps rather than one. A misclick during a round would strand the rest
 * of the table with a sequence nobody can complete, so it asks first — but in place,
 * without a modal that would swallow the board behind it.
 */
function ask(open: boolean): void {
  byId('doorBtn').hidden = open;
  byId('leaveAsk').hidden = !open;
  if (open) byId('leaveNo').focus();
}

export function mountTopbar(rerender: () => void): void {
  byId('doorBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    ask(true);
  });

  byId('leaveNo').addEventListener('click', () => ask(false));

  byId('leaveYes').addEventListener('click', () => {
    const room = getRoom();
    const uid = getUid();
    if (room && uid) void leaveRoom(room.code, uid, room);
    exitRoom();
    ask(false);
    rerender();
  });

  // anywhere else, or Escape, means no
  document.addEventListener('click', (e) => {
    if (byId('leaveAsk').hidden) return;
    if (!byId('leaveAsk').contains(e.target as Node)) ask(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !byId('leaveAsk').hidden) ask(false);
  });
}

export function renderTopbar(inRoom: boolean): void {
  if (!inRoom) ask(false);
  byId('doorBtn').hidden = !inRoom || !byId('leaveAsk').hidden;
  byId('leaveAsk').hidden = byId('leaveAsk').hidden || !inRoom;
}
