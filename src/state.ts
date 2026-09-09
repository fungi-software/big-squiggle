import { buildPuzzle } from './puzzle';

export interface Verdict {
  won: boolean;
}

export interface GameState {
  code: string;
  count: number;
  seat: number | null;
  draft: (number | null)[];
  sel: number;
  plate: number[];
  /** `seed:seat` of the deal the plate was built for; a mismatch means re-deal. */
  builtFor: string;
  ready: boolean;
  pinned: Record<number, boolean>;
  pinnedGlyph: Record<number, boolean>;
  checking: boolean;
  graded: Verdict | null;
  left: number;
  lastSig: string | null;
}

export const S: GameState = {
  code: '',
  count: 4,
  seat: null,
  draft: [],
  sel: 0,
  plate: [],
  builtFor: '',
  ready: false,
  pinned: {},
  pinnedGlyph: {},
  checking: false,
  graded: null,
  left: 5,
  lastSig: null,
};

const STORAGE_KEY = 'us_state';

export function save(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code: S.code, count: S.count, seat: S.seat, ready: S.ready, draft: S.draft }),
    );
  } catch {
    /* private browsing, blocked storage — the game still plays */
  }
}

export function restore(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const v = JSON.parse(raw);
    if (v && typeof v === 'object') {
      S.code = String(v.code || '');
      S.count = parseInt(v.count, 10) || 4;
      S.seat = v.seat == null ? null : parseInt(v.seat, 10);
      S.ready = !!v.ready;
      S.draft = Array.isArray(v.draft) ? v.draft : [];
    }
  } catch {
    /* corrupt payload — fall back to a fresh state */
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

export function armCheck(onTick: (left: number) => void, onDone: () => void): void {
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
    const p = buildPuzzle(S.code, S.count);
    let won = true;
    for (let i = 0; i < p.slots; i++) {
      if (S.draft[i] !== p.answer[i]) {
        won = false;
        break;
      }
    }
    S.graded = { won };
    onDone();
  }, CHECK_MS);
}
