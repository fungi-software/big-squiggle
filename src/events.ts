import { byId } from './dom';
import { nextRound, pressHold, releaseHold } from './room';
import { firstOpen, place, resetBoard, S } from './state';
import { getRoom, getUid } from './store';
import { isMine, resetAttempt } from './views/play';

type DragSource = { kind: 'glyph'; value: number } | { kind: 'slot'; value: number };

let drag: DragSource | null = null;
let dragHot: HTMLElement | null = null;

function clearHot(): void {
  if (dragHot) {
    dragHot.classList.remove('drag');
    dragHot = null;
  }
}

export function mountBoard(rerender: () => void): void {
  const slots = byId('slots');
  const glyphGrid = byId('glyphGrid');

  slots.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    if (!b) return;
    const i = parseInt(b.dataset.slot!, 10);
    if (S.pinned[i]) return;
    if (S.draft[i] != null && S.sel === i) S.draft[i] = null;
    else S.sel = i;
    rerender();
  });

  glyphGrid.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-glyph]');
    if (!b) return;
    if (!place(S.sel, parseInt(b.dataset.glyph!, 10))) return;
    S.sel = firstOpen();
    rerender();
  });

  glyphGrid.addEventListener('dragstart', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-glyph]');
    const g = b ? parseInt(b.dataset.glyph!, 10) : -1;
    if (!b || S.draft.indexOf(g) >= 0) {
      e.preventDefault();
      return;
    }
    drag = { kind: 'glyph', value: g };
    e.dataTransfer!.effectAllowed = 'copy';
    try {
      e.dataTransfer!.setData('text/plain', 'g' + g);
    } catch {
      /* some browsers refuse setData outside a user gesture */
    }
  });

  glyphGrid.addEventListener('dragover', (e) => {
    if (drag && drag.kind === 'slot') {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
    }
  });

  // drag a placed shape back out
  glyphGrid.addEventListener('drop', (e) => {
    if (!drag || drag.kind !== 'slot') return;
    e.preventDefault();
    if (!S.pinned[drag.value]) S.draft[drag.value] = null;
    drag = null;
    clearHot();
    S.sel = firstOpen();
    rerender();
  });

  slots.addEventListener('dragstart', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    if (!b) {
      e.preventDefault();
      return;
    }
    const i = parseInt(b.dataset.slot!, 10);
    if (S.pinned[i] || S.draft[i] == null) {
      e.preventDefault();
      return;
    }
    drag = { kind: 'slot', value: i };
    e.dataTransfer!.effectAllowed = 'move';
    try {
      e.dataTransfer!.setData('text/plain', 's' + i);
    } catch {
      /* see above */
    }
  });

  slots.addEventListener('dragover', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    if (!b || !drag) return;
    if (S.pinned[parseInt(b.dataset.slot!, 10)]) return; // a given is not a drop target
    e.preventDefault();
    e.dataTransfer!.dropEffect = drag.kind === 'slot' ? 'move' : 'copy';
    if (b !== dragHot) {
      clearHot();
      dragHot = b;
      b.classList.add('drag');
    }
  });

  slots.addEventListener('dragleave', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    if (b && b === dragHot && !b.contains(e.relatedTarget as Node)) clearHot();
  });

  slots.addEventListener('drop', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    if (!b || !drag) return;
    e.preventDefault();
    clearHot();
    const i = parseInt(b.dataset.slot!, 10);
    if (!S.pinned[i]) {
      if (drag.kind === 'glyph') {
        place(i, drag.value);
      } else if (drag.value !== i) {
        const j = drag.value;
        const t = S.draft[i]!;
        S.draft[i] = S.draft[j]!;
        S.draft[j] = t;
      }
      S.sel = firstOpen();
    }
    drag = null;
    rerender();
  });

  document.addEventListener('dragend', () => {
    clearHot();
    drag = null;
  });

  const pill = byId('holdBtn');

  // pointer events rather than mouse/touch: one path covers finger, pen and mouse, and
  // pointercancel is what fires when a scroll or a phone call steals the press
  pill.addEventListener('pointerdown', (e) => {
    const room = getRoom();
    const uid = getUid();
    if (!room || !uid || room.meta.status !== 'playing') return;
    void pressHold(room.code, uid, isMine(room));
    try {
      // capture keeps a dragged finger on the button; it must never block the press
      pill.setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer with that id, so there is nothing to capture */
    }
  });

  const letGo = () => {
    const room = getRoom();
    const uid = getUid();
    if (room && uid) void releaseHold(room.code, uid);
  };
  pill.addEventListener('pointerup', letGo);
  pill.addEventListener('pointercancel', letGo);
  // a dragged-away finger or an alt-tab must not leave the button held down
  pill.addEventListener('pointerleave', letGo);
  window.addEventListener('blur', letGo);

  byId('verdictSlot').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b || b.dataset.act !== 'newround') return;
    // anyone at the table can call the rematch; waiting on one person to notice the
    // button is a poor way to end a game
    const room = getRoom();
    if (!room) return;
    resetBoard();
    resetAttempt();
    void nextRound(room);
    rerender();
  });
}
