export interface LiveRow {
  holding: boolean;
  correct?: boolean;
  heldSince?: number;
}

export type AttemptPhase = 'idle' | 'charging' | 'resolved';

export interface AttemptState {
  phase: AttemptPhase;
  /** How many of the table are pressing right now. A count, never an identity. */
  down: number;
  total: number;
  progress: number;
  /** Set once resolved. Nobody learns whose sequence was wrong — only that one was. */
  won?: boolean;
  /** The press that started this attempt; identifies it so it resolves exactly once. */
  startedAt?: number;
}

export const HOLD_MS = 2000;

/**
 * The whole of phase 2's shared rule, as a pure function.
 *
 * Every device evaluates this against the same snapshot and its own corrected clock, so
 * five people see the same verdict in the same second without anyone refereeing.
 */
export function attempt(
  seated: string[],
  live: Record<string, LiveRow>,
  serverNow: number,
): AttemptState {
  const total = seated.length;
  const rows = seated.map((uid) => live[uid]);
  const down = rows.filter((r) => r?.holding);

  if (total === 0 || down.length !== total) {
    return { phase: 'idle', down: down.length, total, progress: 0 };
  }

  // the last person to press sets the clock; anyone releasing resets it by leaving
  const startedAt = Math.max(...down.map((r) => r!.heldSince ?? 0));
  const progress = Math.min(1, Math.max(0, (serverNow - startedAt) / HOLD_MS));

  if (progress < 1) {
    return { phase: 'charging', down: down.length, total, progress, startedAt };
  }
  return {
    phase: 'resolved',
    down: down.length,
    total,
    progress: 1,
    startedAt,
    won: down.every((r) => r!.correct === true),
  };
}
