import { byId, find } from '../dom';
import { serverNow } from '../presence';
import { elapsedMs, formatDuration } from '../roomLogic';
import { getRoom } from '../store';

/**
 * Ticks on its own interval rather than through render(). A full render rebuilds the
 * board, and doing that four times a second would fight every drag on the page.
 */
let ticking: ReturnType<typeof setInterval> | null = null;

function paint(): void {
  const el = find('clock');
  const room = getRoom();
  if (!el || !room) return;
  const ms = elapsedMs(room.meta, serverNow());
  el.textContent = ms == null ? '' : formatDuration(ms);
}

export function mountClock(): void {
  if (!ticking) ticking = setInterval(paint, 250);
}

export function renderClock(show: boolean): void {
  const room = getRoom();
  byId('clock').hidden = !show || !room?.meta.playStartedAt;
  paint();
}
