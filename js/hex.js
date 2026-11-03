/**
 * hex.js
 * Pure math for a FLAT-TOPPED hexagonal grid using AXIAL coordinates (q, r).
 * Port of HexCoord.cs from the Unity version. No DOM access here.
 *
 * Axial coordinates
 * -----------------
 * Two axes 120 degrees apart: q runs along the columns, r runs down the rows.
 * A third cube axis s = -q - r is implied, so every cell obeys q + r + s = 0.
 * That identity is what keeps the neighbour and distance formulas short.
 *
 * Neighbours
 * ----------
 * Stepping to an adjacent cell changes exactly two cube coordinates, one by +1
 * and one by -1. In axial terms the six neighbours of (q, r) are (q, r) plus one
 * of these fixed vectors (r grows DOWN the screen):
 *
 *              N (0,-1)
 *     NW (-1, 0)     NE (+1,-1)
 *              [q,r]
 *     SW (-1,+1)     SE (+1, 0)
 *              S (0,+1)
 *
 * The list is clockwise from the top, so the opposite edge of d is (d + 3) % 6.
 *
 * Distance
 * --------
 * Steps between two cells = half the Manhattan distance in cube space:
 *   (|dq| + |dr| + |dq + dr|) / 2      because ds = -(dq + dr)
 */

/** Unit steps, clockwise from North. Index = direction 0..5. */
export const DIRECTIONS = Object.freeze([
  { q: 0, r: -1 }, // 0 North
  { q: 1, r: -1 }, // 1 North-east
  { q: 1, r: 0 },  // 2 South-east
  { q: 0, r: 1 },  // 3 South
  { q: -1, r: 1 }, // 4 South-west
  { q: -1, r: 0 }, // 5 North-west
]);

/**
 * Screen angle (degrees, 0 = east, clockwise because y points down) of the edge
 * midpoint in each direction. Used to point electrons at a neighbour.
 */
export const DIRECTION_ANGLES = Object.freeze([-90, -30, 30, 90, 150, 210]);

/** Creates an axial coordinate. */
export const hex = (q, r) => ({ q, r });

/** Stable string key, handy for Map/Set lookups. */
export const hexKey = (h) => `${h.q},${h.r}`;

/** Parses a key made by hexKey. */
export function parseKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export const hexEquals = (a, b) => a.q === b.q && a.r === b.r;

/** Adjacent cell in direction d (0..5, wraps). */
export function neighbor(h, d) {
  const step = DIRECTIONS[((d % 6) + 6) % 6];
  return { q: h.q + step.q, r: h.r + step.r };
}

/** Edge that faces back from the neighbour. */
export const opposite = (d) => (((d % 6) + 6) % 6 + 3) % 6;

/** Hex steps between two cells. */
export function distance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/**
 * Direction index from a to an ADJACENT cell b, or -1 when they do not touch.
 */
export function directionTo(a, b) {
  for (let d = 0; d < 6; d++) {
    const n = neighbor(a, d);
    if (n.q === b.q && n.r === b.r) return d;
  }
  return -1;
}

/**
 * Rounds fractional axial coordinates to the cell containing the point
 * ("cube rounding"). Round q, r and s independently, then rebuild whichever one
 * moved the most so that q + r + s = 0 still holds. Rounding q and r alone
 * picks the wrong cell near corners where three cells meet.
 */
export function roundHex(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // else s was worst; axial does not store s, so q and r are already right.

  return { q: rq + 0, r: rr + 0 }; // "+ 0" turns -0 into 0
}

/**
 * "Odd-q" offset (column, row) -> axial. Odd columns sit half a hex lower,
 * which is the natural way to author a rectangular board.
 *   q = col,  r = row - (col - (col & 1)) / 2
 */
export function fromOddQ(col, row) {
  return { q: col, r: row - (col - (col & 1)) / 2 };
}

/** Axial -> "odd-q" offset. */
export function toOddQ(h) {
  return { col: h.q, row: h.r + (h.q - (h.q & 1)) / 2 };
}
