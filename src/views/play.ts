import { fanfare } from '../confetti';
import { byId } from '../dom';
import { svgOf } from '../glyphs';
import { restrictionIcon } from '../icons';
import { attempt } from '../live';
import { serverNow } from '../presence';
import { buildPuzzle, plateOrder, type Puzzle } from '../puzzle';
import { RESTRICTIONS } from '../restrictions';
import { declareWon } from '../room';
import { isHost, puzzleKey, restrictionIndex, seatedUids, type RoomSnapshot } from '../roomLogic';
import { firstOpen, restoreDraft, S, saveDraft } from '../state';

/** The attempt already acted on, so a held button resolves once rather than every frame. */
let settled: number | null = null;
let missUntil = 0;
let ticker: number | null = null;
/** Celebrate on our own reading rather than waiting for the write to come back. */
let localWon: number | null = null;

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
}

export function renderPlay(room: RoomSnapshot, uid: string, rerender: () => void): void {
  const P = puzzleOf(room);
  const seat = room.seats[uid] ?? 0;
  const ri = restrictionIndex(seat);

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
  renderWin(room, uid, P);
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
      void declareWon(room.code);
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

function renderWin(room: RoomSnapshot, uid: string, P: Puzzle): void {
  const host = byId('verdictSlot');
  const over = room.meta.status === 'won' || localWon === room.meta.roundId;
  const mode = over ? 'won:' + room.meta.roundId : 'idle';
  if (host.dataset.mode === mode) return;
  host.dataset.mode = mode;

  if (mode === 'idle') {
    host.innerHTML = '';
    return;
  }

  host.innerHTML =
    '<div class="verdict win"><h3>That is the squiggle!</h3>' +
    '<div class="answerrow">' +
    P.answer.map((g, i) => '<div style="animation-delay:' + i * 60 + 'ms">' + svgOf(g) + '</div>').join('') +
    '</div>' +
    (isHost(room, uid)
      ? '<div class="btnrow"><button class="btn primary" data-act="newround">Next round</button></div>'
      : '') +
    '</div>';
}
