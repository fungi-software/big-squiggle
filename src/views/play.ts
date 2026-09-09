import { fanfare } from '../confetti';
import { byId, find } from '../dom';
import { svgOf } from '../glyphs';
import { restrictionIcon } from '../icons';
import { buildPuzzle, plateOrder, type Puzzle } from '../puzzle';
import { RESTRICTIONS } from '../restrictions';
import { puzzleKey, restrictionIndex, type RoomSnapshot } from '../roomLogic';
import { armCheck, cancelCheck, firstOpen, restoreDraft, S, saveDraft } from '../state';

export interface BoardContext {
  puzzle: Puzzle;
  seat: number;
  roundId: number;
}

export function boardContext(room: RoomSnapshot, uid: string): BoardContext {
  return {
    puzzle: buildPuzzle(puzzleKey(room.code, room.meta.roundId), room.meta.playerCount),
    seat: room.seats[uid] ?? 0,
    roundId: room.meta.roundId,
  };
}

export function renderPlay(room: RoomSnapshot, uid: string, rerender: () => void): void {
  const { puzzle: P, seat, roundId } = boardContext(room, uid);
  const ri = restrictionIndex(seat, roundId);

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
  }
  if (S.draft.length !== P.slots) {
    S.draft = new Array(P.slots).fill(null);
  }

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

  // any change to the sequence stops a running check and drops the last result
  const sig = S.draft.join(',');
  if (sig !== S.lastSig) {
    S.lastSig = sig;
    cancelCheck();
    S.graded = null;
  }
  const full = !S.draft.some((g) => g == null);
  if (full && !S.graded) {
    armCheck(P.answer, (left) => {
      const n = find('cdNum');
      if (n) n.textContent = String(left);
    }, rerender);
  } else if (!full) {
    cancelCheck();
  }

  renderVerdict(P);
}

function renderVerdict(P: Puzzle): void {
  const host = byId('verdictSlot');
  const mode = S.graded ? 'done:' + S.graded.won : S.checking ? 'checking' : 'idle';

  if (host.dataset.mode === mode) {
    // never restart the animation on a re-render
    if (mode === 'checking') {
      const n = find('cdNum');
      if (n) n.textContent = String(Math.max(0, S.left));
    }
    return;
  }
  host.dataset.mode = mode;

  if (mode === 'idle') {
    host.innerHTML = '';
    return;
  }

  if (mode === 'checking') {
    host.innerHTML =
      '<div class="verdict checking">' +
      '<div class="cdwrap"><svg class="cdring" viewBox="0 0 60 60" aria-hidden="true">' +
      '<circle class="track" cx="30" cy="30" r="26"/><circle class="fill" cx="30" cy="30" r="26"/></svg>' +
      '<div class="cdnum" id="cdNum">' + Math.max(0, S.left) + '</div></div>' +
      '<h3>Checking your sequence</h3></div>';
    return;
  }

  if (S.graded!.won) fanfare(byId<HTMLCanvasElement>('confetti'));

  host.innerHTML = S.graded!.won
    ? '<div class="verdict win"><h3>That is the squiggle!</h3>' +
      '<div class="answerrow">' +
      P.answer.map((g, i) => '<div style="animation-delay:' + i * 60 + 'ms">' + svgOf(g) + '</div>').join('') +
      '</div>' +
      '<div class="btnrow"><button class="btn primary" data-act="newround">Next round</button></div></div>'
    : '<div class="verdict miss"><h3>Not the sequence.</h3></div>';
}
