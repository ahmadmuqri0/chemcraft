/**
 * synthesis.js
 * The post-synthesis popup: a step-by-step, animated walk through the chemistry
 * of the compound the player just built.
 *
 * Ionic levels   1 Electron arrangement  2 Electron transfer (dot-and-cross animation)
 *                3 Charge balance        4 Formula (cross-over)   5 Balanced equation
 * Covalent levels 1 Electron arrangement 2 Electron sharing (shared-pair animation)
 *                3 Stability check (octet/duplet)  4 Formula      5 Balanced equation
 *
 * Every step is rebuilt from the level data, so it re-renders instantly when the
 * language changes. Animations use the Web Animations API and honour
 * prefers-reduced-motion.
 */

import {
  ELEMENTS,
  electronTotal,
  ionConfig,
  NOBLE_GAS_BY_ELECTRONS,
} from "./data.js";
import { atomTable, chemHTML, gcd, parseEquation } from "./equation.js";
import { localized, t } from "./localization.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const duration = (ms) => (reducedMotion() ? 1 : ms);

/** "Mg2+" style ion text for chemHTML. */
const ionText = (el) =>
  `${el.symbol}${el.valency > 1 ? el.valency : ""}${el.role === "donor" ? "+" : "-"}`;
/** Signed charge, e.g. +2 / -1. */
const charge = (el) => (el.role === "donor" ? el.valency : -el.valency);
const signed = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const valenceCount = (el) => el.config[el.config.length - 1];

// =========================================================================
// Small SVG helpers
// =========================================================================

function svgEl(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
}

/** An electron marker: a cross for the giving atom, a dot for the receiving atom. */
function electronMarker(parent, x, y, kind, color) {
  const outer = svgEl(
    "g",
    { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` },
    parent,
  );
  const mover = svgEl("g", { class: `ex ex-${kind}` }, outer);
  if (kind === "cross") {
    svgEl(
      "path",
      {
        d: "M-5,-5L5,5M5,-5L-5,5",
        stroke: color,
        "stroke-width": 3,
        "stroke-linecap": "round",
        fill: "none",
      },
      mover,
    );
  } else {
    svgEl("circle", { r: 5, fill: color }, mover);
  }
  return { outer, mover, x, y };
}

/** Eight Lewis positions around a ring: pairs either side of 0, 90, 180, 270 degrees. */
function lewisSlots(cx, cy, radius) {
  const slots = [];
  for (const base of [0, 90, 180, 270]) {
    for (const off of [-16, 16]) {
      const a = ((base + off) * Math.PI) / 180;
      slots.push({
        angle: base + off,
        x: cx + radius * Math.cos(a),
        y: cy + radius * Math.sin(a),
      });
    }
  }
  return slots;
}

/** Angular distance between two angles in degrees (0..180). */
const angleGap = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/** Moves a marker to (x, y) in scene units. Resolves when finished. */
function flyTo(marker, x, y, delay, ms = 1100) {
  const dx = x - marker.x;
  const dy = y - marker.y;
  const anim = marker.mover.animate(
    [
      { transform: "translate(0px, 0px)" },
      { transform: `translate(${dx}px, ${dy}px)` },
    ],
    {
      duration: duration(ms),
      delay: reducedMotion() ? 0 : delay,
      easing: "cubic-bezier(.55,0,.25,1)",
      fill: "forwards",
    },
  );
  return anim.finished.catch(() => {});
}

// =========================================================================
// Bohr diagram (step 1)
// =========================================================================

/**
 * Full shell diagram. Valence electrons get the "valence" class; acceptors also
 * show their vacancies as dashed rings.
 */
function bohrSVG(el) {
  const shells = el.config;
  const outerR = 22 + 16 * shells.length;
  const size = outerR * 2 + 24;
  const c = size / 2;
  const svg = svgEl("svg", {
    viewBox: `0 0 ${size} ${size}`,
    class: "bohr",
    role: "img",
    "aria-label": `${el.symbol} ${shells.join(".")}`,
  });

  shells.forEach((count, i) => {
    const r = 22 + 16 * (i + 1);
    const isValence = i === shells.length - 1;
    svgEl("circle", { cx: c, cy: c, r, class: "shell" }, svg);
    const capacity =
      isValence && el.role === "acceptor" ? count + el.valency : count;
    for (let k = 0; k < capacity; k++) {
      const a = ((360 / capacity) * k - 90) * (Math.PI / 180);
      const x = c + r * Math.cos(a);
      const y = c + r * Math.sin(a);
      if (k < count) {
        svgEl(
          "circle",
          {
            cx: x,
            cy: y,
            r: 4.2,
            class: isValence ? "e-valence" : "e-core",
            style: `--el:${el.color}`,
          },
          svg,
        );
      } else {
        svgEl("circle", { cx: x, cy: y, r: 4.6, class: "e-vacancy" }, svg);
      }
    }
  });
  svgEl(
    "circle",
    { cx: c, cy: c, r: 20, class: "nucleus", style: `--el:${el.color}` },
    svg,
  );
  const label = svgEl("text", { x: c, y: c + 6, class: "nucleus-label" }, svg);
  label.textContent = el.symbol;
  return svg;
}

// =========================================================================
// Steps
// =========================================================================

function stepConfig(level) {
  const cation = ELEMENTS[level.cation];
  const anion = ELEMENTS[level.anion];
  const ionic = level.bond === "ionic";

  const card = (el) => {
    const key = ionic
      ? el.role === "donor"
        ? "s.config.donorIonic"
        : "s.config.acceptorIonic"
      : el.role === "donor"
        ? "s.config.donorCov"
        : "s.config.acceptorCov";
    const sentence = t(key, {
      name: localized(el.name),
      cfg: el.config.join("."),
      v: el.valency,
      ion: ionText(el),
      ioncfg: ionConfig(el),
    });
    const result = ionic ? chemHTML(`${ionText(el)}`) : chemHTML(el.symbol);
    return `<article class="atom-card" style="--el:${el.color}">
        <div class="atom-figure" data-bohr="${el.symbol}"></div>
        <div class="atom-arrow" aria-hidden="true">
          <span class="arrow-line"></span>
          <span class="atom-result"><span>${result}</span><small>${ionConfig(el)}</small></span>
        </div>
        <p>${chemHTML(sentence)}</p>
      </article>`;
  };

  const gases = [cation, anion]
    .map((el) => {
      const gas = NOBLE_GAS_BY_ELECTRONS[electronTotal(ionConfig(el))] ?? "";
      return `${ionic ? ionText(el) : el.symbol} → ${gas} (${ionConfig(el)})`;
    })
    .join(", ");

  return {
    title: t("s.config.title"),
    html: `<div class="atom-cards">${card(cation)}${card(anion)}</div>
           <p class="step-note">${chemHTML(t("s.config.noble", { gases }))}</p>`,
    mount(root) {
      root.querySelectorAll("[data-bohr]").forEach((slot) => {
        slot.append(bohrSVG(ELEMENTS[slot.dataset.bohr]));
      });
    },
  };
}

/** Ionic: animated dot-and-cross transfer from every cation to every anion. */
function stepTransfer(level) {
  const cation = ELEMENTS[level.cation];
  const anion = ELEMENTS[level.anion];
  const cn = level.cationCount;
  const an = level.anionCount;
  const total = cn * cation.valency;

  return {
    title: t("s.transfer.title"),
    html: `<p class="step-lead">${chemHTML(t("s.transfer.body", { cn, cation: cation.symbol, an, anion: anion.symbol, total }))}</p>
           <div class="scene" data-scene></div>
           <p class="scene-legend">${chemHTML(t("s.transfer.legend", { cation: cation.symbol, anion: anion.symbol }))}</p>`,
    mount(root) {
      const host = root.querySelector("[data-scene]");
      const rows = Math.max(cn, an);
      const H = rows * 165 + 40;
      const svg = svgEl("svg", {
        viewBox: `0 0 640 ${H}`,
        class: "scene-svg",
        role: "img",
        "aria-label": t("s.transfer.body", {
          cn,
          cation: cation.symbol,
          an,
          anion: anion.symbol,
          total,
        }),
      });
      host.append(svg);

      const R = 50;
      // Each atom gets an equal band; the top 40 units hold the first ion label.
      const yFor = (i, n) => 40 + ((H - 40) * (i + 0.5)) / n;
      const atoms = (n, x, el) =>
        Array.from({ length: n }, (_, i) => {
          const cy = yFor(i, n);
          const g = svgEl(
            "g",
            { class: `scene-atom ${el.role}`, style: `--el:${el.color}` },
            svg,
          );
          svgEl("circle", { cx: x, cy, r: R, class: "ring" }, g);
          svgEl("circle", { cx: x, cy, r: 26, class: "core" }, g);
          const label = svgEl("text", { x, y: cy + 7, class: "core-label" }, g);
          label.textContent = el.symbol;
          const ion = svgEl(
            "text",
            { x, y: cy - R - 12, class: "ion-label" },
            g,
          );
          // ion label is filled in after the transfer animation
          if (el.role === "acceptor") {
            svgEl(
              "path",
              {
                d: `M${x - R - 14},${cy - R - 4} h-6 v${2 * R + 8} h6 M${x + R + 14},${cy - R - 4} h6 v${2 * R + 8} h-6`,
                class: "bracket",
              },
              g,
            );
          }
          return { g, cx: x, cy, el, ion, slots: lewisSlots(x, cy, R) };
        });

      const cations = atoms(cn, 170, cation);
      const anions = atoms(an, 470, anion);

      // Donor electrons: crosses on the side facing the anions.
      const crosses = [];
      cations.forEach((atom) => {
        const slots = [...atom.slots].sort(
          (a, b) => angleGap(a.angle, 0) - angleGap(b.angle, 0),
        );
        for (let k = 0; k < cation.valency; k++)
          crosses.push(
            electronMarker(
              svg,
              slots[k].x,
              slots[k].y,
              "cross",
              "var(--spark)",
            ),
          );
      });

      // Acceptor: own valence electrons as dots facing away; vacancies facing the cations.
      const vacancies = [];
      anions.forEach((atom) => {
        const byNear = [...atom.slots].sort(
          (a, b) => angleGap(a.angle, 180) - angleGap(b.angle, 180),
        );
        const vac = byNear.slice(0, anion.valency);
        const own = byNear.slice(
          anion.valency,
          anion.valency + valenceCount(anion),
        );
        own.forEach((s) => {
          electronMarker(svg, s.x, s.y, "dot", anion.color);
        });
        vac.forEach((s) => {
          svgEl("circle", { cx: s.x, cy: s.y, r: 6, class: "vacancy" }, svg);
          vacancies.push(s);
        });
      });

      // Greedy pairing: fill anion 1 first, then anion 2, ... (totals always match).
      const flights = crosses.map((cross, i) =>
        flyTo(cross, vacancies[i].x, vacancies[i].y, 300 + i * 420),
      );
      Promise.all(flights).then(() => {
        if (!svg.isConnected) return;
        svg.classList.add("is-ionised");
        [...cations, ...anions].forEach((atom) => {
          atom.ion.textContent = "";
          const label = ionText(atom.el);
          const symbol = svgEl("tspan", {}, atom.ion);
          symbol.textContent = label.replace(/\d?[+-]$/, "");
          const sup = svgEl(
            "tspan",
            { "baseline-shift": "super", class: "ion-charge" },
            atom.ion,
          );
          sup.textContent = label
            .slice(symbol.textContent.length)
            .replace("-", "−");
        });
      });
    },
  };
}

/** Covalent: donor electrons and the central atom's unpaired electrons meet in shared pairs. */
function stepShare(level) {
  const donor = ELEMENTS[level.cation]; // H
  const centre = ELEMENTS[level.anion]; // O or N
  const pairs = level.cationCount;

  return {
    title: t("s.share.title"),
    html: `<p class="step-lead">${chemHTML(t("s.share.body", { donor: donor.symbol, anion: centre.symbol, pairs }))}</p>
           <div class="scene" data-scene></div>
           <p class="scene-legend">${chemHTML(t("s.share.legend", { donor: donor.symbol, anion: centre.symbol }))}</p>`,
    mount(root) {
      const host = root.querySelector("[data-scene]");
      const svg = svgEl("svg", {
        viewBox: "0 0 640 320",
        class: "scene-svg",
        role: "img",
        "aria-label": t("s.share.body", {
          donor: donor.symbol,
          anion: centre.symbol,
          pairs,
        }),
      });
      host.append(svg);

      const cx = 320,
        cy = 140,
        R = 52,
        r = 36,
        gap = 74;
      const angles = pairs === 2 ? [180, 0] : [180, 0, 90];
      const centreSlots = lewisSlots(cx, cy, R);
      const used = new Set();

      // Central atom
      const cg = svgEl(
        "g",
        { class: "scene-atom acceptor", style: `--el:${centre.color}` },
        svg,
      );
      svgEl("circle", { cx, cy, r: R, class: "ring" }, cg);
      svgEl("circle", { cx, cy, r: 26, class: "core" }, cg);
      svgEl("text", { x: cx, y: cy + 7, class: "core-label" }, cg).textContent =
        centre.symbol;

      const flights = [];
      angles.forEach((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const ux = Math.cos(a),
          uy = Math.sin(a);
        const hx = cx + gap * ux * 1.4,
          hy = cy + gap * uy * 1.4;
        const g = svgEl(
          "g",
          { class: "scene-atom donor", style: `--el:${donor.color}` },
          svg,
        );
        svgEl("circle", { cx: hx, cy: hy, r, class: "ring" }, g);
        svgEl("circle", { cx: hx, cy: hy, r: 18, class: "core" }, g);
        svgEl(
          "text",
          { x: hx, y: hy + 6, class: "core-label" },
          g,
        ).textContent = donor.symbol;

        // Where the shared pair ends up: between the two rings, side by side.
        const mid = { x: cx + (R + 8) * ux, y: cy + (R + 8) * uy };
        const px = -uy * 7,
          py = ux * 7;
        svgEl(
          "ellipse",
          {
            cx: mid.x,
            cy: mid.y,
            rx: 18,
            ry: 13,
            transform: `rotate(${deg + 90} ${mid.x} ${mid.y})`,
            class: "pair-glow",
          },
          svg,
        );

        // Donor electron starts on the donor ring facing the centre.
        const hStart = { x: hx - r * ux, y: hy - r * uy };
        const cross = electronMarker(
          svg,
          hStart.x,
          hStart.y,
          "cross",
          "var(--spark)",
        );
        flights.push(flyTo(cross, mid.x + px, mid.y + py, 300 + i * 500));

        // Central atom's unpaired electron: the free slot nearest this donor.
        const slot = centreSlots
          .filter((s) => !used.has(s))
          .sort((p, q) => angleGap(p.angle, deg) - angleGap(q.angle, deg))[0];
        used.add(slot);
        const dot = electronMarker(svg, slot.x, slot.y, "dot", centre.color);
        flights.push(flyTo(dot, mid.x - px, mid.y - py, 300 + i * 500));
      });

      // Remaining own electrons of the central atom (lone pairs) stay put.
      const lone = valenceCount(centre) - pairs;
      centreSlots
        .filter((s) => !used.has(s))
        .sort(
          (p, q) =>
            Math.min(...angles.map((d) => angleGap(q.angle, d))) -
            Math.min(...angles.map((d) => angleGap(p.angle, d))),
        )
        .slice(0, lone)
        .forEach((s) => {
          electronMarker(svg, s.x, s.y, "dot", centre.color);
        });

      Promise.all(flights).then(() => {
        if (svg.isConnected) svg.classList.add("is-bonded");
      });
    },
  };
}

function stepCharge(level) {
  const cation = ELEMENTS[level.cation];
  const anion = ELEMENTS[level.anion];
  const cn = level.cationCount;
  const an = level.anionCount;
  const pos = charge(cation) * cn;
  const neg = charge(anion) * an;

  const chip = (html, delay, cls = "") =>
    `<span class="math-chip ${cls}" style="--d:${delay}ms">${html}</span>`;
  return {
    title: t("s.charge.title"),
    html: `<p class="step-lead">${t("s.charge.body")}</p>
      <div class="ion-tally">
        <div class="ion-group" style="--el:${cation.color}">${`<span class="ion-badge">${chemHTML(ionText(cation))}</span>`.repeat(cn)}</div>
        <div class="ion-group" style="--el:${anion.color}">${`<span class="ion-badge">${chemHTML(ionText(anion))}</span>`.repeat(an)}</div>
      </div>
      <div class="math-row" aria-label="(${signed(charge(cation))}) × ${cn} + (${signed(charge(anion))}) × ${an} = 0">
        ${chip(`(${signed(charge(cation))}) × ${cn}`, 0, "pos")}
        ${chip("+", 250, "op")}
        ${chip(`(${signed(charge(anion))}) × ${an}`, 500, "neg")}
        ${chip("=", 750, "op")}
        ${chip(`${signed(pos)} ${neg < 0 ? "−" : "+"} ${Math.abs(neg)}`, 1000)}
        ${chip("=", 1250, "op")}
        ${chip("0", 1500, "result")}
      </div>
      <p class="step-check" style="--d:1800ms">✓ ${t("s.charge.check")}</p>`,
    mount() {},
  };
}

function stepOctet(level) {
  const donor = ELEMENTS[level.cation];
  const centre = ELEMENTS[level.anion];
  const row = (el, own, shared, target, label) => `
    <div class="octet-row" style="--el:${el.color}">
      <span class="octet-symbol">${el.symbol}</span>
      <span class="octet-dots" aria-hidden="true">${'<i class="dot"></i>'.repeat(own)}${'<i class="cross"></i>'.repeat(shared)}</span>
      <span class="octet-sum">${t("s.octet.row", { el: el.symbol, own, shared, total: own + shared })}</span>
      <span class="octet-badge ${own + shared === target ? "ok" : ""}">${own + shared === target ? "✓" : "✗"} ${label}</span>
    </div>`;
  return {
    title: t("s.octet.title"),
    html: `<p class="step-lead">${t("s.octet.body")}</p>
      <div class="octet-table">
        ${row(centre, valenceCount(centre), centre.valency, 8, t("s.octet.octet"))}
        ${row(donor, valenceCount(donor), donor.valency, 2, t("s.octet.duplet"))}
      </div>`,
    mount() {},
  };
}

function stepFormula(level) {
  const cation = ELEMENTS[level.cation];
  const anion = ELEMENTS[level.anion];

  if (level.bond === "covalent") {
    return {
      title: t("s.formula.title"),
      html: `<p class="step-lead">${chemHTML(t("s.formula.cov", { anion: anion.symbol, v: anion.valency, donor: cation.symbol }))}</p>
        <div class="formula-result"><span>${chemHTML(level.formula)}</span></div>
        <p class="step-note">${chemHTML(t("s.formula.ratio", { cation: cation.symbol, anion: anion.symbol, c: level.cationCount, a: level.anionCount }))}</p>`,
      mount() {},
    };
  }

  // Cross-over: the charge number of each ion becomes the count of the other.
  const rawC = anion.valency;
  const rawA = cation.valency;
  const g = gcd(rawC, rawA);
  const simplified = g > 1;
  return {
    title: t("s.formula.title"),
    html: `<p class="step-lead">${t("s.formula.ionic")}</p>
      <div class="crossover" aria-hidden="true">
        <span class="cross-ion" style="--el:${cation.color}">${cation.symbol}<sup>${cation.valency}+</sup></span>
        <svg class="cross-arrows" viewBox="0 0 120 80"><path d="M10,12 C60,12 60,68 110,68" /><path d="M110,12 C60,12 60,68 10,68" /></svg>
        <span class="cross-ion" style="--el:${anion.color}">${anion.symbol}<sup>${anion.valency}−</sup></span>
      </div>
      <div class="formula-steps">
        <span class="formula-chip" style="--d:300ms">${cation.symbol}<sub>${rawC}</sub>${anion.symbol}<sub>${rawA}</sub></span>
        ${simplified ? `<span class="formula-op" style="--d:700ms">→</span><span class="formula-chip" style="--d:900ms">${t("s.formula.simplify", { a: rawC, b: rawA, c: rawC / g, d: rawA / g })}</span>` : ""}
        <span class="formula-op" style="--d:${simplified ? 1300 : 700}ms">→</span>
        <span class="formula-chip is-final" style="--d:${simplified ? 1500 : 900}ms">${chemHTML(level.formula)}</span>
      </div>
      <p class="step-note">${chemHTML(t("s.formula.ratio", { cation: cation.symbol, anion: anion.symbol, c: level.cationCount, a: level.anionCount }))}</p>`,
    mount() {},
  };
}

function stepEquation(level) {
  const equation = parseEquation(level.equation);
  const rows = atomTable(equation);
  const diatomic = equation.reactants
    .map((term) => term.formula)
    .filter((f) => /^[A-Z][a-z]?2$/.test(f));
  const lead = diatomic.length
    ? t("s.eq.diatomic", { list: diatomic.join(", ") })
    : t("s.eq.noDiatomic");

  const term = (tm, delay) =>
    `<span class="eq-term" style="--d:${delay}ms">${tm.coef > 1 ? `<b class="coef">${tm.coef}</b>` : ""}${chemHTML(tm.formula)}</span>`;
  let delay = 0;
  const side = (terms) =>
    terms
      .map(
        (tm, i) =>
          `${i ? `<span class="eq-plus" style="--d:${(delay += 150)}ms">+</span>` : ""}${term(tm, (delay += 150))}`,
      )
      .join("");

  return {
    title: t("s.eq.title"),
    html: `<p class="step-lead">${chemHTML(lead)}</p>
      <div class="equation-big" aria-label="${level.equation}">
        ${side(equation.reactants)}<span class="eq-arrow" style="--d:${(delay += 150)}ms">→</span>${side(equation.products)}
      </div>
      <div class="table-wrap">
        <table class="balance-table">
          <thead><tr><th scope="col">${t("s.eq.element")}</th><th scope="col">${t("s.eq.left")}</th><th scope="col">${t("s.eq.right")}</th><th scope="col"><span class="visually-hidden">${t("s.eq.balanced")}</span></th></tr></thead>
          <tbody>${rows.map((r) => `<tr><th scope="row">${r.symbol}</th><td>${r.left}</td><td>${r.right}</td><td class="${r.balanced ? "ok" : "bad"}">${r.balanced ? "✓" : "✗"}</td></tr>`).join("")}</tbody>
        </table>
      </div>
      <p class="step-check" style="--d:${delay + 300}ms">✓ ${t("s.eq.balanced")}: ${chemHTML(level.equation)}</p>`,
    mount() {},
  };
}

/** Builds the step list for a level. */
export function buildSteps(level) {
  return level.bond === "ionic"
    ? [
        stepConfig(level),
        stepTransfer(level),
        stepCharge(level),
        stepFormula(level),
        stepEquation(level),
      ]
    : [
        stepConfig(level),
        stepShare(level),
        stepOctet(level),
        stepFormula(level),
        stepEquation(level),
      ];
}

// =========================================================================
// Popup controller
// =========================================================================

export class SynthesisPopup {
  /**
   * @param {object} dom   elements from index.html (#synth-*)
   * @param {object} ui    { openModal, closeModal } from ui.js
   * @param {import('./audio.js').AudioManager} audio
   * @param {object} actions { nextLevel(), replay(), menu() }
   */
  constructor(dom, ui, audio, actions) {
    Object.assign(this, { dom, ui, audio, actions });
    this.level = null;
    this.index = 0;
    this.steps = [];

    dom.prev.addEventListener("click", () => this.go(this.index - 1));
    dom.next.addEventListener("click", () => this.go(this.index + 1));
    dom.replay.addEventListener("click", () => this.render());
    dom.nextLevel.addEventListener("click", () => {
      this.close();
      actions.nextLevel();
    });
    dom.again.addEventListener("click", () => {
      this.close();
      actions.replay();
    });
    dom.menu.addEventListener("click", () => {
      this.close();
      actions.menu();
    });
  }

  open(level, { hasNext }) {
    this.level = level;
    this.hasNext = hasNext;
    this.index = 0;
    this.steps = buildSteps(level);
    this.render();
    this.ui.openModal(this.dom.modal, {
      dismissible: false,
      initialFocus: this.dom.next,
    });
  }

  close() {
    this.ui.closeModal(this.dom.modal);
  }

  get isOpen() {
    return !this.dom.modal.hidden;
  }

  go(index) {
    if (index < 0 || index >= this.steps.length) return;
    this.index = index;
    this.audio.play("step");
    this.render();
  }

  /** Re-renders the current step (also used on language change and Replay). */
  render() {
    if (!this.level) return;
    this.steps = buildSteps(this.level); // fresh text in the current language
    const step = this.steps[this.index];
    const last = this.index === this.steps.length - 1;
    const { dom } = this;

    dom.type.textContent = t(
      this.level.bond === "ionic" ? "synth.ionicType" : "synth.covalentType",
    );
    dom.title.innerHTML = `${t("synth.title")}: <span class="synth-formula">${chemHTML(this.level.formula)}</span>`;
    dom.count.textContent = t("synth.step", {
      n: this.index + 1,
      total: this.steps.length,
    });

    dom.dots.innerHTML = this.steps
      .map(
        (s, i) => `
      <li><button type="button" class="synth-dot ${i === this.index ? "is-current" : ""} ${i < this.index ? "is-done" : ""}"
        data-step="${i}" aria-label="${i + 1}. ${s.title}" ${i === this.index ? 'aria-current="step"' : ""}>
        <span>${i + 1}</span><em>${s.title}</em></button></li>`,
      )
      .join("");
    dom.dots.querySelectorAll("[data-step]").forEach((b) => {
      b.addEventListener("click", () => this.go(Number(b.dataset.step)));
    });

    dom.stage.innerHTML = `<h3 class="step-title">${step.title}</h3><div class="step-body">${step.html}</div>`;
    step.mount(dom.stage);

    dom.prev.disabled = this.index === 0;
    dom.next.hidden = last;
    dom.finale.hidden = !last;
    dom.nextLevel.hidden = !this.hasNext;
    dom.allDone.hidden = !(last && !this.hasNext);
  }
}
