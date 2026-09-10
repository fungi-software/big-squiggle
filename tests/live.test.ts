import { describe, expect, it } from 'vitest';

import { attempt, HOLD_MS, type LiveRow } from '../src/live';

const NOW = 1_000_000;
const seated = ['a', 'b', 'c'];

function live(rows: Record<string, Partial<LiveRow>>): Record<string, LiveRow> {
  const out: Record<string, LiveRow> = {};
  for (const [uid, r] of Object.entries(rows)) {
    out[uid] = { holding: false, ...r } as LiveRow;
  }
  return out;
}

const allDown = (heldSince: number, correct = true) =>
  live({
    a: { holding: true, correct, heldSince },
    b: { holding: true, correct, heldSince },
    c: { holding: true, correct, heldSince },
  });

describe('nothing happens until everyone is pressing', () => {
  it('is idle when nobody is', () => {
    const s = attempt(seated, live({}), NOW);
    expect(s.phase).toBe('idle');
    expect(s.down).toBe(0);
    expect(s.total).toBe(3);
  });

  it('counts partial presses without charging', () => {
    const s = attempt(seated, live({ a: { holding: true, heldSince: NOW }, b: { holding: true, heldSince: NOW } }), NOW);
    expect(s.phase).toBe('idle');
    expect(s.down).toBe(2);
    expect(s.progress).toBe(0);
  });

  it('never resolves for a table of nobody', () => {
    expect(attempt([], {}, NOW).phase).toBe('idle');
  });

  it('ignores presses from players who hold no seat', () => {
    const rows = allDown(NOW - HOLD_MS);
    rows.stranger = { holding: true, correct: false, heldSince: NOW - HOLD_MS };
    const s = attempt(seated, rows, NOW);
    expect(s.phase).toBe('resolved');
    expect(s.won).toBe(true);
  });
});

describe('charging', () => {
  it('starts at zero the instant the last player presses', () => {
    const s = attempt(seated, allDown(NOW), NOW);
    expect(s.phase).toBe('charging');
    expect(s.progress).toBe(0);
  });

  it('runs to the halfway mark halfway through', () => {
    expect(attempt(seated, allDown(NOW - HOLD_MS / 2), NOW).progress).toBeCloseTo(0.5);
  });

  it('is paced by the last press, not the first', () => {
    const rows = live({
      a: { holding: true, correct: true, heldSince: NOW - 10_000 },
      b: { holding: true, correct: true, heldSince: NOW - 10_000 },
      c: { holding: true, correct: true, heldSince: NOW - 100 },
    });
    const s = attempt(seated, rows, NOW);
    expect(s.phase).toBe('charging');
    expect(s.startedAt).toBe(NOW - 100);
  });

  it('drops back to idle the moment one player lets go', () => {
    const rows = allDown(NOW - HOLD_MS / 2);
    rows.b!.holding = false;
    const s = attempt(seated, rows, NOW);
    expect(s.phase).toBe('idle');
    expect(s.progress).toBe(0);
  });

  it('cannot be pushed past full or below empty by a skewed clock', () => {
    expect(attempt(seated, allDown(NOW + 5000), NOW).progress).toBe(0);
    expect(attempt(seated, allDown(NOW - 10 * HOLD_MS), NOW).progress).toBe(1);
  });
});

describe('resolution', () => {
  it('wins only when every seated player is right', () => {
    expect(attempt(seated, allDown(NOW - HOLD_MS, true), NOW).won).toBe(true);
  });

  it('fails the whole table when one player is wrong', () => {
    const rows = allDown(NOW - HOLD_MS, true);
    rows.c!.correct = false;
    const s = attempt(seated, rows, NOW);
    expect(s.phase).toBe('resolved');
    expect(s.won).toBe(false);
  });

  it('treats a missing correctness flag as wrong rather than assuming a win', () => {
    const rows = allDown(NOW - HOLD_MS, true);
    delete rows.b!.correct;
    expect(attempt(seated, rows, NOW).won).toBe(false);
  });

  it('reveals nothing beyond the verdict itself', () => {
    const rows = allDown(NOW - HOLD_MS, true);
    rows.a!.correct = false;
    expect(Object.keys(attempt(seated, rows, NOW))).toEqual(
      expect.not.arrayContaining(['wrongPlayers', 'correctCount']),
    );
  });

  it('keeps the same attempt id so a held button resolves once, not every frame', () => {
    const rows = allDown(NOW - HOLD_MS);
    const first = attempt(seated, rows, NOW);
    const later = attempt(seated, rows, NOW + 3000);
    expect(later.startedAt).toBe(first.startedAt);
  });

  it('starts a new attempt when someone lets go and presses again', () => {
    const before = attempt(seated, allDown(NOW - HOLD_MS), NOW).startedAt;
    const after = attempt(seated, allDown(NOW), NOW).startedAt;
    expect(after).not.toBe(before);
  });
});

describe('a table that lost someone', () => {
  it('refuses to resolve when fewer seats remain than the round was dealt for', () => {
    // the bug this exists for: players walking out shrank the requirement until whoever
    // was left could solve the whole table's puzzle alone
    const rows = allDown(NOW - HOLD_MS);
    const soloLeft = attempt(['a'], { a: rows.a! }, NOW, 3);
    expect(soloLeft.phase).toBe('idle');
    expect(soloLeft.progress).toBe(0);
  });

  it('will not even charge for a short table', () => {
    const rows = allDown(NOW);
    expect(attempt(['a', 'b'], { a: rows.a!, b: rows.b! }, NOW, 3).phase).toBe('idle');
  });

  it('still resolves when the whole dealt table is present', () => {
    expect(attempt(seated, allDown(NOW - HOLD_MS), NOW, 3).phase).toBe('resolved');
  });

  it('defaults to the seats it was given, so callers cannot forget the count', () => {
    expect(attempt(seated, allDown(NOW - HOLD_MS), NOW).phase).toBe('resolved');
  });
});
