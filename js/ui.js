/**
 * ui.js
 * Screen switching, accessible modals, toasts and HUD rendering.
 * Everything here is presentation: it reads state and writes DOM.
 */

import { ELEMENTS, LEVELS } from './data.js';
import { chemHTML } from './equation.js';
import { localized, t } from './localization.js';

const $ = (sel, root = document) => root.querySelector(sel);

// ======================================================================= screens

/** Shows one <section data-screen> and hides the rest. */
export function showScreen(name) {
  document.querySelectorAll('section[data-screen]').forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });
  document.body.dataset.view = name;
  const heading = $(`[data-screen="${name}"] [data-autofocus]`);
  heading?.focus({ preventScroll: true });
}

// ======================================================================= modals

const FOCUSABLE = 'button:not([disabled]):not([hidden]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const openStack = [];

/**
 * Opens a modal (<div class="modal" hidden role="dialog" aria-modal="true">).
 * Traps focus, closes on Escape / backdrop click when dismissible, and returns
 * focus to the element that opened it.
 */
export function openModal(modal, { dismissible = true, initialFocus } = {}) {
  if (!modal.hidden) return;
  const record = { modal, dismissible, returnTo: document.activeElement };

  record.onKey = (e) => {
    if (openStack[openStack.length - 1] !== record) return;
    if (e.key === 'Escape' && dismissible) {
      e.preventDefault();
      closeModal(modal);
    } else if (e.key === 'Tab') {
      // The top bar (language + audio) stays reachable while a modal is open.
      const items = [...document.querySelectorAll('.topbar-controls button'), ...modal.querySelectorAll(FOCUSABLE)]
        .filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  record.onBackdrop = (e) => { if (dismissible && e.target === modal) closeModal(modal); };

  document.addEventListener('keydown', record.onKey);
  modal.addEventListener('click', record.onBackdrop);
  openStack.push(record);

  modal.hidden = false;
  modal.classList.remove('is-closing');
  document.body.classList.add('has-modal');
  (initialFocus ?? modal.querySelector(FOCUSABLE))?.focus({ preventScroll: true });
}

export function closeModal(modal) {
  const i = openStack.findIndex((r) => r.modal === modal);
  if (i < 0) return;
  const [record] = openStack.splice(i, 1);
  document.removeEventListener('keydown', record.onKey);
  modal.removeEventListener('click', record.onBackdrop);
  modal.hidden = true;
  if (!openStack.length) document.body.classList.remove('has-modal');
  record.returnTo?.focus?.({ preventScroll: true });
}

// ======================================================================= toast + live region

let toastTimer = 0;

/** Short message at the bottom of the screen; also read out by screen readers. */
export function toast(text, { warn = false } = {}) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.toggle('is-warn', warn);
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

/** Polite announcement for assistive tech only. */
export function announce(text) {
  const el = $('#live');
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = text; });
}

// ======================================================================= level select

/**
 * Renders the level cards.
 * @param {HTMLElement} container
 * @param {{unlocked:number, completed:Set<string>}} progress
 * @param {(index:number) => void} onPick
 */
export function renderLevelSelect(container, progress, onPick) {
  container.innerHTML = LEVELS.map((level, i) => {
    const locked = i >= progress.unlocked;
    const done = progress.completed.has(level.id);
    const cation = ELEMENTS[level.cation];
    const anion = ELEMENTS[level.anion];
    return `<li>
      <button type="button" class="level-card ${locked ? 'is-locked' : ''} ${done ? 'is-done' : ''}" data-level="${i}" ${locked ? 'disabled' : ''}
        style="--a:${cation.color}; --b:${anion.color}">
        <span class="level-num">${t('levels.level', { n: i + 1 })}</span>
        <span class="level-formula">${chemHTML(level.formula)}</span>
        <span class="level-name">${localized(level.title)}</span>
        <span class="level-meta">
          <span class="bond-pill is-${level.bond}">${t(level.bond === 'ionic' ? 'levels.ionic' : 'levels.covalent')}</span>
          <span class="level-state">${locked ? t('levels.locked') : done ? `✓ ${t('levels.done')}` : ''}</span>
        </span>
      </button>
    </li>`;
  }).join('');
  container.querySelectorAll('[data-level]').forEach((btn) => {
    btn.addEventListener('click', () => onPick(Number(btn.dataset.level)));
  });
}

// ======================================================================= HUD

/** Static header + objectives text for a level. */
export function renderLevelHeader(level, index) {
  const cation = ELEMENTS[level.cation];
  const anion = ELEMENTS[level.anion];
  const ionic = level.bond === 'ionic';
  const ion = (el) => (ionic ? `${el.symbol}${el.valency > 1 ? el.valency : ''}${el.role === 'donor' ? '+' : '-'}` : el.symbol);
  const count = (n) => (n > 1 ? `${n} × ` : '');

  $('#hud-level').textContent = t('game.level', { n: index + 1 });
  $('#hud-title').textContent = localized(level.title);
  $('#hud-equation').innerHTML = chemHTML(level.equation);
  $('#hud-bond').textContent = t(ionic ? 'game.bondIonic' : 'game.bondCovalent');
  $('#hud-bond').className = `bond-pill is-${level.bond}`;

  $('#obj-cation-text').innerHTML = chemHTML(
    t(ionic ? 'game.objCation' : 'game.objSharer', { ion: count(level.cationCount) + ion(cation) }),
  );
  $('#obj-anion-text').innerHTML = chemHTML(
    t(ionic ? 'game.objAnion' : 'game.objCentral', { ion: count(level.anionCount) + ion(anion) }),
  );
  $('#obj-formula-text').innerHTML = chemHTML(t('game.objFormula', { formula: level.formula }));
}

/** Live parts of the HUD: objective ticks and the stability ring. */
export function renderReport(level, report) {
  const units = Math.max(1, report.unitsRequired);
  setTick('#obj-cation', report.cationsPlaced >= level.cationCount * units);
  setTick('#obj-anion', report.anionsPlaced >= level.anionCount * units);
  setTick('#obj-formula', report.satisfied);

  const pct = Math.round(report.stability * 100);
  const ring = $('#stability-ring');
  ring.style.setProperty('--p', String(report.stability));
  ring.classList.toggle('is-full', pct === 100);
  $('#stability-value').textContent = `${pct}%`;
  $('#stability-meter').setAttribute('aria-valuenow', String(pct));
}

function setTick(selector, done) {
  const row = $(selector);
  row.classList.toggle('is-done', done);
  row.setAttribute('aria-checked', String(done));
}

// ======================================================================= hint modal content

/** Level-specific hint plus the general bonding rules. */
export function renderHintPanels(level) {
  const cation = ELEMENTS[level.cation];
  const anion = ELEMENTS[level.anion];
  $('#hint-level').innerHTML = `
    <p class="eyebrow">${t('hint.target')}</p>
    <p class="hint-target">${chemHTML(level.formula)} <span>${localized(level.title)}</span></p>
    <p class="hint-text">${chemHTML(localized(level.hint))}</p>
    <div class="hint-atoms">
      ${[cation, anion].map((el) => `
        <div class="hint-atom" style="--el:${el.color}">
          <span class="hint-symbol">${el.symbol}</span>
          <span>${localized(el.name)} · ${el.config.join('.')}</span>
          <span>${t(el.role === 'donor' ? 'game.pegs' : 'game.slots', { n: el.valency })}</span>
        </div>`).join('')}
    </div>`;
  $('#hint-rules').innerHTML = `<ol class="rules-list">${[1, 2, 3, 4, 5, 6].map((n) => `<li>${chemHTML(t(`rules.${n}`))}</li>`).join('')}</ol>`;
}

/** Simple accessible tabs: [role=tab][aria-controls] inside a [role=tablist]. */
export function setupTabs(tablist) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    tabs.forEach((other) => {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next);
      next.focus();
    });
  });
  return { select: (index) => select(tabs[index]) };
}
