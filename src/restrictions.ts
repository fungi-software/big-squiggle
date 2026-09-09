export interface Restriction {
  /** Short title, shown as the headline on the briefing card. */
  t: string;
  d: string;
}

export const RESTRICTIONS: readonly Restriction[] = [
  { t: 'Camera off', d: 'Your video is off. You can still talk, and you can see and hear everyone else.' },
  { t: 'Microphone off', d: 'You are muted. You can still be seen, and you can see and hear everyone else.' },
  { t: 'Sound off', d: 'Your speakers are off. You can still talk and be seen, and you can see everyone, but you cannot hear a word.' },
];

export function restrictionFor(seat: number): Restriction {
  return RESTRICTIONS[seat % RESTRICTIONS.length]!;
}
