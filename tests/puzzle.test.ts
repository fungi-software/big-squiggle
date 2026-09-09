import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { parseToken } from '../src/codes';
import { GLYPH_COUNT, PAIR_COUNT, PLATE_PAIRS, svgOf } from '../src/glyphs';
import { buildPuzzle, plateOrder, slotCount } from '../src/puzzle';
import golden from './golden.json';

/**
 * These fixtures were captured from the pre-refactor single-file build. They exist to
 * prove the module split changed no behaviour: a deal is shared across devices only
 * because every client derives it identically, so any drift here breaks real games.
 */
describe('golden fixtures from the original build', () => {
  it('keeps the glyph set identical', () => {
    expect(GLYPH_COUNT).toBe(golden.glyphCount);
    expect(PAIR_COUNT).toBe(golden.pairCount);
    expect(PLATE_PAIRS).toBe(golden.platePairs);

    let all = '';
    for (let i = 0; i < GLYPH_COUNT; i++) all += svgOf(i);
    expect(createHash('sha256').update(all).digest('hex')).toBe(golden.svgSha256);
  });

  it('renders a plain glyph and a mirrored one unchanged', () => {
    expect(svgOf(0)).toBe(golden.svgFirst);
    expect(svgOf(1)).toBe(golden.svgMirrored);
  });

  it.each(Object.keys(golden.cases))('deals %s exactly as before', (key) => {
    const expected = golden.cases[key as keyof typeof golden.cases];
    const [code, rawCount] = key.split('|');
    const count = Number(rawCount);

    const p = buildPuzzle(code!, count);
    expect(p.seed).toBe(expected.seed);
    expect(p.slots).toBe(expected.slots);
    expect(p.pool).toEqual(expected.pool);
    expect(p.answer).toEqual(expected.answer);
    expect(p.owners).toEqual(expected.owners);

    for (let seat = 0; seat < count; seat++) {
      expect(plateOrder(p, seat)).toEqual(expected.plates[seat]);
    }
  });

  it.each(Object.keys(golden.tokens))('parses the token %j as before', (raw) => {
    expect(parseToken(raw)).toEqual(golden.tokens[raw as keyof typeof golden.tokens]);
  });
});

describe('puzzle invariants', () => {
  it('gives every player at least one slot, and every slot one owner', () => {
    for (let count = 2; count <= 8; count++) {
      const p = buildPuzzle('RAVEN', count);
      const seats = new Set(Object.values(p.owners));
      expect(seats.size).toBe(count);
      expect(Object.keys(p.owners)).toHaveLength(p.slots);
    }
  });

  it('never puts a glyph on the plate without its partner', () => {
    const p = buildPuzzle('ZENITH', 5);
    const present = new Set(p.pool);
    for (const g of p.pool) {
      expect(present.has(g % 2 === 0 ? g + 1 : g - 1)).toBe(true);
    }
    expect(p.pool).toHaveLength(PLATE_PAIRS * 2);
  });

  it('draws the answer from the plate, without repeats', () => {
    const p = buildPuzzle('MERIDIAN', 6);
    expect(new Set(p.answer).size).toBe(p.answer.length);
    for (const g of p.answer) expect(p.pool).toContain(g);
  });

  it('clamps the sequence length to the playable range', () => {
    expect(slotCount(2)).toBe(4);
    expect(slotCount(8)).toBe(9);
    for (let n = 2; n <= 8; n++) {
      expect(slotCount(n)).toBeGreaterThanOrEqual(4);
      expect(slotCount(n)).toBeLessThanOrEqual(9);
    }
  });

  it('shows each seat a different plate order but the same contents', () => {
    const p = buildPuzzle('HARBOR', 4);
    const orders = [0, 1, 2, 3].map((s) => plateOrder(p, s));
    for (const o of orders) expect([...o].sort((a, b) => a - b)).toEqual([...p.pool].sort((a, b) => a - b));
    expect(new Set(orders.map((o) => o.join(','))).size).toBe(4);
  });

  it('changes the deal when the player count changes', () => {
    expect(buildPuzzle('RAVEN', 4).answer).not.toEqual(buildPuzzle('RAVEN', 5).answer);
  });

  it('ignores punctuation and case in the game code', () => {
    expect(buildPuzzle('raven', 4)).toEqual(buildPuzzle('  R-A-V-E-N ', 4));
  });
});
