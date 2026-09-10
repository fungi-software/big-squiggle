import { fanfare } from '../confetti';
import { byId } from '../dom';
import { svgOf } from '../glyphs';
import { restrictionIcon } from '../icons';
import { attempt, HOLD_MS } from '../live';
import { serverNow } from '../presence';
import { buildPuzzle, plateOrder, type Puzzle } from '../puzzle';
import { RESTRICTIONS } from '../restrictions';
import { declareWon } from '../room';
import {
  elapsedMs, formatDuration, puzzleKey, restrictionForSeat, seatedUids, solveBadge,
  type RoomSnapshot,
} from '../roomLogic';
import { firstOpen, restoreDraft, S, saveDraft } from '../state';

/** The attempt already acted on, so a held button resolves once rather than every frame. */
let settled: number | null = null;
let missUntil = 0;
let ticker: number | null = null;
/** Celebrate on our own reading rather than waiting for the write to come back. */
let localWon: number | null = null;
/** The solve moment as this device computed it, for the clock before the write lands. */
let localSolvedAt: number | undefined;
/** The room record as it stood before this solve, captured before the write moves it. */
let localPrevBest: number | undefined;

function puzzleOf(room: RoomSnapshot): Puzzle {
  return buildPuzzle(puzzleKey(room.code, room.meta.roundId), room.meta.playerCount);
}

/** Whether this player's own sequence matches — computed here, published as one bool. */
export function isMine(room: RoomSnapshot): boolean {
  const answer = puzzleOf(room).answer;
  return answer.every((g, i) => S.draft[i] === g);
}

export function resetAttempt(): void {
  settled = null;
  missUntil = 0;
  localWon = null;
  localSolvedAt = undefined;
  localPrevBest = undefined;
}

export function renderPlay(room: RoomSnapshot, uid: string, rerender: () => void): void {
  const P = puzzleOf(room);
  const seat = room.seats[uid] ?? 0;
  const ri = restrictionForSeat(room, seat);

  byId('roomTag').textContent = room.code;
  byId('restrictIcon').innerHTML = restrictionIcon(ri);
  byId('restrictIcon').setAttribute('title', RESTRICTIONS[ri]!.t);

  const holds: number[] = [];
  for (let i = 0; i < P.slots; i++) {
    if (P.owners[i] === seat) holds.push(i);
  }

  const stamp = P.seed + ':' + seat;
  const fresh = S.builtFor !== stamp;
  if (fresh) {
    S.builtFor = stamp;
    S.plate = plateOrder(P, seat);
    S.draft = restoreDraft(stamp) ?? [];
    resetAttempt();
  }
  if (S.draft.length !== P.slots) S.draft = new Array(P.slots).fill(null);

  S.pinned = {};
  S.pinnedGlyph = {};
  holds.forEach((i) => {
    // your own positions arrive already placed
    S.pinned[i] = true;
    S.draft[i] = P.answer[i]!;
    S.pinnedGlyph[P.answer[i]!] = true;
  });
  if (fresh || S.pinned[S.sel] || S.sel >= P.slots) S.sel = firstOpen();

  byId('slots').innerHTML = S.draft
    .map((g, i) => {
      const pin = !!S.pinned[i];
      const cls = 'slot' + (g != null ? ' filled' : '') + (i === S.sel && !pin ? ' sel' : '') + (pin ? ' pinned' : '');
      const drag = !pin && g != null ? ' draggable="true"' : '';
      const label = 'Position ' + (i + 1) + (pin ? ', yours, fixed' : g != null ? ', filled' : ', empty');
      return (
        '<button class="' + cls + '" data-slot="' + i + '"' + drag + ' aria-label="' + label + '">' +
        '<span class="idx">' + (i + 1) + '</span>' + (g != null ? svgOf(g) : '') +
        '</button>'
      );
    })
    .join('');

  const used: Record<number, boolean> = {};
  S.draft.forEach((g) => {
    if (g != null) used[g] = true;
  });

  const grid = byId('glyphGrid');
  grid.innerHTML = S.plate
    .map((g) => {
      const u = used[g] ? ' used' : '';
      return (
        '<button class="gtile' + u + '" data-glyph="' + g + '"' + (u ? '' : ' draggable="true"') +
        ' aria-label="' + (used[g] ? 'Shape already placed' : 'Place shape') + '"></button>'
      );
    })
    .join('');
  Array.prototype.forEach.call(grid.children, (el: HTMLElement) => {
    el.innerHTML = svgOf(parseInt(el.dataset.glyph!, 10));
  });

  saveDraft(stamp);
  renderAttempt(room, rerender);
  renderWin(room);
}

/**
 * The meter, the pips, and the moment of truth. Runs on a frame loop while the table is
 * charging, because progress is a function of time rather than of anything arriving.
 */
function renderAttempt(room: RoomSnapshot, rerender: () => void): void {
  const over = room.meta.status === 'won' || localWon === room.meta.roundId;
  byId('holdRow').hidden = over;
  if (over) {
    stopTicker();
    return;
  }

  const seated = seatedUids(room);
  const state = attempt(seated, room.live, serverNow());

  // Act on a resolution, then paint this same frame with the result. Re-rendering from
  // inside a render pass instead left the win screen unpainted until the next snapshot.
  if (state.phase === 'resolved' && state.startedAt !== settled) {
    settled = state.startedAt!;
    if (state.won) {
      localWon = room.meta.roundId;
      // the hold finished HOLD_MS after the last press, on the shared server clock
      const solvedAt = state.startedAt! + HOLD_MS;
      localSolvedAt = solvedAt;
      const took = elapsedMs(room.meta, serverNow(), solvedAt) ?? 0;
      localPrevBest = room.meta.bestMs;
      void declareWon(room.code, solvedAt, took, localPrevBest);
      fanfare(byId<HTMLCanvasElement>('confetti'));
      byId('holdRow').hidden = true;
      stopTicker();
      return;
    }
    missUntil = Date.now() + 700;
  }

  byId('holdPips').innerHTML = seated
    .map((_, i) => `<i class="pip${i < state.down ? ' on' : ''}"></i>`)
    .join('');

  const pill = byId('holdBtn');
  const spent = state.phase === 'resolved' && state.startedAt === settled;
  byId('holdFill').style.transform = `scaleX(${spent ? 0 : state.progress})`;
  pill.classList.toggle('charging', state.phase === 'charging');
  // the sweep covers the tick past the midpoint, so it has to flip to stay readable
  pill.classList.toggle('past-half', state.phase === 'charging' && state.progress >= 0.5);
  pill.classList.toggle('miss', Date.now() < missUntil);

  if (state.phase === 'charging' || Date.now() < missUntil) startTicker(rerender);
  else stopTicker();
}

function startTicker(rerender: () => void): void {
  if (ticker != null) return;
  const step = () => {
    ticker = null;
    rerender();
  };
  ticker = requestAnimationFrame(step);
}

function stopTicker(): void {
  if (ticker != null) {
    cancelAnimationFrame(ticker);
    ticker = null;
  }
}

function renderWin(room: RoomSnapshot): void {
  const host = byId('verdictSlot');
  const over = room.meta.status === 'won' || localWon === room.meta.roundId;
  const mode = over ? `won:${room.meta.roundId}:${room.meta.solvedAt ?? 0}:${room.meta.bestMs ?? 0}` : 'idle';
  if (host.dataset.mode === mode) return;
  host.dataset.mode = mode;

  if (mode === 'idle') {
    host.innerHTML = '';
    return;
  }

  const badge = solveBadge(
    elapsedMs(room.meta, serverNow(), localSolvedAt),
    localWon === room.meta.roundId,
    localPrevBest,
    room.meta.bestMs,
  );
  const clock =
    badge.time == null
      ? ''
      : '<div class="solvetime' + (badge.beat ? ' best' : '') + '">' +
        '<span class="lbl">Completed in</span> ' + formatDuration(badge.time) + '</div>' +
        (badge.compareTo
          ? '<div class="prevbest">' + (badge.beat ? 'beat ' : 'best ') + formatDuration(badge.compareTo) + '</div>'
          : '');

  host.innerHTML =
    '<div class="verdict win"><h3>That is the squiggle!</h3>' + clock +
    '<div class="btnrow"><button class="btn primary" data-act="newround">Play again</button></div>' +
    '</div>';
}
