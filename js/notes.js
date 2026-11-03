/**
 * notes.js
 * Bilingual summary of KSSM Form 4 Chemistry, Chapter 5 (Chemical Bond / Ikatan Kimia),
 * plus the renderer used by the Notes screen and the in-game Hint modal.
 *
 * Content model (all text is { en, bm } unless noted):
 *   { type: 'p',      text }
 *   { type: 'list',   items: [text, ...] }
 *   { type: 'eq',     lines: ['Na (2.8.1) -> Na+ (2.8) + e-', ...] }   strings or { en, bm }
 *   { type: 'table',  head: [text...], rows: [[text|string, ...], ...] }
 *   { type: 'tip',    text }
 *   { type: 'figure', src: 'img/....png', caption }
 *
 * Figures: drop an image at the `src` path (inside ./img) and it replaces the
 * placeholder automatically. Until then a labelled placeholder is shown.
 * Chemistry in any text is formatted by chemHTML (Cl2 -> Cl<sub>2</sub>, Mg2+ -> Mg<sup>2+</sup>).
 */

import { chemHTML } from './equation.js';
import { localized, t } from './localization.js';

export const NOTES = [
  {
    id: 'n-5-1', num: '5.1',
    title: { en: 'Basics of compound formation', bm: 'Asas pembentukan sebatian' },
    blocks: [
      { type: 'p', text: {
        en: 'Noble gases (Group 18) are unreactive because their valence shell is full: a duplet of 2 electrons (helium) or an octet of 8 electrons (neon, argon).',
        bm: 'Gas adi (Kumpulan 18) tidak reaktif kerana petala valensnya penuh: duplet dengan 2 elektron (helium) atau oktet dengan 8 elektron (neon, argon).' } },
      { type: 'p', text: {
        en: 'Atoms of other elements react to reach the same stable arrangement. They lose, gain or share valence electrons, and this forms chemical bonds.',
        bm: 'Atom unsur lain bertindak balas untuk mencapai susunan stabil yang sama. Atom melepaskan, menerima atau berkongsi elektron valens, lalu membentuk ikatan kimia.' } },
      { type: 'table',
        head: [{ en: 'Bond', bm: 'Ikatan' }, { en: 'Between', bm: 'Antara' }, { en: 'How electrons move', bm: 'Pergerakan elektron' }],
        rows: [
          [{ en: 'Ionic', bm: 'Ion' }, { en: 'metal + non-metal', bm: 'logam + bukan logam' }, { en: 'transferred', bm: 'dipindahkan' }],
          [{ en: 'Covalent', bm: 'Kovalen' }, { en: 'non-metal + non-metal', bm: 'bukan logam + bukan logam' }, { en: 'shared', bm: 'dikongsi' }],
        ] },
      { type: 'figure', src: 'img/5-1-noble-gas-arrangement.png',
        caption: { en: 'Electron arrangement of helium (2), neon (2.8) and argon (2.8.8).', bm: 'Susunan elektron helium (2), neon (2.8) dan argon (2.8.8).' } },
    ],
  },
  {
    id: 'n-5-2', num: '5.2',
    title: { en: 'Ionic bond', bm: 'Ikatan ion' },
    blocks: [
      { type: 'p', text: {
        en: 'Metal atoms (Groups 1, 2 and 13) lose their valence electrons and become positive ions, called cations. Non-metal atoms (Groups 15, 16 and 17) gain electrons and become negative ions, called anions.',
        bm: 'Atom logam (Kumpulan 1, 2 dan 13) melepaskan elektron valens dan menjadi ion positif, iaitu kation. Atom bukan logam (Kumpulan 15, 16 dan 17) menerima elektron dan menjadi ion negatif, iaitu anion.' } },
      { type: 'p', text: {
        en: 'An ionic bond is the strong electrostatic force of attraction between oppositely charged ions.',
        bm: 'Ikatan ion ialah daya tarikan elektrostatik yang kuat antara ion-ion yang bertentangan cas.' } },
      { type: 'eq', lines: [
        'Na (2.8.1) -> Na+ (2.8) + e-',
        'Cl (2.8.7) + e- -> Cl- (2.8.8)',
        'Mg (2.8.2) -> Mg2+ (2.8) + 2e-',
        'O (2.6) + 2e- -> O2- (2.8)',
      ] },
      { type: 'figure', src: 'img/5-2-nacl-dot-cross.png',
        caption: { en: 'Dot-and-cross diagram of sodium chloride, NaCl.', bm: 'Gambar rajah titik dan pangkah natrium klorida, NaCl.' } },
      { type: 'tip', text: {
        en: 'In a dot-and-cross diagram, draw the electrons of one atom as dots and the other as crosses, so you can see where each electron came from.',
        bm: 'Dalam gambar rajah titik dan pangkah, lukis elektron satu atom sebagai titik dan atom lain sebagai pangkah, supaya asal setiap elektron jelas.' } },
      { type: 'h', text: { en: 'Writing ionic formulae', bm: 'Menulis formula ion' } },
      { type: 'p', text: {
        en: 'The total positive charge must cancel the total negative charge. Cross over the charge numbers, then simplify the ratio.',
        bm: 'Jumlah cas positif mesti meneutralkan jumlah cas negatif. Silangkan nombor cas, kemudian permudahkan nisbah.' } },
      { type: 'table',
        head: [{ en: 'Cation', bm: 'Kation' }, { en: 'Anion', bm: 'Anion' }, { en: 'Formula', bm: 'Formula' }],
        rows: [
          ['Na+', 'Cl-', 'NaCl'], ['Mg2+', 'O2-', 'MgO'], ['Mg2+', 'Cl-', 'MgCl2'],
          ['Na+', 'O2-', 'Na2O'], ['Al3+', 'Cl-', 'AlCl3'], ['Al3+', 'O2-', 'Al2O3'],
        ] },
    ],
  },
  {
    id: 'n-5-3', num: '5.3',
    title: { en: 'Covalent bond', bm: 'Ikatan kovalen' },
    blocks: [
      { type: 'p', text: {
        en: 'Non-metal atoms share pairs of valence electrons so that each atom reaches a duplet or octet. Each shared pair is one covalent bond.',
        bm: 'Atom bukan logam berkongsi pasangan elektron valens supaya setiap atom mencapai duplet atau oktet. Setiap pasangan yang dikongsi ialah satu ikatan kovalen.' } },
      { type: 'list', items: [
        { en: 'Single bond: 1 shared pair, e.g. H2, Cl2, H2O', bm: 'Ikatan tunggal: 1 pasangan dikongsi, contoh H2, Cl2, H2O' },
        { en: 'Double bond: 2 shared pairs, e.g. O2, CO2', bm: 'Ikatan ganda dua: 2 pasangan dikongsi, contoh O2, CO2' },
        { en: 'Triple bond: 3 shared pairs, e.g. N2', bm: 'Ikatan ganda tiga: 3 pasangan dikongsi, contoh N2' },
      ] },
      { type: 'eq', lines: [
        { en: 'H2O: O (2.6) shares 2 pairs with 2 H atoms -> O 2.8, each H 2', bm: 'H2O: O (2.6) berkongsi 2 pasangan dengan 2 atom H -> O 2.8, setiap H 2' },
        { en: 'NH3: N (2.5) shares 3 pairs with 3 H atoms -> N 2.8, each H 2', bm: 'NH3: N (2.5) berkongsi 3 pasangan dengan 3 atom H -> N 2.8, setiap H 2' },
      ] },
      { type: 'figure', src: 'img/5-3-h2o-nh3-dot-cross.png',
        caption: { en: 'Dot-and-cross diagrams of water, H2O, and ammonia, NH3.', bm: 'Gambar rajah titik dan pangkah air, H2O, dan ammonia, NH3.' } },
    ],
  },
  {
    id: 'n-5-4', num: '5.4',
    title: { en: 'Hydrogen bond', bm: 'Ikatan hidrogen' },
    blocks: [
      { type: 'p', text: {
        en: 'A hydrogen bond is the attraction between a hydrogen atom that is bonded to a highly electronegative atom (N, O or F) and an N, O or F atom of another molecule.',
        bm: 'Ikatan hidrogen ialah daya tarikan antara atom hidrogen yang terikat kepada atom berkeelektronegatifan tinggi (N, O atau F) dengan atom N, O atau F molekul lain.' } },
      { type: 'p', text: {
        en: 'Examples: water, ammonia and hydrogen fluoride. Hydrogen bonds give water a higher boiling point than expected and let ethanol dissolve in water.',
        bm: 'Contoh: air, ammonia dan hidrogen fluorida. Ikatan hidrogen menyebabkan takat didih air lebih tinggi daripada jangkaan dan membolehkan etanol larut dalam air.' } },
      { type: 'figure', src: 'img/5-4-hydrogen-bond-water.png',
        caption: { en: 'Hydrogen bonds between water molecules.', bm: 'Ikatan hidrogen antara molekul air.' } },
    ],
  },
  {
    id: 'n-5-5', num: '5.5',
    title: { en: 'Dative bond', bm: 'Ikatan datif' },
    blocks: [
      { type: 'p', text: {
        en: 'A dative (coordinate) bond is a covalent bond in which both shared electrons come from the same atom, which donates a lone pair.',
        bm: 'Ikatan datif (koordinat) ialah ikatan kovalen yang kedua-dua elektron dikongsinya datang daripada atom yang sama, yang menderma pasangan elektron bebas.' } },
      { type: 'eq', lines: ['H2O + H+ -> H3O+', 'NH3 + H+ -> NH4+'] },
      { type: 'figure', src: 'img/5-5-dative-bond.png',
        caption: { en: 'Formation of the hydroxonium ion, H3O+, and the ammonium ion, NH4+.', bm: 'Pembentukan ion hidroksonium, H3O+, dan ion ammonium, NH4+.' } },
    ],
  },
  {
    id: 'n-5-6', num: '5.6',
    title: { en: 'Metallic bond', bm: 'Ikatan logam' },
    blocks: [
      { type: 'p', text: {
        en: 'Metal atoms release their valence electrons into a sea of delocalised electrons. The metallic bond is the attraction between this sea of electrons and the positive metal ions.',
        bm: 'Atom logam melepaskan elektron valens menjadi lautan elektron yang dinyahsetempatkan. Ikatan logam ialah daya tarikan antara lautan elektron ini dengan ion logam positif.' } },
      { type: 'p', text: {
        en: 'The delocalised electrons move freely, so metals conduct electricity and heat.',
        bm: 'Elektron yang dinyahsetempatkan bergerak bebas, jadi logam mengalirkan elektrik dan haba.' } },
    ],
  },
  {
    id: 'n-5-7', num: '5.7',
    title: { en: 'Properties of ionic and covalent compounds', bm: 'Sifat sebatian ion dan sebatian kovalen' },
    blocks: [
      { type: 'table',
        head: [{ en: 'Property', bm: 'Sifat' }, { en: 'Ionic compound', bm: 'Sebatian ion' }, { en: 'Covalent compound (simple molecule)', bm: 'Sebatian kovalen (molekul ringkas)' }],
        rows: [
          [{ en: 'Melting and boiling point', bm: 'Takat lebur dan takat didih' },
           { en: 'High: strong electrostatic forces between ions', bm: 'Tinggi: daya elektrostatik yang kuat antara ion' },
           { en: 'Low: weak forces between molecules', bm: 'Rendah: daya antara molekul yang lemah' }],
          [{ en: 'Electrical conductivity', bm: 'Kekonduksian elektrik' },
           { en: 'Conducts when molten or in aqueous solution (free-moving ions); not as a solid', bm: 'Mengalirkan elektrik dalam keadaan leburan atau larutan akueus (ion bebas bergerak); tidak dalam keadaan pepejal' },
           { en: 'Does not conduct in any state (no ions)', bm: 'Tidak mengalirkan elektrik dalam semua keadaan (tiada ion)' }],
          [{ en: 'Solubility', bm: 'Keterlarutan' },
           { en: 'Usually soluble in water, insoluble in organic solvents', bm: 'Biasanya larut dalam air, tidak larut dalam pelarut organik' },
           { en: 'Usually insoluble in water, soluble in organic solvents', bm: 'Biasanya tidak larut dalam air, larut dalam pelarut organik' }],
          [{ en: 'Volatility', bm: 'Kemeruapan' },
           { en: 'Non-volatile', bm: 'Tidak meruap' },
           { en: 'Volatile', bm: 'Meruap' }],
          [{ en: 'Examples', bm: 'Contoh' }, 'NaCl, MgO, Al2O3', 'H2O, NH3, CO2'],
        ] },
    ],
  },
  {
    id: 'n-game', num: '★',
    title: { en: 'Direct synthesis in this game', bm: 'Sintesis terus dalam permainan ini' },
    blocks: [
      { type: 'p', text: {
        en: 'Every level forms a compound straight from its elements. Elements that exist as diatomic molecules (H2, N2, O2, Cl2) react as whole molecules, which sets the coefficients.',
        bm: 'Setiap tahap membentuk sebatian terus daripada unsurnya. Unsur yang wujud sebagai molekul dwiatom (H2, N2, O2, Cl2) bertindak balas sebagai molekul lengkap, dan ini menentukan pekali.' } },
      { type: 'eq', lines: [
        '2Na + Cl2 -> 2NaCl', '2Mg + O2 -> 2MgO', 'Mg + Cl2 -> MgCl2', '4Na + O2 -> 2Na2O',
        '2Al + 3Cl2 -> 2AlCl3', '2H2 + O2 -> 2H2O', 'N2 + 3H2 -> 2NH3', '4Al + 3O2 -> 2Al2O3',
      ] },
    ],
  },
];

/** Formats a block text that is either { en, bm } or a language-neutral string. */
const text = (value) => chemHTML(typeof value === 'string' ? value : localized(value));

function renderBlock(block) {
  switch (block.type) {
    case 'p':
      return `<p>${text(block.text)}</p>`;
    case 'h':
      return `<h4 class="notes-subhead">${text(block.text)}</h4>`;
    case 'list':
      return `<ul class="notes-list">${block.items.map((i) => `<li>${text(i)}</li>`).join('')}</ul>`;
    case 'eq':
      return `<div class="notes-eq" role="group">${block.lines.map((l) => `<code>${text(l)}</code>`).join('')}</div>`;
    case 'tip':
      return `<p class="notes-tip">${text(block.text)}</p>`;
    case 'table':
      return `<div class="table-wrap"><table class="notes-table">
        <thead><tr>${block.head.map((h) => `<th scope="col">${text(h)}</th>`).join('')}</tr></thead>
        <tbody>${block.rows.map((row) => `<tr>${row.map((c, i) => (i === 0 ? `<th scope="row">${text(c)}</th>` : `<td>${text(c)}</td>`)).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    case 'figure':
      // Semantic placeholder: swapped for the real image once img/<file> exists (see hydrateFigures).
      return `<figure class="notes-figure" data-src="${block.src}">
        <div class="figure-frame" role="img" aria-label="${t('notes.figure')}: ${localized(block.caption).replace(/"/g, '&quot;')}">
          <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 34l10-12 8 9 6-6 8 9z M14 16a4 4 0 1 0 0.01 0z" /></svg>
          <span class="figure-label">${t('notes.figure')}</span>
          <code class="figure-path">${block.src}</code>
        </div>
        <figcaption>${text(block.caption)}</figcaption>
      </figure>`;
    default:
      return '';
  }
}

/**
 * Renders the notes into `container`.
 * @param {HTMLElement} container
 * @param {object} [options]
 * @param {boolean} [options.withToc=true]  show the contents list
 * @param {string}  [options.prefix='']      id prefix, so two copies can live on one page
 */
export function renderNotes(container, { withToc = true, prefix = '' } = {}) {
  const toc = withToc
    ? `<nav class="notes-toc" aria-label="${t('notes.contents')}">
         <p class="eyebrow">${t('notes.contents')}</p>
         <ol>${NOTES.map((s) => `<li><a href="#${prefix}${s.id}"><span class="toc-num">${s.num}</span>${chemHTML(localized(s.title))}</a></li>`).join('')}</ol>
       </nav>`
    : '';

  const body = NOTES.map((s) => `
    <section class="notes-section" id="${prefix}${s.id}" aria-labelledby="${prefix}${s.id}-h">
      <h3 id="${prefix}${s.id}-h"><span class="section-num">${s.num}</span>${chemHTML(localized(s.title))}</h3>
      ${s.blocks.map(renderBlock).join('')}
    </section>`).join('');

  container.innerHTML = `${toc}<div class="notes-body">${body}</div>`;

  // Contents links scroll inside their own scroll container instead of changing the URL hash.
  container.querySelectorAll('.notes-toc a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      container.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  hydrateFigures(container);
}

/** Replaces each figure placeholder with its image once the file is found. */
function hydrateFigures(container) {
  container.querySelectorAll('.notes-figure[data-src]').forEach((figure) => {
    const img = new Image();
    img.alt = figure.querySelector('figcaption')?.textContent ?? '';
    img.loading = 'lazy';
    img.onload = () => figure.querySelector('.figure-frame')?.replaceWith(img);
    img.src = figure.dataset.src; // a missing file simply keeps the placeholder
  });
}
