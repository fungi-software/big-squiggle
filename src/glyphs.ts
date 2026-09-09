/**
 * The glyph set: marks chosen to resist naming, in deliberate near-neighbour pairs.
 * A spec is either raw SVG markup or `{m}` — the same markup, mirrored.
 */
export type GlyphSpec = string | { m: string };

const STROKE =
  'fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"';

export const GLYPHS: readonly GlyphSpec[] = [
  /*A*/ '<path d="M78.2 60.3A30 30 0 1 0 60.3 78.2"/><path d="M66 66L53 53"/>',
  /*B*/ {m:'<path d="M78.2 60.3A30 30 0 1 0 60.3 78.2"/><path d="M66 66L53 53"/>'},
  /*C*/ '<circle cx="50" cy="50" r="11"/><path d="M66.26 33.74A23 23 0 1 1 33.74 33.74"/><circle cx="50" cy="50" r="35"/>',
  /*D*/ '<circle cx="50" cy="50" r="11"/><circle cx="50" cy="50" r="23"/><path d="M74.75 25.25A35 35 0 1 1 25.25 25.25"/>',
  /*E*/ '<g transform="rotate(20 50 50)"><path d="M25 25L52 25L75 48L75 75L25 75Z"/></g>',
  /*F*/ '<g transform="rotate(20 50 50)"><path d="M25 25L75 25L75 75L48 75L25 52Z"/></g>',
  /*G*/ '<path d="M55 18L55 82"/><path d="M55 38L33 38"/><path d="M55 62L33 62"/>',
  /*H*/ '<path d="M45 18L45 82"/><path d="M45 38L67 38"/><path d="M45 62L57 62"/>',
  /*I*/ '<path d="M50 50A10 10 0 0 1 50 30A20 20 0 0 1 50 70A30 30 0 0 1 50 10"/>',
  /*J*/ {m:'<path d="M50 50A10 10 0 0 1 50 30A20 20 0 0 1 50 70A30 30 0 0 1 50 10"/>'},
  /*K*/ '<path d="M50 22A29 29 0 0 1 50 78A29 29 0 0 1 50 22"/><circle cx="50" cy="39" r="5" fill="currentColor" stroke="none"/>',
  /*L*/ '<path d="M50 22A29 29 0 0 1 50 78A29 29 0 0 1 50 22"/><circle cx="50" cy="61" r="5" fill="currentColor" stroke="none"/>',
  /*M*/ '<path d="M22 25H72"/><path d="M38 43H88"/><path d="M22 57H72"/><path d="M22 75H72"/>',
  /*N*/ '<path d="M22 25H72"/><path d="M22 43H72"/><path d="M38 57H88"/><path d="M22 75H72"/>',
  /*O*/ '<path d="M50 50L80 50"/><path d="M50 50L57.5 63"/><path d="M50 50L35 76"/><path d="M50 50L20 50"/><path d="M50 50L35 24"/><path d="M50 50L65 24"/>',
  /*P*/ '<path d="M50 50L80 50"/><path d="M50 50L65 76"/><path d="M50 50L42.5 63"/><path d="M50 50L20 50"/><path d="M50 50L35 24"/><path d="M50 50L65 24"/>',
  /*Q*/ '<circle cx="38" cy="50" r="22"/><path d="M44.88 63.82A22 22 0 0 1 44.88 36.18"/><path d="M56.26 28.76A22 22 0 1 1 56.26 71.24"/>',
  /*R*/ {m:'<circle cx="38" cy="50" r="22"/><path d="M44.88 63.82A22 22 0 0 1 44.88 36.18"/><path d="M56.26 28.76A22 22 0 1 1 56.26 71.24"/>'},
  /*S*/ '<path d="M64 25.75A28 28 0 1 0 64 74.25"/><path d="M64 25.75H82"/>',
  /*T*/ '<path d="M64 25.75A28 28 0 1 0 64 74.25"/><path d="M64 74.25H82"/>',
  /*U*/ '<rect x="22" y="22" width="56" height="56" rx="11"/><path d="M50 22L78 50"/>',
  /*V*/ '<rect x="22" y="22" width="56" height="56" rx="11"/><path d="M50 22L22 50"/>',
  /*W*/ '<circle cx="44" cy="54" r="22"/><circle cx="66.6" cy="31.4" r="10"/>',
  /*X*/ '<circle cx="44" cy="54" r="22"/><circle cx="66.6" cy="76.6" r="10"/>',
  /*Y*/ '<path d="M14 68L26 22L38 68L50 36L62 68L74 36L86 68"/>',
  /*Z*/ '<path d="M14 68L26 36L38 68L50 36L62 68L74 22L86 68"/>',
  /*a*/ '<circle cx="50" cy="50" r="26"/><circle cx="50" cy="33" r="5" fill="currentColor" stroke="none"/>',
  /*b*/ '<circle cx="50" cy="50" r="26"/><circle cx="50" cy="14" r="5" fill="currentColor" stroke="none"/>',
  /*c*/ '<path d="M50 20L76 72L24 72Z"/><path d="M30.7 42.9L43.3 49.1"/>',
  /*d*/ '<path d="M50 20L76 72L24 72Z"/><path d="M69.3 42.9L56.7 49.1"/>',
  /*e*/ '<circle cx="36" cy="36" r="15"/><path d="M46.6 46.6L78 78"/><path d="M64 72L72 64"/>',
  /*f*/ {m:'<circle cx="36" cy="36" r="15"/><path d="M46.6 46.6L78 78"/><path d="M64 72L72 64"/>'},
  /* the nine pairs below are deliberate near-neighbours of the families above, so finding the twin is not enough */
  /*g*/ '<path d="M61.31 38.69A16 16 0 1 1 38.69 38.69"/><circle cx="50" cy="50" r="32"/>',
  /*h*/ '<circle cx="50" cy="50" r="16"/><path d="M72.63 27.37A32 32 0 1 1 27.37 27.37"/>',
  /*i*/ '<path d="M50 50A7 7 0 0 1 50 36A13 13 0 0 1 50 62A19 19 0 0 1 50 24A25 25 0 0 1 50 74A31 31 0 0 1 50 12"/>',
  /*j*/ {m:'<path d="M50 50A7 7 0 0 1 50 36A13 13 0 0 1 50 62A19 19 0 0 1 50 24A25 25 0 0 1 50 74A31 31 0 0 1 50 12"/>'},
  /*k*/ '<circle cx="50" cy="50" r="29"/><circle cx="50" cy="37" r="5" fill="currentColor" stroke="none"/>',
  /*l*/ '<circle cx="50" cy="50" r="29"/><circle cx="50" cy="63" r="5" fill="currentColor" stroke="none"/>',
  /*m*/ '<path d="M50 50L50 20"/><path d="M50 50L64.27 45.36"/><path d="M50 50L67.63 74.27"/><path d="M50 50L32.37 74.27"/><path d="M50 50L21.47 40.73"/>',
  /*n*/ '<path d="M50 50L50 20"/><path d="M50 50L78.53 40.73"/><path d="M50 50L58.82 62.14"/><path d="M50 50L32.37 74.27"/><path d="M50 50L21.47 40.73"/>',
  /*o*/ '<path d="M76.31 40.42A28 28 0 1 0 76.31 59.58"/><path d="M76.31 40.42H88"/>',
  /*p*/ '<path d="M76.31 40.42A28 28 0 1 0 76.31 59.58"/><path d="M76.31 59.58H88"/>',
  /*q*/ '<path d="M20 25H80"/><path d="M20 43H50"/><path d="M20 57H80"/><path d="M20 75H80"/>',
  /*r*/ '<path d="M20 25H80"/><path d="M20 43H80"/><path d="M20 57H50"/><path d="M20 75H80"/>',
  /*s*/ '<circle cx="44" cy="54" r="22"/><circle cx="66.6" cy="31.4" r="9" fill="currentColor" stroke="none"/>',
  /*t*/ '<circle cx="44" cy="54" r="22"/><circle cx="66.6" cy="76.6" r="9" fill="currentColor" stroke="none"/>',
  /*u*/ '<rect x="22" y="22" width="56" height="56" rx="11"/><circle cx="50" cy="35" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ '<rect x="22" y="22" width="56" height="56" rx="11"/><circle cx="50" cy="12" r="5" fill="currentColor" stroke="none"/>',
  /*w*/ '<path d="M14 68L26 36L38 68L50 22L62 68L74 36L86 68"/>',
  /*x*/ '<path d="M14 68L26 36L38 68L50 50L62 68L74 36L86 68"/>'
];
export const GLYPH_COUNT = GLYPHS.length;
export const PAIR_COUNT = GLYPH_COUNT / 2;

/** How many pairs are dealt onto the plate each round. */
export const PLATE_PAIRS = 9;

export function svgOf(index: number): string {
  const spec = GLYPHS[index];
  if (spec === undefined) throw new RangeError('no glyph at index ' + index);
  const inner =
    typeof spec === 'string'
      ? spec
      : '<g transform="translate(100,0) scale(-1,1)">' + spec.m + '</g>';
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><g ' + STROKE + '>' + inner + '</g></svg>';
}
