export interface Restriction {
  /** Short title, shown as the headline on the briefing card. */
  t: string;
  d: string;
}

export const RESTRICTIONS: readonly Restriction[] = [
  { t: 'Camera off', d: 'Turn your camera off. You can still talk, and hear everyone.' },
  { t: 'Microphone off', d: 'Mute your microphone. You can still be seen, and hear everyone.' },
  { t: 'Sound off', d: 'Turn your speakers off. You can still talk, and be seen.' },
];

export function restrictionFor(seat: number): Restriction {
  return RESTRICTIONS[seat % RESTRICTIONS.length]!;
}
