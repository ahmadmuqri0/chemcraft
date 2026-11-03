/**
 * tiles.js
 * Element tile DOM and the DYNAMIC ELECTRON layout.
 *
 * Every tile shows one marker per valence "node":
 *   donor (metal, H)      -> pegs: electrons it gives or shares
 *   acceptor (non-metal)  -> slots: vacancies it needs filled
 *
 * Each marker is placed in polar coordinates around the tile centre:
 *   --a  angle in degrees (0 = east, clockwise, because screen y points down)
 *   --r  radius in units of s (the hex size = half the tile width)
 * CSS turns that into rotate(--a) translateX(--r * s). Both custom properties are
 * registered with @property, so changing them ANIMATES the electron along an arc
 * towards its new position.
 *
 * Geometry used for bonded electrons
 * ----------------------------------
 * Neighbouring centres are sqrt(3)*s apart, along DIRECTION_ANGLES[d].
 * A transferred electron sits at radius 1.0 from its donor, i.e. just past the
 * shared edge (edge midpoint is at sqrt(3)/2 ~ 0.866). Seen from the acceptor,
 * that same point is  E - D  where E is the electron offset from the donor and D
 * the donor-to-acceptor vector. The acceptor's slot is placed exactly there, so
 * the donor's electron lands visually inside the acceptor's slot.
 */

import { DIRECTION_ANGLES, opposite } from './hex.js';

const SQRT3 = Math.sqrt(3);
const IDLE_R = 0.58;   // resting orbit
const LEAN_R = 0.8;    // while hovering next to a partner during a drag
const BOND_R = 1.0;    // transferred / shared electron, just across the edge
const SPREAD = 18;     // degrees between electrons sharing one edge

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Angle offsets for k electrons crossing the same edge, centred on the edge. */
const spreadOffsets = (k) => Array.from({ length: k }, (_, i) => (i - (k - 1) / 2) * SPREAD);

/** Evenly spaced resting angles for `count` markers. */
function idleAngles(count, total) {
  const step = 360 / Math.max(total, 1);
  return Array.from({ length: count }, (_, i) => -90 + step * i + (total === 2 ? 0 : step / 2 - 30));
}

/**
 * Computes where each electron marker of a tile should be.
 *
 * @param {object} element  element data (role, valency)
 * @param {object} info
 * @param {Array<{dir:number,count:number}>} [info.links] bonded edges from the validator
 *        (for a donor: dir points at the acceptor; for an acceptor: dir points at the donor)
 * @param {number[]} [info.lean]  directions of partner tiles while dragging (preview only)
 * @returns {Array<{angle:number, r:number, state:string}>} one entry per valence marker
 *   states: 'free' (donor, unbonded), 'sent' (donor, bonded),
 *           'empty' (acceptor slot, unfilled), 'filled' (acceptor slot, filled),
 *           'lean' (preview while dragging)
 */
export function layoutElectrons(element, info = {}) {
  const valency = element.valency;
  const out = [];

  // Drag preview: share the markers out round-robin towards nearby partners.
  if (info.lean && info.lean.length) {
    const perDir = new Map();
    for (let i = 0; i < valency; i++) {
      const dir = info.lean[i % info.lean.length];
      perDir.set(dir, (perDir.get(dir) ?? 0) + 1);
    }
    for (const [dir, k] of perDir) {
      for (const off of spreadOffsets(k)) {
        out.push({ angle: DIRECTION_ANGLES[dir] + off, r: LEAN_R, state: 'lean' });
      }
    }
    return out;
  }

  const links = info.links ?? [];
  const isDonor = element.role === 'donor';

  for (const { dir, count } of links) {
    const offsets = spreadOffsets(count);
    if (isDonor) {
      // Electron leaves the donor through edge `dir`.
      for (const off of offsets) out.push({ angle: DIRECTION_ANGLES[dir] + off, r: BOND_R, state: 'sent' });
    } else {
      // Mirror the donor's electrons: same physical points, measured from this tile.
      const donorToMe = DIRECTION_ANGLES[opposite(dir)];
      const dx = SQRT3 * Math.cos(toRad(donorToMe));
      const dy = SQRT3 * Math.sin(toRad(donorToMe));
      for (const off of offsets) {
        const ex = BOND_R * Math.cos(toRad(donorToMe + off)) - dx;
        const ey = BOND_R * Math.sin(toRad(donorToMe + off)) - dy;
        out.push({ angle: toDeg(Math.atan2(ey, ex)), r: Math.hypot(ex, ey), state: 'filled' });
      }
    }
  }

  // Whatever is not bonded rests on its own orbit.
  const remaining = valency - out.length;
  for (const angle of idleAngles(remaining, valency)) {
    out.push({ angle, r: IDLE_R, state: isDonor ? 'free' : 'empty' });
  }
  return out.slice(0, valency);
}

/**
 * Shortest-path angle: keeps the CSS transition from spinning the long way round
 * (e.g. from 170deg to -170deg should move 20deg, not 340deg).
 */
function nearestAngle(previous, next) {
  if (previous === undefined) return next;
  let a = next;
  while (a - previous > 180) a -= 360;
  while (a - previous < -180) a += 360;
  return a;
}

// ======================================================================== DOM

const HEX_POINTS = Array.from({ length: 6 }, (_, i) => {
  const a = toRad(60 * i);
  return `${(100 * Math.cos(a)).toFixed(2)},${(100 * Math.sin(a)).toFixed(2)}`;
}).join(' ');

/** Charge label as printed on a tile chip: "+", "2+", "-", "3-" (minus sign). */
export function chargeLabel(element) {
  const sign = element.role === 'donor' ? '+' : '−';
  return element.valency > 1 ? `${element.valency}${sign}` : sign;
}

/**
 * Builds the DOM for one tile.
 * @param {{id:string, element:object, order:number}} tile
 */
export function createTileElement(tile) {
  const { element } = tile;
  const el = document.createElement('div');
  el.className = `tile is-${element.role}`;
  el.dataset.id = tile.id;
  el.dataset.order = String(tile.order);
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.style.setProperty('--el', element.color);

  el.innerHTML = `
    <div class="tile-inner">
      <svg class="tile-shape" viewBox="-100 -86.61 200 173.22" aria-hidden="true">
        <polygon class="tile-body" points="${HEX_POINTS}"></polygon>
        <polygon class="tile-rim" points="${HEX_POINTS}"></polygon>
      </svg>
      <div class="tile-label" aria-hidden="true">
        <span class="tile-symbol">${element.symbol}</span>
        <span class="tile-sub">${element.config.join('.')}</span>
      </div>
      <div class="tile-electrons" aria-hidden="true">
        ${'<span class="e-wrap"><span class="e"></span></span>'.repeat(element.valency)}
      </div>
    </div>`;

  applyElectrons(el, layoutElectrons(element));
  return el;
}

/** Moves the electron markers of a tile element to new positions (animated by CSS). */
export function applyElectrons(tileEl, positions) {
  const wraps = tileEl.querySelectorAll('.e-wrap');
  positions.forEach((p, i) => {
    const wrap = wraps[i];
    if (!wrap) return;
    const previous = wrap.dataset.angle === undefined ? undefined : Number(wrap.dataset.angle);
    const angle = nearestAngle(previous, p.angle);
    wrap.dataset.angle = String(angle);
    wrap.style.setProperty('--a', `${angle.toFixed(2)}deg`);
    wrap.style.setProperty('--r', p.r.toFixed(3));
    wrap.dataset.state = p.state;
  });
}

/**
 * Updates a tile's status visuals after validation.
 * @param {HTMLElement} tileEl
 * @param {object} element
 * @param {{stable:boolean, filled:number, bond:'ionic'|'covalent'}} status
 */
export function applyTileStatus(tileEl, element, { stable, filled, bond }) {
  tileEl.classList.toggle('is-stable', stable);
  tileEl.classList.toggle('is-partial', !stable && filled > 0);
  tileEl.classList.toggle('is-covalent', bond === 'covalent');
  const sub = tileEl.querySelector('.tile-sub');
  // A stable ionic tile shows its ion charge; otherwise its electron arrangement.
  const text = stable && bond === 'ionic' ? chargeLabel(element) : element.config.join('.');
  if (sub.textContent !== text) sub.textContent = text;
  sub.classList.toggle('is-charge', stable && bond === 'ionic');
}
