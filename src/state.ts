/** Board state for the round in front of you. Everything shared lives in the room. */
export interface BoardState {
  draft: (number | null)[];
  /** The slot a tapped shape lands in; -1 until the player picks one. */
  sel: number;
  plate: number[];
  /** `seed:seat` of the deal the plate was built for; a mismatch means re-deal. */
  builtFor: string;
  pinned: Record<number, boolean>;
  pinnedGlyph: Record<number, boolean>;
}

export const S: BoardState = {
  draft: [],
  sel: -1,
  plate: [],
  builtFor: '',
  pinned: {},
  pinnedGlyph: {},
};

export function resetBoard(): void {
  S.draft = [];
  S.sel = -1;
  S.plate = [];
  S.builtFor = '';
  S.pinned = {};
  S.pinnedGlyph = {};
}

const DRAFT_KEY = 'bs_draft';

/** Keeps a half-built sequence across a refresh, but only for the deal it belongs to. */
export function saveDraft(key: string): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ key, draft: S.draft }));
  } catch {
    /* storage blocked, so the draft just will not survive a refresh */
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
