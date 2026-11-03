/**
 * game.js
 * Runs one level: board rendering, tray, drag & drop, tap-to-place, validation,
 * and win detection. Port of DraggableHexTile.cs + TileTray.cs + the board half
 * of LevelManager.cs.
 *
 * Events (Game extends EventTarget):
 *   'evaluate'  detail: { report, level }   after every board change (HUD listens)
 *   'win'       detail: { report, level }   once per level
 *   'message'   detail: { text }            short status for the live region / toast
 *
 * Input model
 *   - Pointer drag (mouse, touch, pen) using window-level listeners, so the tile
 *     can be re-parented into the drag layer without losing the gesture.
 *   - Tap a tray tile to select it, then tap a cell. Tap a board tile to return it.
 *   - Keyboard: Enter/Space on a tray tile auto-places it next to a partner;
 *     Enter/Space on a board tile returns it to the tray.
 */

import { ELEMENTS } from "./data.js";
import { HexGrid } from "./grid.js";
import { DIRECTION_ANGLES, hexKey, neighbor } from "./hex.js";
import { localized, t } from "./localization.js";
import {
  applyElectrons,
  applyTileStatus,
  createTileElement,
  layoutElectrons,
} from "./tiles.js";
import { evaluateBoard } from "./validator.js";

const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag
const SVG_NS = "http://www.w3.org/2000/svg";

export class Game extends EventTarget {
  /**
   * @param {object} dom
   * @param {HTMLElement} dom.stage      board box (measured for layout)
   * @param {SVGSVGElement} dom.svg      cells, bond links and highlight
   * @param {HTMLElement} dom.tileLayer  placed tiles
   * @param {HTMLElement} dom.tray       tray tiles
   * @param {HTMLElement} dom.dragLayer  fixed overlay for the tile being dragged
   * @param {import('./audio.js').AudioManager} audio
   */
  constructor(dom, audio) {
    super();
    this.dom = dom;
    this.audio = audio;
    this.grid = new HexGrid({ columns: 7, rows: 5 });
    this.level = null;
    this.tiles = new Map(); // id -> { id, element, el, order, place: 'tray'|'board' }
    this.locked = false;
    this.selectedId = null;
    this.drag = null; // active drag state
    this.lastReport = null;
    this.stableGroups = 0;

    this.buildSvgLayers();
    this.bindBoardInput();

    // Re-layout whenever the board or tray changes size (window resize, rotation).
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(dom.stage);
    this.resizeObserver.observe(dom.tray);
  }

  // ===================================================================== setup

  buildSvgLayers() {
    const { svg } = this.dom;
    svg.innerHTML = "";
    this.cellGroup = document.createElementNS(SVG_NS, "g");
    this.cellGroup.setAttribute("class", "cells");
    this.linkGroup = document.createElementNS(SVG_NS, "g");
    this.linkGroup.setAttribute("class", "links");
    this.highlight = document.createElementNS(SVG_NS, "polygon");
    this.highlight.setAttribute("class", "cell-highlight");
    svg.append(this.cellGroup, this.highlight, this.linkGroup);
  }

  /** Starts a level: fresh tiles in the tray, empty board. */
  load(level) {
    this.cancelDrag();
    this.level = level;
    this.locked = false;
    this.selectedId = null;
    this.stableGroups = 0;
    this.grid.clear();
    this.tiles.forEach((tile) => {
      tile.el.remove();
    });
    this.tiles.clear();

    level.tray.forEach((symbol, order) => {
      const tile = {
        id: `t${order}`,
        element: ELEMENTS[symbol],
        order,
        place: "tray",
      };
      tile.el = createTileElement(tile);
      this.bindTileInput(tile);
      this.tiles.set(tile.id, tile);
      this.dom.tray.append(tile.el);
    });

    this.dom.stage.classList.toggle("is-covalent", level.bond === "covalent");
    this.layout();
    this.updateTileLabels();
    this.evaluate();
  }

  /** Clears the board: every placed tile goes back to the tray. */
  clearBoard() {
    if (this.locked) return;
    this.tiles.forEach((tile) => {
      if (tile.place === "board") this.moveToTray(tile, false);
    });
    this.evaluate();
    this.message(t("game.cleared"));
  }

  // ===================================================================== layout

  /** Sizes the grid to the stage, redraws cells and repositions tiles. */
  layout() {
    const { stage, svg, tray } = this.dom;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    this.grid.layout(rect.width, rect.height, 10);
    const s = this.grid.size;
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    stage.style.setProperty("--s", `${s}px`);
    this.dom.dragLayer.style.setProperty("--s", `${s}px`);

    // Tray tiles: as big as board tiles, but never taller than the tray allows.
    const trayRect = tray.getBoundingClientRect();
    const trayS = Math.max(
      16,
      Math.min(s, (trayRect.height - 28) / Math.sqrt(3)),
    );
    tray.style.setProperty("--s", `${trayS}px`);

    // Cells
    this.cellGroup.innerHTML = "";
    for (const cell of this.grid.cells.values()) {
      const poly = document.createElementNS(SVG_NS, "polygon");
      poly.setAttribute("points", this.grid.polygonPoints(cell, 0.94));
      poly.setAttribute("class", "cell");
      poly.dataset.key = hexKey(cell);
      this.cellGroup.append(poly);
    }

    // Placed tiles
    this.tiles.forEach((tile) => {
      if (tile.place === "board") this.positionOnBoard(tile);
    });
    this.drawLinks();
  }

  positionOnBoard(tile) {
    const p = this.grid.toPixel(tile.cell);
    tile.el.style.left = `${p.x}px`;
    tile.el.style.top = `${p.y}px`;
  }

  // ===================================================================== input: tiles

  bindTileInput(tile) {
    tile.el.addEventListener("pointerdown", (e) => this.onPointerDown(e, tile));
    tile.el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (this.locked) return;
      if (tile.place === "board") this.returnTile(tile);
      else this.autoPlace(tile);
    });
  }

  onPointerDown(e, tile) {
    if (this.locked || this.drag || (e.button !== undefined && e.button !== 0))
      return;
    e.preventDefault();
    this.audio.unlock();

    const onMove = (ev) => this.onPointerMove(ev);
    const onUp = (ev) => this.onPointerUp(ev);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    this.drag = {
      tile,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      origin: { place: tile.place, cell: tile.cell },
      cleanup: () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      },
    };
  }

  onPointerMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;

    if (!d.moved) {
      if (
        Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD
      )
        return;
      this.beginDrag(d);
    }

    d.tile.el.style.left = `${e.clientX}px`;
    d.tile.el.style.top = `${e.clientY}px`;
    this.previewAt(d.tile, e.clientX, e.clientY);
  }

  /** Lifts the tile off the board / out of the tray into the drag layer. */
  beginDrag(d) {
    d.moved = true;
    const { tile } = d;
    this.setSelected(null);
    if (tile.place === "board") {
      this.grid.remove(tile.id);
      tile.place = "drag";
      this.evaluate(); // neighbours lose their bonds immediately
    }
    tile.place = "drag";
    tile.el.classList.add("is-dragging");
    tile.el.classList.remove("on-board");
    applyTileStatus(tile.el, tile.element, {
      stable: false,
      filled: 0,
      bond: this.level.bond,
    });
    this.dom.dragLayer.append(tile.el);
    this.audio.play("pickup");
  }

  onPointerUp(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    d.cleanup();
    this.drag = null;
    this.hideHighlight();

    if (!d.moved) {
      this.onTap(d.tile);
      return;
    }

    d.tile.el.classList.remove("is-dragging");
    const cell =
      e.type === "pointercancel"
        ? null
        : this.cellAtClient(e.clientX, e.clientY);
    if (cell && !this.grid.isOccupied(cell)) {
      this.placeOnBoard(d.tile, cell);
      return;
    }

    // Invalid drop: back to the cell it came from if still free, else the tray.
    if (d.origin.place === "board" && !this.grid.isOccupied(d.origin.cell)) {
      this.placeOnBoard(d.tile, d.origin.cell, { quiet: true });
    } else {
      this.moveToTray(d.tile);
      this.evaluate();
      if (cell) this.audio.play("error");
    }
  }

  cancelDrag() {
    const d = this.drag;
    if (!d) return;
    d.cleanup();
    this.drag = null;
    this.hideHighlight();
    if (d.moved) {
      d.tile.el.classList.remove("is-dragging");
      this.moveToTray(d.tile);
    }
  }

  onTap(tile) {
    if (tile.place === "board") {
      this.returnTile(tile);
      return;
    }
    this.setSelected(this.selectedId === tile.id ? null : tile.id);
    if (this.selectedId)
      this.message(t("game.selected", { el: localized(tile.element.name) }));
  }

  setSelected(id) {
    this.selectedId = id;
    this.tiles.forEach((tile) => {
      tile.el.classList.toggle("is-selected", tile.id === id);
    });
    this.dom.stage.classList.toggle("has-selection", Boolean(id));
  }

  // ===================================================================== input: board

  bindBoardInput() {
    const { stage } = this.dom;
    // Tap-to-place: with a tray tile selected, a tap on the board places it.
    stage.addEventListener("click", (e) => {
      if (this.locked || !this.selectedId || e.target.closest(".tile")) return;
      const cell = this.cellAtClient(e.clientX, e.clientY);
      if (!cell || this.grid.isOccupied(cell)) {
        this.audio.play("error");
        return;
      }
      const tile = this.tiles.get(this.selectedId);
      this.setSelected(null);
      this.placeOnBoard(tile, cell);
    });
    // Hover highlight for the selected tile.
    stage.addEventListener("pointermove", (e) => {
      if (this.drag || !this.selectedId) return;
      const cell = this.cellAtClient(e.clientX, e.clientY);
      if (cell && !this.grid.isOccupied(cell)) this.showHighlight(cell);
      else this.hideHighlight();
    });
    stage.addEventListener("pointerleave", () => {
      if (!this.drag) this.hideHighlight();
    });
  }

  /** Board cell under a viewport point, or null. */
  cellAtClient(clientX, clientY) {
    const rect = this.dom.stage.getBoundingClientRect();
    return this.grid.nearestCell(clientX - rect.left, clientY - rect.top, 0.9);
  }

  /**
   * While dragging: highlight the target cell and lean the tile's electrons
   * towards any partner tiles that would become its neighbours.
   */
  previewAt(tile, clientX, clientY) {
    const cell = this.cellAtClient(clientX, clientY);
    if (!cell || this.grid.isOccupied(cell)) {
      this.hideHighlight();
      applyElectrons(tile.el, layoutElectrons(tile.element));
      return;
    }
    this.showHighlight(cell);

    const partnerRole = tile.element.role === "donor" ? "acceptor" : "donor";
    const lean = [];
    for (let d = 0; d < 6; d++) {
      const id = this.grid.tileAt(neighbor(cell, d));
      if (id && this.tiles.get(id).element.role === partnerRole) lean.push(d);
    }
    applyElectrons(tile.el, layoutElectrons(tile.element, { lean }));
  }

  showHighlight(cell) {
    this.highlight.setAttribute("points", this.grid.polygonPoints(cell, 0.94));
    this.highlight.classList.add("is-visible");
  }

  hideHighlight() {
    this.highlight.classList.remove("is-visible");
  }

  // ===================================================================== moving tiles

  placeOnBoard(tile, cell, { quiet = false } = {}) {
    if (!this.grid.place(tile.id, cell)) return false;
    tile.place = "board";
    tile.cell = cell;
    tile.el.classList.remove("is-selected", "is-dragging");
    tile.el.classList.add("on-board");
    this.dom.tileLayer.append(tile.el);
    this.positionOnBoard(tile);

    // Retrigger the "snap" pop animation.
    tile.el.classList.remove("pop");
    void tile.el.offsetWidth;
    tile.el.classList.add("pop");

    if (!quiet) this.audio.play("snap");
    const report = this.evaluate();
    if (!quiet) {
      this.message(
        t("game.placed", {
          el: localized(tile.element.name),
          pct: Math.round(report.stability * 100),
        }),
      );
    }
    return true;
  }

  /** Sends a tile back to the tray, keeping the tray's original order. */
  moveToTray(tile, animate = true) {
    if (tile.place === "board") this.grid.remove(tile.id);
    tile.place = "tray";
    tile.cell = null;
    tile.el.classList.remove("on-board", "is-dragging", "is-selected");
    tile.el.style.left = "";
    tile.el.style.top = "";
    const next = [...this.dom.tray.children].find(
      (child) => Number(child.dataset.order) > tile.order,
    );
    this.dom.tray.insertBefore(tile.el, next ?? null);
    applyElectrons(tile.el, layoutElectrons(tile.element));
    applyTileStatus(tile.el, tile.element, {
      stable: false,
      filled: 0,
      bond: this.level.bond,
    });
    if (animate) {
      tile.el.classList.remove("pop");
      void tile.el.offsetWidth;
      tile.el.classList.add("pop");
    }
  }

  returnTile(tile) {
    this.moveToTray(tile);
    this.audio.play("pickup");
    this.evaluate();
    this.message(t("game.returned", { el: localized(tile.element.name) }));
    tile.el.focus({ preventScroll: true });
  }

  /**
   * Keyboard placement: next to the first partner tile with a free edge, or the
   * most central free cell when the board has no partner yet.
   */
  autoPlace(tile) {
    const partnerRole = tile.element.role === "donor" ? "acceptor" : "donor";
    for (const other of this.tiles.values()) {
      if (other.place !== "board" || other.element.role !== partnerRole)
        continue;
      for (let d = 0; d < 6; d++) {
        const cell = neighbor(other.cell, d);
        if (this.grid.isValid(cell) && !this.grid.isOccupied(cell)) {
          this.placeOnBoard(tile, cell);
          tile.el.focus({ preventScroll: true });
          return;
        }
      }
    }
    const centre = {
      x: this.dom.stage.clientWidth / 2,
      y: this.dom.stage.clientHeight / 2,
    };
    const free = [...this.grid.cells.values()]
      .filter((c) => !this.grid.isOccupied(c))
      .sort((a, b) => {
        const pa = this.grid.toPixel(a),
          pb = this.grid.toPixel(b);
        return (
          Math.hypot(pa.x - centre.x, pa.y - centre.y) -
          Math.hypot(pb.x - centre.x, pb.y - centre.y)
        );
      });
    if (free.length) {
      this.placeOnBoard(tile, free[0]);
      tile.el.focus({ preventScroll: true });
    }
  }

  // ===================================================================== validation

  /** Re-checks the whole board and pushes the result to tiles, links and listeners. */
  evaluate() {
    const placed = [...this.tiles.values()]
      .filter((tile) => tile.place === "board")
      .map((tile) => ({ id: tile.id, cell: tile.cell, element: tile.element }));

    const report = evaluateBoard(placed, this.level);
    this.lastReport = report;

    // Tiles: electron positions + stable/partial styling.
    for (const tile of this.tiles.values()) {
      if (tile.place !== "board") continue;
      const state = report.tileState.get(tile.id);
      applyElectrons(
        tile.el,
        layoutElectrons(tile.element, { links: state.links }),
      );
      applyTileStatus(tile.el, tile.element, {
        stable: state.stable,
        filled: state.filled,
        bond: this.level.bond,
      });
    }
    this.drawLinks();
    this.updateTileLabels();

    // Sounds and messages for newly stable groups.
    const stableNow = report.molecules.filter((m) => m.stable).length;
    if (stableNow > this.stableGroups && !report.satisfied) {
      this.audio.play("bond");
      const wrong = report.molecules.find((m) => m.stable && m.units === 0);
      if (wrong)
        this.message(
          t("game.wrongCompound", { formula: this.level.formula }),
          true,
        );
    }
    this.stableGroups = stableNow;

    this.dispatchEvent(
      new CustomEvent("evaluate", { detail: { report, level: this.level } }),
    );

    if (report.satisfied && !this.locked) {
      this.locked = true;
      this.setSelected(null);
      this.dom.stage.classList.add("is-complete");
      this.dispatchEvent(
        new CustomEvent("win", { detail: { report, level: this.level } }),
      );
    } else if (!report.satisfied) {
      this.dom.stage.classList.remove("is-complete");
    }
    return report;
  }

  /** Glowing lines between bonded tile centres (thicker for more electrons). */
  drawLinks() {
    this.linkGroup.innerHTML = "";
    const report = this.lastReport;
    if (!report) return;
    for (const tile of this.tiles.values()) {
      if (tile.place !== "board" || tile.element.role !== "donor") continue;
      const state = report.tileState.get(tile.id);
      if (!state) continue;
      const from = this.grid.toPixel(tile.cell);
      for (const link of state.links) {
        const angle = (DIRECTION_ANGLES[link.dir] * Math.PI) / 180;
        const len = this.grid.size * Math.sqrt(3);
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", from.x);
        line.setAttribute("y1", from.y);
        line.setAttribute("x2", from.x + len * Math.cos(angle));
        line.setAttribute("y2", from.y + len * Math.sin(angle));
        line.setAttribute("class", `link ${state.stable ? "is-stable" : ""}`);
        line.style.setProperty("--w", String(2 + link.count * 2));
        this.linkGroup.append(line);
      }
    }
  }

  /** Accessible names for every tile, refreshed on language change. */
  updateTileLabels() {
    for (const tile of this.tiles.values()) {
      const { element } = tile;
      const what =
        element.role === "donor"
          ? t("game.pegs", { n: element.valency })
          : t("game.slots", { n: element.valency });
      tile.el.setAttribute(
        "aria-label",
        `${localized(element.name)} (${element.symbol}), ${what}`,
      );
    }
  }

  message(text, warn = false) {
    this.dispatchEvent(new CustomEvent("message", { detail: { text, warn } }));
  }
}
