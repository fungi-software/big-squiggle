/**
 * The glyph set: marks chosen to resist naming, in deliberate near-neighbour pairs.
 * A spec is either raw SVG markup or `{m}`, meaning the same markup mirrored.
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
  /*K*/ '<path d="M50 50L50 38L64 38L64 64L36 64L36 24L78 24L78 78L22 78"/>',
  /*L*/ {m:'<path d="M50 50L50 38L64 38L64 64L36 64L36 24L78 24L78 78L22 78"/>'},
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
  /*x*/ '<path d="M14 68L26 36L38 68L50 50L62 68L74 36L86 68"/>',
  /* twelve wackier marks, still built as near-twins so finding the family is not the answer */
  /*ac*/ '<path d="M12 62C22 40 34 40 42 56C48 68 62 66 60 50C58 38 44 40 46 58C48 76 68 78 88 54"/>',
  /*ad*/ {m:'<path d="M12 62C22 40 34 40 42 56C48 68 62 66 60 50C58 38 44 40 46 58C48 76 68 78 88 54"/>'},
  /*ae*/ '<path d="M32 16V84"/><path d="M68 16V84"/><path d="M32 34H68"/><path d="M32 50H52"/><path d="M32 66H68"/>',
  /*af*/ '<path d="M32 16V84"/><path d="M68 16V84"/><path d="M32 34H68"/><path d="M32 50H68"/><path d="M32 66H52"/>',
  /*ag*/ '<path d="M34 14V86"/><path d="M34 24L76 37L34 50Z"/>',
  /*ah*/ '<path d="M34 14V86"/><path d="M34 50L76 63L34 76Z"/>',
  /*ai*/ '<path d="M16 62A15 15 0 0 1 46 62A15 15 0 0 1 76 62"/><path d="M16 62H86"/>',
  /*aj*/ '<path d="M16 42A15 15 0 0 0 46 42A15 15 0 0 0 76 42"/><path d="M16 42H86"/>',
  /*ak*/ '<path d="M20 78H44V58H64V38H84"/>',
  /*al*/ {m:'<path d="M20 78H44V58H64V38H84"/>'},
  /* ---- one variation pair for every pair above: same family, one structural twist ---- */
  /*v arc+tick, arc broken*/ '<path d="M78.2 60.3A30 30 0 0 0 62 24"/><path d="M28 32A30 30 0 0 0 60.3 78.2"/><path d="M66 66L53 53"/>',
  /*v*/ {m:'<path d="M78.2 60.3A30 30 0 0 0 62 24"/><path d="M28 32A30 30 0 0 0 60.3 78.2"/><path d="M66 66L53 53"/>'},
  /*v rings, nested the other way about*/ '<circle cx="50" cy="50" r="13"/><rect x="24" y="24" width="52" height="52" rx="8"/>',
  /*v*/ '<rect x="37" y="37" width="26" height="26" rx="5"/><circle cx="50" cy="50" r="28"/>',
  /*v blob, with a dot*/ '<g transform="rotate(20 50 50)"><path d="M25 25L52 25L75 48L75 75L25 75Z"/></g><circle cx="52" cy="54" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ {m:'<g transform="rotate(20 50 50)"><path d="M25 25L52 25L75 48L75 75L25 75Z"/></g><circle cx="52" cy="54" r="5" fill="currentColor" stroke="none"/>'},
  /*v T-bar, three arms*/ '<path d="M55 16V84"/><path d="M55 32H33"/><path d="M55 50H33"/><path d="M55 68H33"/>',
  /*v*/ '<path d="M45 16V84"/><path d="M45 32H67"/><path d="M45 50H67"/><path d="M45 68H67"/>',
  /*v spiral, ending in a dot*/ '<path d="M50 50A10 10 0 0 1 50 30A20 20 0 0 1 50 70A30 30 0 0 1 50 10"/><circle cx="50" cy="10" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ {m:'<path d="M50 50A10 10 0 0 1 50 30A20 20 0 0 1 50 70A30 30 0 0 1 50 10"/><circle cx="50" cy="10" r="5" fill="currentColor" stroke="none"/>'},
  /*v square spiral, one turn looser*/ '<path d="M50 52V42H64V64H36V28H80"/>',
  /*v*/ {m:'<path d="M50 52V42H64V64H36V28H80"/>'},
  /*v stacked lines, one broken*/ '<path d="M22 26H78"/><path d="M22 42H44"/><path d="M56 42H78"/><path d="M22 58H78"/><path d="M22 74H78"/>',
  /*v*/ '<path d="M22 26H78"/><path d="M22 42H78"/><path d="M22 58H44"/><path d="M56 58H78"/><path d="M22 74H78"/>',
  /*v asterisk, hub filled or hollow*/ '<path d="M50 22V78"/><path d="M26 36L74 64"/><path d="M26 64L74 36"/><circle cx="50" cy="50" r="7" fill="currentColor" stroke="none"/>',
  /*v*/ '<path d="M50 22V78"/><path d="M26 36L74 64"/><path d="M26 64L74 36"/><circle cx="50" cy="50" r="9"/>',
  /*v venn, a third circle*/ '<circle cx="37" cy="42" r="18"/><circle cx="63" cy="42" r="18"/><circle cx="50" cy="64" r="18"/>',
  /*v*/ '<circle cx="37" cy="58" r="18"/><circle cx="63" cy="58" r="18"/><circle cx="50" cy="36" r="18"/>',
  /*v C, ticked at both ends*/ '<path d="M66 26A28 28 0 1 0 66 74"/><path d="M66 26H84"/><path d="M66 74H84"/>',
  /*v*/ {m:'<path d="M66 26A28 28 0 1 0 66 74"/><path d="M66 26H84"/><path d="M66 74H84"/>'},
  /*v folded square, with a dot*/ '<rect x="22" y="22" width="56" height="56" rx="11"/><path d="M50 22L78 50"/><circle cx="38" cy="62" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ {m:'<rect x="22" y="22" width="56" height="56" rx="11"/><path d="M50 22L78 50"/><circle cx="38" cy="62" r="5" fill="currentColor" stroke="none"/>'},
  /*v satellite, a second one*/ '<circle cx="44" cy="56" r="20"/><circle cx="68" cy="30" r="9"/><circle cx="24" cy="30" r="6"/>',
  /*v*/ {m:'<circle cx="44" cy="56" r="20"/><circle cx="68" cy="30" r="9"/><circle cx="24" cy="30" r="6"/>'},
  /*v zigzag, a marked peak*/ '<path d="M14 68L26 36L38 68L50 36L62 68L74 36L86 68"/><circle cx="50" cy="28" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ '<path d="M14 68L26 36L38 68L50 36L62 68L74 36L86 68"/><circle cx="26" cy="28" r="5" fill="currentColor" stroke="none"/>',
  /*v circle, a square instead of a dot*/ '<circle cx="50" cy="50" r="26"/><rect x="44" y="28" width="13" height="13" rx="2"/>',
  /*v*/ '<circle cx="50" cy="50" r="26"/><rect x="44" y="7" width="13" height="13" rx="2"/>',
  /*v triangle, dotted and upended*/ '<path d="M50 20L76 72L24 72Z"/><circle cx="50" cy="57" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ '<path d="M50 80L76 28L24 28Z"/><circle cx="50" cy="43" r="5" fill="currentColor" stroke="none"/>',
  /*v key, a second tooth*/ '<circle cx="36" cy="36" r="15"/><path d="M46.6 46.6L78 78"/><path d="M60 68L68 60"/><path d="M70 78L78 70"/>',
  /*v*/ {m:'<circle cx="36" cy="36" r="15"/><path d="M46.6 46.6L78 78"/><path d="M60 68L68 60"/><path d="M70 78L78 70"/>'},
  /*v the arch, boxed*/ '<rect x="22" y="22" width="56" height="56" rx="11"/><path d="M38 40A12 12 0 0 1 62 40"/>',
  /*v*/ '<rect x="22" y="22" width="56" height="56" rx="11"/><path d="M38 60A12 12 0 0 0 62 60"/>',
  /*v dense spiral, with a flick*/ '<path d="M50 50A7 7 0 0 1 50 36A13 13 0 0 1 50 62A19 19 0 0 1 50 24A25 25 0 0 1 50 74"/><path d="M50 74L70 84"/>',
  /*v*/ {m:'<path d="M50 50A7 7 0 0 1 50 36A13 13 0 0 1 50 62A19 19 0 0 1 50 24A25 25 0 0 1 50 74"/><path d="M50 74L70 84"/>'},
  /*v off-centre, a ring not a dot*/ '<circle cx="50" cy="50" r="29"/><circle cx="50" cy="38" r="8"/>',
  /*v*/ '<circle cx="50" cy="50" r="29"/><circle cx="50" cy="62" r="8"/>',
  /*v star, one arm cut short*/ '<path d="M50 20V80"/><path d="M24 35L76 65"/><path d="M24 65L62 43"/>',
  /*v*/ {m:'<path d="M50 20V80"/><path d="M24 35L76 65"/><path d="M24 65L62 43"/>'},
  /*v the gap, minded*/ '<path d="M76.31 40.42A28 28 0 1 0 76.31 59.58"/><circle cx="86" cy="50" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ '<path d="M76.31 40.42A28 28 0 1 0 76.31 59.58"/><circle cx="50" cy="50" r="5" fill="currentColor" stroke="none"/>',
  /*v lines, stepped in length*/ '<path d="M20 26H50"/><path d="M20 42H62"/><path d="M20 58H74"/><path d="M20 74H86"/>',
  /*v*/ '<path d="M20 26H86"/><path d="M20 42H74"/><path d="M20 58H62"/><path d="M20 74H50"/>',
  /*v satellite, tethered*/ '<circle cx="40" cy="58" r="20"/><circle cx="72" cy="26" r="8" fill="currentColor" stroke="none"/><path d="M55 43L65 33"/>',
  /*v*/ {m:'<circle cx="40" cy="58" r="20"/><circle cx="72" cy="26" r="8" fill="currentColor" stroke="none"/><path d="M55 43L65 33"/>'},
  /*v boxed dots, paired*/ '<rect x="22" y="22" width="56" height="56" rx="11"/><circle cx="39" cy="39" r="5" fill="currentColor" stroke="none"/><circle cx="61" cy="61" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ '<rect x="22" y="22" width="56" height="56" rx="11"/><circle cx="61" cy="39" r="5" fill="currentColor" stroke="none"/><circle cx="39" cy="61" r="5" fill="currentColor" stroke="none"/>',
  /*v zigzag, rounded off*/ '<path d="M14 60C26 30 38 30 50 60C62 86 74 86 86 60"/>',
  /*v*/ '<path d="M14 60C26 86 38 86 50 60C62 30 74 30 86 60"/>',
  /*v squiggle, stopped with a dot*/ '<path d="M12 62C22 40 34 40 42 56C48 68 62 66 60 50C58 38 44 40 46 58C48 76 68 78 88 54"/><circle cx="88" cy="54" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ {m:'<path d="M12 62C22 40 34 40 42 56C48 68 62 66 60 50C58 38 44 40 46 58C48 76 68 78 88 54"/><circle cx="88" cy="54" r="5" fill="currentColor" stroke="none"/>'},
  /*v ladder, braced*/ '<path d="M32 16V84"/><path d="M68 16V84"/><path d="M32 34H68"/><path d="M32 66H68"/><path d="M32 66L68 34"/>',
  /*v*/ '<path d="M32 16V84"/><path d="M68 16V84"/><path d="M32 34H68"/><path d="M32 66H68"/><path d="M32 34L68 66"/>',
  /*v pennant, swallowtailed*/ '<path d="M34 14V86"/><path d="M34 24H76L64 37L76 50H34Z"/>',
  /*v*/ '<path d="M34 14V86"/><path d="M34 50H76L64 63L76 76H34Z"/>',
  /*v scallop, with a mark*/ '<path d="M16 62A15 15 0 0 1 46 62A15 15 0 0 1 76 62"/><path d="M16 62H86"/><circle cx="31" cy="42" r="5" fill="currentColor" stroke="none"/>',
  /*v*/ '<path d="M16 62A15 15 0 0 1 46 62A15 15 0 0 1 76 62"/><path d="M16 62H86"/><circle cx="61" cy="42" r="5" fill="currentColor" stroke="none"/>',
  /*v staircase, one step more*/ '<path d="M16 82H36V66H56V50H76V34H88"/>',
  /*v*/ {m:'<path d="M16 82H36V66H56V50H76V34H88"/>'},
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
