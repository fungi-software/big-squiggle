import { PAIR_COUNT, PLATE_PAIRS } from './glyphs';
import { mulberry32, range, shuffled } from './random';

export interface Puzzle {
  seed: number;
  slots: number;
  /** The glyphs on the plate this round: both halves of every chosen pair. */
  pool: number[];
  answer: number[];
  /** slot index -> seat that is given that slot */
  owners: Record<number, number>;
}

export function slotCount(playerCount: number): number {
  return Math.max(4, Math.min(9, playerCount + 2));
}

export function normCode(str: string): string {
  return String(str || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function seedFrom(code: string, count: number): number {
  const s = normCode(code) + '#' + count;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildPuzzle(code: string, count: number): Puzzle {
  const seed = seedFrom(code, count);
  const slots = slotCount(count);
  const pairs = shuffled(range(PAIR_COUNT), mulberry32(seed)).slice(0, PLATE_PAIRS);

  let pool: number[] = [];
  pairs.forEach((i) => {
    pool.push(i * 2, i * 2 + 1); // both halves, so nothing sits on the plate unpartnered
  });
  pool = shuffled(pool, mulberry32((seed ^ 0x51ed2701) >>> 0));

  const answer = pool.slice(0, slots);
  const order = shuffled(range(slots), mulberry32((seed ^ 0x9e3779b9) >>> 0));
  const owners: Record<number, number> = {};
  order.forEach((slot, k) => {
    owners[slot] = k % count;
  });

  return { seed, slots, pool, answer, owners };
}

/** The plate is shuffled per seat, so no two players see the same layout. */
export function plateOrder(puzzle: Puzzle, seat: number): number[] {
  return shuffled(puzzle.pool, mulberry32((puzzle.seed * 31 + seat * 7919 + 13) >>> 0));
}
