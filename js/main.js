/**
 * main.js
 * Entry point. Creates the services (audio, game, popup), wires buttons to
 * screens, keeps progress, and re-renders text when the language changes.
 *
 * Module map
 *   hex.js          axial hex math            grid.js        board geometry + occupancy
 *   validator.js    max-flow bond checking    data.js        elements + levels
 *   equation.js     formula parsing/format    tiles.js       tile DOM + dynamic electrons
 *   game.js         drag/drop + level runtime synthesis.js   step-by-step popup
 *   localization.js EN/BM dictionary          notes.js       Chapter 5 notes
 *   audio.js        BGM + SFX manager         ui.js          screens, modals, HUD
 *   storage.js      safe localStorage
 */

import { AudioManager } from './audio.js';
import { LEVELS } from './data.js';
import { Game } from './game.js';
import { applyI18n, getLang, onLangChange, setLang, t } from './localization.js';
import { renderNotes } from './notes.js';
import { load, save } from './storage.js';
import { SynthesisPopup } from './synthesis.js';
import {
  announce, closeModal, openModal, renderHintPanels, renderLevelHeader, renderLevelSelect,
  renderReport, setupTabs, showScreen, toast,
} from './ui.js';

const $ = (id) => document.getElementById(id);

// =========================================================================
// Progress (per browser)
// =========================================================================

const progress = (() => {
  const saved = load('progress', null);
  return {
    unlocked: Math.min(LEVELS.length, Math.max(1, saved?.unlocked ?? 1)),
    completed: new Set(saved?.completed ?? []),
  };
})();

function saveProgress() {
  save('progress', { unlocked: progress.unlocked, completed: [...progress.completed] });
}

function completeLevel(index) {
  progress.completed.add(LEVELS[index].id);
  progress.unlocked = Math.min(LEVELS.length, Math.max(progress.unlocked, index + 2));
  saveProgress();
}

// =========================================================================
// Services
// =========================================================================

const audio = new AudioManager();

const game = new Game({
  stage: $('board-stage'),
  svg: $('board-svg'),
  tileLayer: $('tile-layer'),
  tray: $('tray'),
  dragLayer: $('drag-layer'),
}, audio);

const synthesis = new SynthesisPopup({
  modal: $('synth-modal'),
  type: $('synth-type'),
  title: $('synth-title'),
  dots: $('synth-dots'),
  stage: $('synth-stage'),
  count: $('synth-count'),
  prev: $('synth-prev'),
  next: $('synth-next'),
  replay: $('synth-replay'),
  finale: $('synth-finale'),
  nextLevel: $('synth-next-level'),
  again: $('synth-again'),
  menu: $('synth-menu'),
  allDone: $('synth-all-done'),
}, { openModal, closeModal }, audio, {
  nextLevel: () => startLevel(currentIndex + 1),
  replay: () => startLevel(currentIndex),
  menu: () => goMenu(),
});

let currentIndex = 0;

// =========================================================================
// Screens
// =========================================================================

function goMenu() {
  renderMenu();
  showScreen('menu');
}

function goLevels() {
  renderLevelSelect($('level-list'), progress, startLevel);
  showScreen('levels');
}

function goNotes() {
  showScreen('notes');
}

function startLevel(index) {
  if (index < 0 || index >= LEVELS.length || index >= progress.unlocked) return;
  currentIndex = index;
  const level = LEVELS[index];
  showScreen('game');
  renderLevelHeader(level, index);
  renderHintPanels(level);
  game.load(level);
}

function renderMenu() {
  const next = Math.min(progress.unlocked, LEVELS.length) - 1;
  const fresh = progress.completed.size === 0;
  $('btn-play-label').textContent = fresh ? t('menu.play') : t('menu.continue', { n: next + 1 });
  $('menu-progress').textContent = t('menu.progress', { n: progress.unlocked, total: LEVELS.length });
  $('menu-progress-bar').style.setProperty('--p', String(progress.unlocked / LEVELS.length));
}

// =========================================================================
// Game events
// =========================================================================

game.addEventListener('evaluate', (e) => renderReport(e.detail.level, e.detail.report));

game.addEventListener('message', (e) => {
  announce(e.detail.text);
  if (e.detail.warn) toast(e.detail.text, { warn: true });
});

game.addEventListener('win', () => {
  completeLevel(currentIndex);
  audio.play('success');
  // Let the player see the green glow before the popup opens.
  setTimeout(() => {
    if (document.body.dataset.view !== 'game') return;
    synthesis.open(LEVELS[currentIndex], { hasNext: currentIndex + 1 < LEVELS.length });
  }, 900);
});

// =========================================================================
// Buttons
// =========================================================================

$('btn-play').addEventListener('click', () => startLevel(Math.min(progress.unlocked, LEVELS.length) - 1));
$('btn-levels').addEventListener('click', goLevels);
$('btn-notes').addEventListener('click', goNotes);
document.querySelectorAll('[data-go="menu"]').forEach((b) => b.addEventListener('click', goMenu));

$('btn-game-menu').addEventListener('click', goMenu);
$('btn-clear').addEventListener('click', () => game.clearBoard());

const hintTabs = setupTabs($('hint-tabs'));
$('btn-hint').addEventListener('click', () => {
  hintTabs.select(0);
  openModal($('hint-modal'));
});
$('hint-close').addEventListener('click', () => closeModal($('hint-modal')));

// Reset progress: two taps, because the viewer cannot show confirm() dialogs.
let resetArmed = 0;
$('btn-reset').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (!resetArmed) {
    btn.textContent = t('menu.resetConfirm');
    btn.classList.add('is-armed');
    resetArmed = setTimeout(() => {
      resetArmed = 0;
      btn.textContent = t('menu.reset');
      btn.classList.remove('is-armed');
    }, 3000);
    return;
  }
  clearTimeout(resetArmed);
  resetArmed = 0;
  progress.unlocked = 1;
  progress.completed.clear();
  saveProgress();
  btn.textContent = t('menu.reset');
  btn.classList.remove('is-armed');
  renderMenu();
  toast(t('menu.resetDone'));
});

// =========================================================================
// Language toggle (EN | BM)
// =========================================================================

function syncLangButtons() {
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
}

document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

onLangChange(() => {
  syncLangButtons();
  renderMenu();
  renderNotes($('notes-content'));
  renderNotes($('hint-notes'), { prefix: 'm-' });
  if (!$('levels-screen').hidden) renderLevelSelect($('level-list'), progress, startLevel);
  if (game.level) {
    renderLevelHeader(LEVELS[currentIndex], currentIndex);
    renderHintPanels(LEVELS[currentIndex]);
    game.updateTileLabels();
    if (game.lastReport) renderReport(game.level, game.lastReport);
  }
  if (synthesis.isOpen) synthesis.render();
  syncAudioButtons();
});

// =========================================================================
// Audio controls
// =========================================================================

function syncAudioButtons() {
  const music = $('btn-music');
  const sfx = $('btn-sfx');
  music.setAttribute('aria-pressed', String(audio.musicEnabled));
  sfx.setAttribute('aria-pressed', String(audio.sfxEnabled));
  music.title = `${t('audio.music')}: ${t(audio.musicEnabled ? 'audio.on' : 'audio.off')}`;
  sfx.title = `${t('audio.sfx')}: ${t(audio.sfxEnabled ? 'audio.on' : 'audio.off')}`;
}

$('btn-music').addEventListener('click', () => { audio.unlock(); audio.toggleMusic(); });
$('btn-sfx').addEventListener('click', () => { audio.unlock(); audio.toggleSfx(); audio.play('click'); });
audio.onChange(syncAudioButtons);

// Browsers block sound until the first gesture; start music then.
const unlockAudio = () => audio.unlock();
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

// A click sound for every button (tiles have their own sounds).
document.addEventListener('click', (e) => {
  if (e.target.closest('button') && !e.target.closest('#btn-sfx')) audio.play('click');
});

// =========================================================================
// Boot
// =========================================================================

document.documentElement.lang = getLang() === 'bm' ? 'ms' : 'en';
applyI18n(document);
syncLangButtons();
syncAudioButtons();
renderNotes($('notes-content'));
renderNotes($('hint-notes'), { prefix: 'm-' });
goMenu();
