export const WORDS = [
  'ANCHOR','AMBER','BASIN','BEACON','BRAMBLE','CANYON','CINDER','COMET','COPPER','CRANE',
  'DELTA','DRIFT','EMBER','FATHOM','FERRY','GARNET','GRANITE','HARBOR','INDIGO','IVORY',
  'JUNIPER','KETTLE','LANTERN','LEDGER','MARBLE','MERIDIAN','NECTAR','NIMBUS','ORCHARD','OSPREY',
  'PEWTER','PLUMAGE','QUARRY','RAVEN','RIPPLE','SABLE','SEXTANT','SIGNAL','TALLOW','THICKET',
  'TIMBER','UMBER','VESSEL','WILLOW','WINDROW','ZENITH',
];

export function randomCode(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)]!;
}

export interface ParsedToken {
  word: string;
  count: number | null;
}

/**
 * One token, so the table cannot half-agree: "RAVEN-5" is the word and the
 * player count together.
 */
export function parseToken(str: string): ParsedToken {
  const t = String(str || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const m = /^([A-Z]{2,})([2-8])?$/.exec(t);
  return m
    ? { word: m[1]!, count: m[2] ? parseInt(m[2], 10) : null }
    : { word: t.replace(/[^A-Z]/g, ''), count: null };
}

export function formatToken(code: string, count: number): string {
  return code + '-' + count;
}
