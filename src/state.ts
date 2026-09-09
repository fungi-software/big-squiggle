export interface Verdict {
  won: boolean;
}

/** Board state for the round in front of you. Everything shared lives in the room. */
export interface BoardState {
  draft: (number | null)[];
  sel: number;
  plate: number[];
  /** `seed:seat` of the deal the plate was built for; a mismatch means re-deal. */
  builtFor: string;
  pinned: Record<number, boolean>;
  pinnedGlyph: Record<number, boolean>;
  checking: boolean;
  graded: Verdict | null;
  left: number;
  lastSig: string | null;
}

export const S: BoardState = {
  draft: [],
  sel: 0,
  plate: [],
  builtFor: '',
  pinned: {},
  pinnedGlyph: {},
  checking: false,
  graded: null,
  left: 5,
  lastSig: null,
};

export function resetBoard(): void {
  cancelCheck();
  S.draft = [];
  S.sel = 0;
  S.plate = [];
  S.builtFor = '';
  S.pinned = {};
  S.pinnedGlyph = {};
  S.graded = null;
  S.lastSig = null;
}

const DRAFT_KEY = 'bs_draft';

/** Keeps a half-built sequence across a refresh, but only for the deal it belongs to. */
export function saveDraft(key: string): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ key, draft: S.draft }));
  } catch {
    /* storage blocked — the draft just will not survive a refresh */
  }
}

export function restoreDraft(key: string): (number | null)[] | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v?.key === key && Array.isArray(v.draft) ? v.draft : null;
  } catch {
    return null;
  }
}

export function firstOpen(): number {
  for (let i = 0; i < S.draft.length; i++) {
    if (!S.pinned[i] && S.draft[i] == null) return i;
  }
  for (let j = 0; j < S.draft.length; j++) {
    if (!S.pinned[j]) return j;
  }
  return 0;
}

/** A glyph already sitting in a given can never be the answer anywhere else. */
export function place(i: number, g: number): boolean {
  if (S.pinned[i] || S.pinnedGlyph[g]) return false;
  const at = S.draft.indexOf(g);
  if (at >= 0 && at !== i && !S.pinned[at]) S.draft[at] = null;
  S.draft[i] = g;
  return true;
}

export const CHECK_MS = 5000;

let cdTimer: ReturnType<typeof setTimeout> | null = null;
let cdTick: ReturnType<typeof setInterval> | null = null;

export function cancelCheck(): void {
  if (cdTimer) {
    clearTimeout(cdTimer);
    cdTimer = null;
  }
  if (cdTick) {
    clearInterval(cdTick);
    cdTick = null;
  }
  S.checking = false;
}

/** Phase 2 replaces this with the hold every player has to press together. */
export function armCheck(answer: number[], onTick: (left: number) => void, onDone: () => void): void {
  if (S.checking) return;
  S.checking = true;
  S.left = Math.round(CHECK_MS / 1000);

  cdTick = setInterval(() => {
    S.left--;
    onTick(Math.max(0, S.left));
    if (S.left <= 0 && cdTick) {
      clearInterval(cdTick);
      cdTick = null;
    }
  }, 1000);

  cdTimer = setTimeout(() => {
    cancelCheck();
    let won = true;
    for (let i = 0; i < answer.length; i++) {
      if (S.draft[i] !== answer[i]) {
        won = false;
        break;
      }
    }
    S.graded = { won };
    onDone();
  }, CHECK_MS);
}
