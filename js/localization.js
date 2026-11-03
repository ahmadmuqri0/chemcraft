/**
 * localization.js
 * Central EN / BM dictionary and the switching logic.
 *
 * Usage
 *   t('menu.play')                       -> "Play" / "Main"
 *   t('game.level', { n: 3 })            -> "Level 3" / "Tahap 3"
 *   localized({ en: '...', bm: '...' })  -> picks the current language from a data object
 *   <span data-i18n="menu.play"></span>  -> filled by applyI18n()
 *   <button data-i18n-attr="aria-label:audio.music">  -> attribute translation
 *
 * setLang() updates every [data-i18n] element in place and notifies listeners
 * (HUD, notes, open popups) so they re-render. Nothing reloads.
 */

import { load, save } from './storage.js';

const DICT = {
  en: {
    'app.name': 'ChemCraft',
    'app.subtitle': 'The Octet Forge',
    'app.chapter': 'Form 4 Chemistry · KSSM Chapter 5: Chemical Bond',
    'app.tagline': 'Move electrons between atoms on a hex grid until every atom is stable. Then watch the chemistry behind your compound.',

    'lang.label': 'Language',
    'audio.music': 'Music',
    'audio.sfx': 'Sound effects',
    'audio.on': 'on',
    'audio.off': 'off',

    'menu.play': 'Play',
    'menu.continue': 'Continue: Level {n}',
    'menu.levels': 'Levels',
    'menu.notes': 'Notes',
    'menu.progress': '{n} of {total} levels unlocked',
    'menu.reset': 'Reset progress',
    'menu.resetConfirm': 'Tap again to reset',
    'menu.resetDone': 'Progress reset.',
    'menu.howTitle': 'How to play',
    'menu.how1': 'Drag element tiles from the tray onto the grid.',
    'menu.how2': 'Metal tiles carry pegs (electrons to give). Non-metal tiles carry slots (electrons needed).',
    'menu.how3': 'Place them edge to edge until every peg sits in a slot and stability reaches 100%.',

    'common.back': 'Back',
    'common.close': 'Close',

    'levels.title': 'Choose a level',
    'levels.level': 'Level {n}',
    'levels.locked': 'Locked',
    'levels.done': 'Completed',
    'levels.ionic': 'Ionic',
    'levels.covalent': 'Covalent',

    'notes.title': 'Chapter 5 Notes',
    'notes.contents': 'Contents',
    'notes.figure': 'Textbook diagram',

    'game.level': 'Level {n}',
    'game.instruction': 'Match the valence nodes!',
    'game.objectives': 'Objectives',
    'game.objCation': 'Cation: {ion}',
    'game.objAnion': 'Anion: {ion}',
    'game.objSharer': 'Sharing atoms: {ion}',
    'game.objCentral': 'Central atom: {ion}',
    'game.objFormula': 'Formula: {formula}',
    'game.stability': 'Stability',
    'game.hint': 'Hints & notes',
    'game.clear': 'Clear board',
    'game.menu': 'Menu',
    'game.tray': 'Element tray',
    'game.trayHelp': 'Drag a tile onto the grid, or tap a tile and then tap a cell.',
    'game.bondIonic': 'Ionic bond: electron transfer',
    'game.bondCovalent': 'Covalent bond: electron sharing',
    'game.placed': '{el} placed. Stability {pct}%.',
    'game.returned': '{el} returned to the tray.',
    'game.selected': '{el} selected. Tap a cell to place it.',
    'game.wrongCompound': 'That group is stable, but it is not {formula}.',
    'game.cleared': 'Board cleared.',
    'game.pegs': '{n} electron(s) to give',
    'game.slots': '{n} electron(s) needed',

    'hint.title': 'Hints & notes',
    'hint.tabLevel': 'This level',
    'hint.tabRules': 'Bonding rules',
    'hint.tabNotes': 'Chapter notes',
    'hint.target': 'Target',
    'rules.1': 'Metal tiles are donors. Their pegs are the valence electrons they give away.',
    'rules.2': 'Non-metal tiles are acceptors. Their slots are the electrons they still need for an octet.',
    'rules.3': 'A bond forms only between a donor and an acceptor that share an edge.',
    'rules.4': 'A group is stable when every peg sits in a slot: total pegs = total slots, net valency 0.',
    'rules.5': 'In covalent levels (H2O, NH3) atoms share electron pairs instead of transferring them.',
    'rules.6': 'Extra tiles in the tray are distractors. You do not have to use every tile.',

    'synth.title': 'Synthesis complete',
    'synth.step': 'Step {n} of {total}',
    'synth.next': 'Next step',
    'synth.prev': 'Previous',
    'synth.replay': 'Replay animation',
    'synth.nextLevel': 'Next level',
    'synth.again': 'Play again',
    'synth.menu': 'Main menu',
    'synth.allDone': 'You have forged every compound in Chapter 5.',
    'synth.ionicType': 'Ionic compound · direct synthesis',
    'synth.covalentType': 'Covalent compound · direct synthesis',

    's.config.title': 'Electron arrangement',
    's.config.donorIonic': '{name} atom ({cfg}) loses {v} e- and becomes {ion} ({ioncfg}).',
    's.config.acceptorIonic': '{name} atom ({cfg}) gains {v} e- and becomes {ion} ({ioncfg}).',
    's.config.donorCov': '{name} atom ({cfg}) shares {v} e- to reach a duplet (2).',
    's.config.acceptorCov': '{name} atom ({cfg}) needs {v} more e- for an octet, so it shares {v} pair(s).',
    's.config.noble': 'Every particle ends with the stable arrangement of a noble gas: {gases}.',

    's.transfer.title': 'Electron transfer',
    's.transfer.body': '{cn} {cation} atom(s) give {total} e-. {an} {anion} atom(s) receive {total} e-.',
    's.transfer.legend': '× electron from {cation} · • electron of {anion}',

    's.share.title': 'Electron sharing',
    's.share.body': 'Each {donor} pairs its 1 electron with 1 electron from {anion}: {pairs} shared pair(s) = {pairs} single covalent bond(s).',
    's.share.legend': '× electron from {donor} · • electron of {anion}',

    's.charge.title': 'Charge balance',
    's.charge.body': 'An ionic compound is neutral. Total positive charge plus total negative charge must equal 0.',
    's.charge.check': 'Net charge = 0, so the compound is neutral.',

    's.octet.title': 'Stability check',
    's.octet.body': 'Count the valence electrons around each atom after sharing.',
    's.octet.row': '{el}: {own} own + {shared} shared = {total}',
    's.octet.duplet': 'duplet',
    's.octet.octet': 'octet',

    's.formula.title': 'Chemical formula',
    's.formula.ionic': 'Cross over the charges: the charge number of each ion becomes the count of the other ion.',
    's.formula.simplify': 'Simplify {a} : {b} to the lowest ratio {c} : {d}.',
    's.formula.ratio': '{cation} : {anion} = {c} : {a}',
    's.formula.cov': '{anion} needs {v} electron(s), so 1 {anion} atom bonds with {v} {donor} atom(s).',

    's.eq.title': 'Balanced equation',
    's.eq.diatomic': '{list} exist as diatomic molecules, so whole molecules react. Coefficients balance each element:',
    's.eq.noDiatomic': 'Coefficients balance each element:',
    's.eq.element': 'Element',
    's.eq.left': 'Reactants',
    's.eq.right': 'Products',
    's.eq.balanced': 'Balanced',
  },

  bm: {
    'app.name': 'ChemCraft',
    'app.subtitle': 'Tempaan Oktet',
    'app.chapter': 'Kimia Tingkatan 4 · KSSM Bab 5: Ikatan Kimia',
    'app.tagline': 'Gerakkan elektron antara atom di atas grid heks sehingga setiap atom stabil. Kemudian lihat kimia di sebalik sebatian anda.',

    'lang.label': 'Bahasa',
    'audio.music': 'Muzik',
    'audio.sfx': 'Kesan bunyi',
    'audio.on': 'hidup',
    'audio.off': 'mati',

    'menu.play': 'Main',
    'menu.continue': 'Sambung: Tahap {n}',
    'menu.levels': 'Tahap',
    'menu.notes': 'Nota',
    'menu.progress': '{n} daripada {total} tahap dibuka',
    'menu.reset': 'Set semula kemajuan',
    'menu.resetConfirm': 'Tekan sekali lagi untuk set semula',
    'menu.resetDone': 'Kemajuan telah diset semula.',
    'menu.howTitle': 'Cara bermain',
    'menu.how1': 'Seret jubin unsur dari dulang ke atas grid.',
    'menu.how2': 'Jubin logam membawa pasak (elektron untuk diderma). Jubin bukan logam membawa slot (elektron yang diperlukan).',
    'menu.how3': 'Letakkan sisi ke sisi sehingga setiap pasak masuk ke slot dan kestabilan mencapai 100%.',

    'common.back': 'Kembali',
    'common.close': 'Tutup',

    'levels.title': 'Pilih tahap',
    'levels.level': 'Tahap {n}',
    'levels.locked': 'Dikunci',
    'levels.done': 'Selesai',
    'levels.ionic': 'Ion',
    'levels.covalent': 'Kovalen',

    'notes.title': 'Nota Bab 5',
    'notes.contents': 'Kandungan',
    'notes.figure': 'Rajah buku teks',

    'game.level': 'Tahap {n}',
    'game.instruction': 'Padankan Nod Valensi!',
    'game.objectives': 'Objektif',
    'game.objCation': 'Kation: {ion}',
    'game.objAnion': 'Anion: {ion}',
    'game.objSharer': 'Atom berkongsi: {ion}',
    'game.objCentral': 'Atom pusat: {ion}',
    'game.objFormula': 'Formula: {formula}',
    'game.stability': 'Kestabilan',
    'game.hint': 'Petunjuk & nota',
    'game.clear': 'Kosongkan papan',
    'game.menu': 'Menu',
    'game.tray': 'Dulang unsur',
    'game.trayHelp': 'Seret jubin ke grid, atau tekan jubin dan kemudian tekan sel.',
    'game.bondIonic': 'Ikatan ion: pemindahan elektron',
    'game.bondCovalent': 'Ikatan kovalen: perkongsian elektron',
    'game.placed': '{el} diletakkan. Kestabilan {pct}%.',
    'game.returned': '{el} dikembalikan ke dulang.',
    'game.selected': '{el} dipilih. Tekan sel untuk meletakkannya.',
    'game.wrongCompound': 'Kumpulan itu stabil, tetapi bukan {formula}.',
    'game.cleared': 'Papan dikosongkan.',
    'game.pegs': '{n} elektron untuk diderma',
    'game.slots': '{n} elektron diperlukan',

    'hint.title': 'Petunjuk & nota',
    'hint.tabLevel': 'Tahap ini',
    'hint.tabRules': 'Peraturan ikatan',
    'hint.tabNotes': 'Nota bab',
    'hint.target': 'Sasaran',
    'rules.1': 'Jubin logam ialah penderma. Pasaknya ialah elektron valens yang didermakan.',
    'rules.2': 'Jubin bukan logam ialah penerima. Slotnya ialah elektron yang masih diperlukan untuk oktet.',
    'rules.3': 'Ikatan hanya terbentuk antara penderma dan penerima yang berkongsi sisi.',
    'rules.4': 'Kumpulan stabil apabila setiap pasak masuk ke slot: jumlah pasak = jumlah slot, valensi bersih 0.',
    'rules.5': 'Dalam tahap kovalen (H2O, NH3) atom berkongsi pasangan elektron, bukan memindahkannya.',
    'rules.6': 'Jubin tambahan di dulang ialah pengalih perhatian. Anda tidak perlu menggunakan semua jubin.',

    'synth.title': 'Sintesis berjaya',
    'synth.step': 'Langkah {n} daripada {total}',
    'synth.next': 'Langkah seterusnya',
    'synth.prev': 'Sebelumnya',
    'synth.replay': 'Main semula animasi',
    'synth.nextLevel': 'Tahap seterusnya',
    'synth.again': 'Main semula',
    'synth.menu': 'Menu utama',
    'synth.allDone': 'Anda telah menempa setiap sebatian dalam Bab 5.',
    'synth.ionicType': 'Sebatian ion · sintesis terus',
    'synth.covalentType': 'Sebatian kovalen · sintesis terus',

    's.config.title': 'Susunan elektron',
    's.config.donorIonic': 'Atom {name} ({cfg}) kehilangan {v} e- dan menjadi {ion} ({ioncfg}).',
    's.config.acceptorIonic': 'Atom {name} ({cfg}) menerima {v} e- dan menjadi {ion} ({ioncfg}).',
    's.config.donorCov': 'Atom {name} ({cfg}) berkongsi {v} e- untuk mencapai duplet (2).',
    's.config.acceptorCov': 'Atom {name} ({cfg}) perlukan {v} e- lagi untuk oktet, jadi ia berkongsi {v} pasangan.',
    's.config.noble': 'Setiap zarah akhirnya mempunyai susunan elektron stabil gas adi: {gases}.',

    's.transfer.title': 'Pemindahan elektron',
    's.transfer.body': '{cn} atom {cation} memberi {total} e-. {an} atom {anion} menerima {total} e-.',
    's.transfer.legend': '× elektron daripada {cation} · • elektron {anion}',

    's.share.title': 'Perkongsian elektron',
    's.share.body': 'Setiap {donor} memasangkan 1 elektronnya dengan 1 elektron daripada {anion}: {pairs} pasangan dikongsi = {pairs} ikatan kovalen tunggal.',
    's.share.legend': '× elektron daripada {donor} · • elektron {anion}',

    's.charge.title': 'Keseimbangan cas',
    's.charge.body': 'Sebatian ion adalah neutral. Jumlah cas positif tambah jumlah cas negatif mesti sama dengan 0.',
    's.charge.check': 'Cas bersih = 0, jadi sebatian ini neutral.',

    's.octet.title': 'Semakan kestabilan',
    's.octet.body': 'Kira elektron valens di sekeliling setiap atom selepas berkongsi.',
    's.octet.row': '{el}: {own} sendiri + {shared} dikongsi = {total}',
    's.octet.duplet': 'duplet',
    's.octet.octet': 'oktet',

    's.formula.title': 'Formula kimia',
    's.formula.ionic': 'Silangkan cas: nombor cas setiap ion menjadi bilangan ion yang satu lagi.',
    's.formula.simplify': 'Permudahkan {a} : {b} kepada nisbah terendah {c} : {d}.',
    's.formula.ratio': '{cation} : {anion} = {c} : {a}',
    's.formula.cov': '{anion} perlukan {v} elektron, jadi 1 atom {anion} berikatan dengan {v} atom {donor}.',

    's.eq.title': 'Persamaan seimbang',
    's.eq.diatomic': '{list} wujud sebagai molekul dwiatom, jadi molekul lengkap bertindak balas. Pekali menyeimbangkan setiap unsur:',
    's.eq.noDiatomic': 'Pekali menyeimbangkan setiap unsur:',
    's.eq.element': 'Unsur',
    's.eq.left': 'Bahan tindak balas',
    's.eq.right': 'Hasil',
    's.eq.balanced': 'Seimbang',
  },
};

export const LANGUAGES = Object.freeze(['en', 'bm']);

let current = LANGUAGES.includes(load('lang', 'en')) ? load('lang', 'en') : 'en';
const listeners = new Set();

/** Current language code: 'en' or 'bm'. */
export const getLang = () => current;

/**
 * Looks up a key, falling back to English, then to the key itself.
 * `{name}` placeholders are replaced from `vars`.
 */
export function t(key, vars = {}) {
  const text = DICT[current][key] ?? DICT.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/** Picks the current language from a bilingual data object { en, bm }. */
export const localized = (obj) => (obj ? obj[current] ?? obj.en : '');

/** Fills [data-i18n] text and [data-i18n-attr] attributes under `root`. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    // Format: "aria-label:key; title:key2"
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

/** Switches language, updates the page in place and notifies listeners. */
export function setLang(lang) {
  if (!LANGUAGES.includes(lang) || lang === current) return;
  current = lang;
  save('lang', lang);
  document.documentElement.lang = lang === 'bm' ? 'ms' : 'en';
  applyI18n(document);
  listeners.forEach((fn) => fn(lang));
}

/** Registers a callback for language changes. Returns an unsubscribe function. */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
