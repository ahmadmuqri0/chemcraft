/**
 * validator.js
 * Core puzzle rule. Port of BondValidator.cs.
 *
 * 1. Bond graph: every DONOR tile (metal, or H in covalent levels) is linked to
 *    each adjacent ACCEPTOR tile. Two donors or two acceptors touching do not bond.
 * 2. Groups: tiles joined by those links form one molecule candidate (union-find).
 * 3. Net valency: total pegs (donor electrons) must equal total slots (acceptor
 *    vacancies), so the net valency of the group is zero.
 * 4. Every peg must land in an ADJACENT slot. Counting neighbours is not enough
 *    (in MgCl2 each Cl has one slot but touches a Mg with two pegs), so the check
 *    is a small max-flow:
 *
 *        source --(pegs)--> donor --(min valency)--> adjacent acceptor --(slots)--> sink
 *
 *    The group is stable when the flow equals both totals. The flow on each
 *    donor->acceptor edge also says HOW MANY electrons move across that edge,
 *    which drives the electron animation on the tiles.
 */

import { hexKey, neighbor, opposite } from './hex.js';

/**
 * Edmonds-Karp max-flow on a dense capacity matrix. Groups hold a handful of
 * tiles, so simplicity beats asymptotics here.
 */
class FlowNetwork {
  constructor(nodeCount) {
    this.n = nodeCount;
    this.capacity = new Int32Array(nodeCount * nodeCount);
    this.original = new Int32Array(nodeCount * nodeCount);
  }

  addEdge(from, to, amount) {
    this.capacity[from * this.n + to] += amount;
    this.original[from * this.n + to] += amount;
  }

  /** Flow that ended up on edge from -> to. */
  flowOn(from, to) {
    const i = from * this.n + to;
    return Math.max(0, this.original[i] - this.capacity[i]);
  }

  maxFlow(source, sink) {
    const { n, capacity } = this;
    let total = 0;
    const previous = new Int32Array(n);

    for (;;) {
      previous.fill(-1);
      previous[source] = source;
      const queue = [source];

      // Breadth-first search for the shortest augmenting path.
      for (let head = 0; head < queue.length && previous[sink] < 0; head++) {
        const u = queue[head];
        for (let v = 0; v < n; v++) {
          if (previous[v] >= 0 || capacity[u * n + v] <= 0) continue;
          previous[v] = u;
          queue.push(v);
        }
      }
      if (previous[sink] < 0) return total;

      // Bottleneck along the path, then push it.
      let push = Infinity;
      for (let v = sink; v !== source; v = previous[v]) {
        push = Math.min(push, capacity[previous[v] * n + v]);
      }
      for (let v = sink; v !== source; v = previous[v]) {
        const u = previous[v];
        capacity[u * n + v] -= push;
        capacity[v * n + u] += push;
      }
      total += push;
    }
  }
}

/**
 * Evaluates the whole board.
 *
 * @param {Array<{id:string, cell:{q:number,r:number}, element:object}>} tiles placed tiles
 * @param {object} level  level definition from data.js (cation, anion, counts)
 * @returns {object} report:
 *   stability   0..1 matched pegs+slots / all pegs+slots on the board
 *   unitsFormed whole formula units built
 *   satisfied   true when the level is won
 *   molecules   per group: { tileIds, pegs, slots, matched, stable, units }
 *   tileState   Map id -> { filled, stable, links:[{ otherId, dir, count }] }
 *   cationsPlaced / anionsPlaced  counts of the level's own elements on the board
 */
export function evaluateBoard(tiles, level) {
  const n = tiles.length;
  const indexByKey = new Map(tiles.map((t, i) => [hexKey(t.cell), i]));

  // 1. Bond edges: donor -> adjacent acceptor (checked in six directions).
  const bonds = []; // { donor, acceptor, dir } with dir pointing from donor to acceptor
  tiles.forEach((tile, i) => {
    if (tile.element.role !== 'donor') return;
    for (let d = 0; d < 6; d++) {
      const j = indexByKey.get(hexKey(neighbor(tile.cell, d)));
      if (j === undefined || tiles[j].element.role !== 'acceptor') continue;
      bonds.push({ donor: i, acceptor: j, dir: d });
    }
  });

  // 2. Groups = connected components (union-find with path halving).
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  for (const b of bonds) {
    const ra = find(b.donor), rb = find(b.acceptor);
    if (ra !== rb) parent[ra] = rb;
  }

  // 3. Score each group with a max-flow.
  const tileState = new Map(tiles.map((t) => [t.id, { filled: 0, stable: false, links: [] }]));
  const molecules = [];
  let totalValency = 0;
  let matchedValency = 0;
  let unitsFormed = 0;

  for (let root = 0; root < n; root++) {
    if (find(root) !== root) continue;
    const members = [];
    for (let i = 0; i < n; i++) if (find(i) === root) members.push(i);

    // Nodes: 0 = source, 1 = sink, 2.. = tiles of this group.
    const local = new Map(members.map((tileIndex, k) => [tileIndex, k + 2]));
    const net = new FlowNetwork(members.length + 2);
    let pegs = 0;
    let slots = 0;
    const composition = new Map(); // symbol -> count

    for (const i of members) {
      const el = tiles[i].element;
      composition.set(el.symbol, (composition.get(el.symbol) ?? 0) + 1);
      if (el.role === 'donor') { pegs += el.valency; net.addEdge(0, local.get(i), el.valency); }
      else { slots += el.valency; net.addEdge(local.get(i), 1, el.valency); }
    }

    const groupBonds = bonds.filter((b) => find(b.donor) === root);
    for (const b of groupBonds) {
      const cap = Math.min(tiles[b.donor].element.valency, tiles[b.acceptor].element.valency);
      net.addEdge(local.get(b.donor), local.get(b.acceptor), cap);
    }

    const matched = net.maxFlow(0, 1);
    const stable = pegs > 0 && pegs === slots && matched === pegs;
    const units = stable ? countFormulaUnits(composition, level) : 0;

    // Per-tile results: how many pegs/slots are filled, and which edges carry electrons.
    for (const i of members) {
      const state = tileState.get(tiles[i].id);
      state.stable = stable;
      state.filled = tiles[i].element.role === 'donor'
        ? net.flowOn(0, local.get(i))
        : net.flowOn(local.get(i), 1);
    }
    for (const b of groupBonds) {
      const count = net.flowOn(local.get(b.donor), local.get(b.acceptor));
      if (count <= 0) continue;
      const donorId = tiles[b.donor].id;
      const acceptorId = tiles[b.acceptor].id;
      tileState.get(donorId).links.push({ otherId: acceptorId, dir: b.dir, count });
      tileState.get(acceptorId).links.push({ otherId: donorId, dir: opposite(b.dir), count });
    }

    molecules.push({
      tileIds: members.map((i) => tiles[i].id),
      pegs, slots, matched, stable, units,
    });
    totalValency += pegs + slots;
    matchedValency += 2 * matched;
    unitsFormed += units;
  }

  const cationsPlaced = tiles.filter((t) => t.element.symbol === level.cation).length;
  const anionsPlaced = tiles.filter((t) => t.element.symbol === level.anion).length;
  const unitsRequired = level.unitsRequired ?? 1;

  return {
    stability: totalValency > 0 ? matchedValency / totalValency : 0,
    unitsFormed,
    unitsRequired,
    satisfied: unitsFormed >= unitsRequired,
    molecules,
    tileState,
    bondCount: bonds.length,
    cationsPlaced,
    anionsPlaced,
  };
}

/**
 * How many whole formula units a stable group contains: k when the group is
 * exactly k x (cationCount, anionCount) of the level's two elements, else 0.
 */
export function countFormulaUnits(composition, level) {
  if (composition.size !== 2) return 0;
  const c = composition.get(level.cation) ?? 0;
  const a = composition.get(level.anion) ?? 0;
  if (!c || !a || c % level.cationCount || a % level.anionCount) return 0;
  const units = c / level.cationCount;
  return a / level.anionCount === units ? units : 0;
}
