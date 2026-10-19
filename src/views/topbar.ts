import { byId } from '../dom';
import { abandonRound, leaveRoom } from '../room';
import type { RoundGap } from '../roomLogic';
import { exitRoom, getRoom, getUid } from '../store';
import { clearInvite } from './home';

/**
 * Leaving is two taps rather than one. A misclick during a round would strand the rest
 * of the table with a sequence nobody can complete, so it asks first, in place rather
 * than through a modal that would swallow the board behind it.
 */
function ask(open: boolean): void {
  byId('doorBtn').hidden = open;
  byId('leaveAsk').hidden = !open;
  if (open) byId('leaveNo').focus();
}

function leave(rerender: () => void): void {
  const room = getRoom();
  const uid = getUid();
  if (room && uid) void leaveRoom(room.code, uid, room);
  exitRoom();
  clearInvite();
  ask(false);
  rerender();
}

export function mountTopbar(rerender: () => void): void {
  byId('gapLeave').addEventListener('click', () => leave(rerender));

  // regrouping beats walking out: whoever is left can deal a fresh round
  byId('gapLobby').addEventListener('click', () => {
    const room = getRoom();
    if (room) void abandonRound(room);
  });

  byId('doorBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    ask(true);
  });

  byId('leaveNo').addEventListener('click', () => ask(false));

  byId('leaveYes').addEventListener('click', () => leave(rerender));

  // anywhere else, or Escape, means no
  document.addEventListener('click', (e) => {
    if (byId('leaveAsk').hidden) return;
    if (!byId('leaveAsk').contains(e.target as Node)) ask(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !byId('leaveAsk').hidden) ask(false);
  });
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Says who is missing and offers the way out; disappears if they reconnect. */
export function renderGap(gap: RoundGap | null): void {
  byId('roundGap').hidden = !gap;
  if (!gap) return;
  byId('gapText').textContent = gap.left
    ? plural(gap.left, 'A player left the game.', `${gap.left} players left the game.`)
    : plural(gap.away, 'A player lost connection.', `${gap.away} players lost connection.`);
}

export function renderTopbar(inRoom: boolean): void {
  if (!inRoom) ask(false);
  byId('doorBtn').hidden = !inRoom || !byId('leaveAsk').hidden;
  byId('leaveAsk').hidden = byId('leaveAsk').hidden || !inRoom;
}
