import { formatToken, parseToken, randomCode } from './codes';
import { byId } from './dom';
import { shareUrl } from './share';
import { cancelCheck, firstOpen, place, S, save } from './state';
import { render, renderLobby } from './ui';

type DragSource = { kind: 'glyph'; value: number } | { kind: 'slot'; value: number };

let drag: DragSource | null = null;
let dragHot: HTMLElement | null = null;

function clearHot(): void {
  if (dragHot) {
    dragHot.classList.remove('drag');
    dragHot = null;
  }
}

function tokenOf(): string {
  return formatToken(S.code, S.count);
}

function resetDeal(): void {
  S.draft = [];
  S.builtFor = '';
}

function flash(btn: HTMLElement, msg: string): void {
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  const was = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => {
    btn.textContent = was;
    delete btn.dataset.busy;
  }, 1500);
}

export function mount(): void {
  const codeInput = byId<HTMLInputElement>('codeInput');
  const countInput = byId<HTMLInputElement>('countInput');

  codeInput.addEventListener('input', function () {
    const t = parseToken(this.value);
    S.code = t.word;
    if (t.count) {
      S.count = t.count;
      countInput.value = String(t.count);
    }
    resetDeal();
    renderLobby();
    save();
  });

  // Show the count the code actually resolved to, so a half-typed token cannot mismatch unseen.
  codeInput.addEventListener('blur', function () {
    if (S.code) this.value = tokenOf();
  });

  countInput.addEventListener('input', function () {
    S.count = Math.max(2, Math.min(8, parseInt(this.value, 10) || 4));
    resetDeal();
    codeInput.value = tokenOf();
    renderLobby();
    save();
  });

  byId('rollBtn').addEventListener('click', () => {
    cancelCheck();
    S.graded = null;
    S.code = randomCode();
    resetDeal();
    codeInput.value = tokenOf();
    save();
  });

  byId('copyBtn').addEventListener('click', function () {
    const url = shareUrl();
    const text = url ? 'Big Squiggle: ' + url + '  (game code ' + tokenOf() + ')' : tokenOf();
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(text))
      .then(() => flash(this, 'Copied'))
      .catch(() => {
        codeInput.select();
        flash(this, 'Copy it');
      });
  });

  byId('seatGrid').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-seat]');
    if (!b) return;
    if (!S.code) {
      S.code = randomCode();
      codeInput.value = tokenOf();
    }
    S.seat = parseInt(b.dataset.seat!, 10);
    S.ready = false;
    cancelCheck();
    S.graded = null;
    resetDeal();
    render();
  });

  byId('startBtn').addEventListener('click', () => {
    S.ready = true;
    render();
  });
  byId('backBtn').addEventListener('click', () => {
    S.seat = null;
    S.ready = false;
    render();
  });

  const slots = byId('slots');
  const glyphGrid = byId('glyphGrid');

  slots.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    if (!b) return;
    const i = parseInt(b.dataset.slot!, 10);
    if (S.pinned[i]) return;
    if (S.draft[i] != null && S.sel === i) S.draft[i] = null;
    else S.sel = i;
    render();
  });

  glyphGrid.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-glyph]');
    if (!b) return;
    if (!place(S.sel, parseInt(b.dataset.glyph!, 10))) return;
    S.sel = firstOpen();
    render();
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
    render();
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
    render();
  });

  document.addEventListener('dragend', () => {
    clearHot();
    drag = null;
  });

  byId('leaveBtn').addEventListener('click', () => {
    cancelCheck();
    S.graded = null;
    S.seat = null;
    S.ready = false;
    resetDeal();
    render();
  });

  byId('verdictSlot').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'newround') {
      cancelCheck();
      S.graded = null;
      S.code = randomCode();
      codeInput.value = S.code;
      S.seat = null;
      S.ready = false;
      resetDeal();
    }
    render();
  });
}
