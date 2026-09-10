export type GameMode = 'call' | 'table';

export interface Restriction {
  /** Short title, shown as the headline on the briefing card. */
  t: string;
  d: string;
}

/**
 * Both sets remove channels asymmetrically rather than handicapping everyone equally:
 * one player cannot be seen, one cannot be heard, one cannot receive. That is what turns
 * the round into a routing problem instead of three private difficulties.
 *
 * The last entry of each set is the isolating one: the player who can transmit but not
 * receive. A table of two never draws it, because with one other person there is no way
 * back into the conversation.
 */
export const CALL_RESTRICTIONS: readonly Restriction[] = [
  { t: 'Camera off', d: 'Turn your camera off. You can still talk, and hear everyone.' },
  { t: 'Microphone off', d: 'Mute your microphone. You can still be seen, and hear everyone.' },
  { t: 'Sound off', d: 'Turn your speakers off. You can still talk, and be seen.' },
];

export const TABLE_RESTRICTIONS: readonly Restriction[] = [
  { t: 'No talking', d: 'Do not make a sound. You can still gesture, and see everyone.' },
  { t: 'No gestures', d: 'Keep your hands and body still. You can still talk, and see everyone.' },
  { t: 'No looking', d: 'Do not look at anyone. Turning away is easiest, but take care not to show your screen. You can still talk, and hear everyone.' },
];

/** Both sets are the same size, which is why dealing does not care which one is in play. */
export const RESTRICTION_KINDS = CALL_RESTRICTIONS.length;

export function restrictionsFor(mode: GameMode): readonly Restriction[] {
  return mode === 'table' ? TABLE_RESTRICTIONS : CALL_RESTRICTIONS;
}
