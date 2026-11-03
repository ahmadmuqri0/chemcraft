/**
 * grid.js
 * The board: which cells exist, where they sit in pixels, which cell is nearest
 * to a point, and which tile occupies which cell. Port of HexGridManager.cs.
 * It knows nothing about chemistry and does no rendering.
 *
 * Layout math (flat-topped, size s = centre-to-corner distance)
 * ------------------------------------------------------------
 * A hex is 2s wide and sqrt(3)s tall. Columns are 1.5s apart; each step down a
 * column is sqrt(3)s. With y pointing DOWN (screen pixels):
 *
 *     x = s * 3/2 * q
 *     y = s * sqrt(3) * (r + q/2)
 *
 * Inverse (pixel -> axial), followed by cube rounding:
 *
 *     q = (2/3 * x) / s
 *     r = (y / sqrt(3) - x / 3) / s
 */

import { fromOddQ, hexKey, neighbor, roundHex } from './hex.js';

const SQRT3 = Math.sqrt(3);

export class HexGrid {
  /**
   * @param {object} options
   * @param {number} options.columns  board width in columns (odd-q rectangle)
   * @param {number} options.rows     board height in rows
   * @param {Array<[number, number]>} [options.blocked] (column,row) pairs to cut out
   */
  constructor({ columns = 7, rows = 5, blocked = [] } = {}) {
    this.columns = columns;
    this.rows = rows;
    this.size = 40;          // hex size in px, set by layout()
    this.originX = 0;        // pixel position of axial (0,0)
    this.originY = 0;

    /** @type {Map<string, {q:number, r:number}>} every board cell by key */
    this.cells = new Map();
    /** @type {Map<string, string>} cell key -> tile id */
    this.occupant = new Map();
    /** @type {Map<string, string>} tile id -> cell key */
    this.cellOfTile = new Map();

    const blockedSet = new Set(blocked.map(([c, r]) => `${c}:${r}`));
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows; row++) {
        if (blockedSet.has(`${col}:${row}`)) continue;
        const cell = fromOddQ(col, row);
        this.cells.set(hexKey(cell), cell);
      }
    }
  }

  // ------------------------------------------------------------- sizing

  /**
   * Fits the board inside a width x height box (pixels) and centres it.
   * Board width  = s * (1.5 * (columns - 1) + 2)
   * Board height = s * sqrt(3) * (rows + 0.5)   (+0.5 for the shifted odd columns)
   */
  layout(width, height, padding = 8) {
    const fitW = (width - padding * 2) / (1.5 * (this.columns - 1) + 2);
    const fitH = (height - padding * 2) / (SQRT3 * (this.rows + 0.5));
    this.size = Math.max(12, Math.min(fitW, fitH));

    // Centre the bounding box of all cell centres in the box.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const cell of this.cells.values()) {
      const p = this.axialToPlane(cell);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    this.originX = width / 2 - (minX + maxX) / 2;
    this.originY = height / 2 - (minY + maxY) / 2;
  }

  /** Width and height of one tile at the current size. */
  get tileWidth() { return 2 * this.size; }
  get tileHeight() { return SQRT3 * this.size; }

  /** Axial -> plane, relative to axial (0,0). */
  axialToPlane(cell) {
    return {
      x: this.size * 1.5 * cell.q,
      y: this.size * SQRT3 * (cell.r + cell.q / 2),
    };
  }

  /** Centre of a cell in board pixels. */
  toPixel(cell) {
    const p = this.axialToPlane(cell);
    return { x: this.originX + p.x, y: this.originY + p.y };
  }

  /** Cell containing a board-pixel point (may be off the board). */
  fromPixel(x, y) {
    const px = x - this.originX;
    const py = y - this.originY;
    const q = ((2 / 3) * px) / this.size;
    const r = (py / SQRT3 - px / 3) / this.size;
    return roundHex(q, r);
  }

  /**
   * Nearest board cell to a point. Inside the board this is one cube rounding;
   * outside it falls back to the closest real cell within `tolerance` hex sizes.
   * Returns null when the point is too far away.
   */
  nearestCell(x, y, tolerance = 0.9) {
    const rounded = this.fromPixel(x, y);
    if (this.cells.has(hexKey(rounded))) return rounded;

    let best = null;
    let bestDist = Infinity;
    for (const cell of this.cells.values()) {
      const p = this.toPixel(cell);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) { bestDist = d; best = cell; }
    }
    return bestDist <= tolerance * this.size ? best : null;
  }

  /** SVG polygon points for the hex at `cell`, scaled by `scale`. */
  polygonPoints(cell, scale = 1) {
    const c = this.toPixel(cell);
    const s = this.size * scale;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * 60 * i; // corner 0 points east (flat-topped)
      pts.push(`${(c.x + s * Math.cos(a)).toFixed(2)},${(c.y + s * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
  }

  // ------------------------------------------------------------- neighbours

  /** Board cells touching `cell` (up to six). */
  neighborCells(cell) {
    const out = [];
    for (let d = 0; d < 6; d++) {
      const n = neighbor(cell, d);
      if (this.cells.has(hexKey(n))) out.push(n);
    }
    return out;
  }

  // ------------------------------------------------------------- occupancy

  isValid(cell) { return this.cells.has(hexKey(cell)); }
  isOccupied(cell) { return this.occupant.has(hexKey(cell)); }
  tileAt(cell) { return this.occupant.get(hexKey(cell)) ?? null; }

  /** Cell of a tile, or null when it is not on the board. */
  cellOf(tileId) {
    const key = this.cellOfTile.get(tileId);
    return key ? this.cells.get(key) : null;
  }

  /** Puts a tile on a free cell. Returns false when off-board or taken. */
  place(tileId, cell) {
    const key = hexKey(cell);
    if (!this.cells.has(key) || this.occupant.has(key)) return false;
    this.remove(tileId);
    this.occupant.set(key, tileId);
    this.cellOfTile.set(tileId, key);
    return true;
  }

  /** Frees the tile's cell. Returns false when it was not placed. */
  remove(tileId) {
    const key = this.cellOfTile.get(tileId);
    if (!key) return false;
    this.cellOfTile.delete(tileId);
    this.occupant.delete(key);
    return true;
  }

  clear() {
    this.occupant.clear();
    this.cellOfTile.clear();
  }

  /** [{ tileId, cell }] for every placed tile. */
  placements() {
    const out = [];
    for (const [tileId, key] of this.cellOfTile) out.push({ tileId, cell: this.cells.get(key) });
    return out;
  }
}
