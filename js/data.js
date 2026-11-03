/**
 * data.js
 * Pure data: elements and levels. Equivalent of the ElementData and
 * SynthesisRecipe ScriptableObjects. No logic lives here.
 *
 * Element fields
 *   role      'donor'   = gives electrons (metal), or shares them (H in covalent levels): drawn as pegs
 *             'acceptor'= needs electrons (non-metal): drawn as slots
 *   valency   electrons donated / needed (Na 1, Mg 2, Al 3, Cl 1, O 2, N 3)
 *   diatomic  true when the free element is X2 (H2, N2, O2, Cl2): needed to balance equations
 *   config    electron arrangement, KSSM style (Na = 2.8.1)
 */

export const ELEMENTS = Object.freeze({
  H:  { symbol: 'H',  name: { en: 'Hydrogen',  bm: 'Hidrogen' },  role: 'donor',    valency: 1, diatomic: true,  config: [1],       color: '#7cc4f0' },
  Na: { symbol: 'Na', name: { en: 'Sodium',    bm: 'Natrium' },   role: 'donor',    valency: 1, diatomic: false, config: [2, 8, 1], color: '#e58f3c' },
  K:  { symbol: 'K',  name: { en: 'Potassium', bm: 'Kalium' },    role: 'donor',    valency: 1, diatomic: false, config: [2, 8, 8, 1], color: '#c96bd6' },
  Mg: { symbol: 'Mg', name: { en: 'Magnesium', bm: 'Magnesium' }, role: 'donor',    valency: 2, diatomic: false, config: [2, 8, 2], color: '#3f86ff' },
  Al: { symbol: 'Al', name: { en: 'Aluminium', bm: 'Aluminium' }, role: 'donor',    valency: 3, diatomic: false, config: [2, 8, 3], color: '#8fa3bf' },
  O:  { symbol: 'O',  name: { en: 'Oxygen',    bm: 'Oksigen' },   role: 'acceptor', valency: 2, diatomic: true,  config: [2, 6],    color: '#f0544f' },
  N:  { symbol: 'N',  name: { en: 'Nitrogen',  bm: 'Nitrogen' },  role: 'acceptor', valency: 3, diatomic: true,  config: [2, 5],    color: '#9b7bff' },
  Cl: { symbol: 'Cl', name: { en: 'Chlorine',  bm: 'Klorin' },    role: 'acceptor', valency: 1, diatomic: true,  config: [2, 8, 7], color: '#3fcf6a' },
});

/** Noble gas with the same number of electrons, for "achieves the arrangement of ..." text. */
export const NOBLE_GAS_BY_ELECTRONS = Object.freeze({ 2: 'He', 10: 'Ne', 18: 'Ar' });

/** Electron arrangement of the ion (or of the atom after sharing) as a string, e.g. "2.8". */
export function ionConfig(element) {
  const shells = [...element.config];
  const last = shells.length - 1;
  if (element.role === 'donor' && element.symbol !== 'H') {
    shells.pop();                         // metal loses its whole valence shell
  } else if (element.symbol === 'H') {
    shells[last] = 2;                     // H reaches a duplet by sharing
  } else {
    shells[last] += element.valency;      // non-metal fills its valence shell
  }
  return shells.join('.');
}

/** Total electrons in an arrangement string ("2.8.8" -> 18). */
export const electronTotal = (config) => config.split('.').reduce((a, b) => a + Number(b), 0);

/**
 * Levels. Equations are copied from the Persamaan Kimia sheet where it lists
 * them (direct synthesis); the rest follow the same pattern.
 *
 *   cation / anion       element symbols (donor / acceptor)
 *   cationCount/anionCount  atoms per formula unit
 *   bond                 'ionic' (electron transfer) or 'covalent' (electron sharing)
 *   tray                 tiles given to the player, distractors included
 */
export const LEVELS = Object.freeze([
  {
    id: 'nacl', bond: 'ionic',
    title: { en: 'Sodium chloride', bm: 'Natrium klorida' },
    cation: 'Na', cationCount: 1, anion: 'Cl', anionCount: 1,
    formula: 'NaCl', equation: '2Na + Cl2 -> 2NaCl',
    tray: ['Na', 'Cl'],
    hint: {
      en: 'Na has 1 valence electron to give. Cl needs exactly 1. Put them side by side.',
      bm: 'Na ada 1 elektron valens untuk diderma. Cl perlukan tepat 1. Letakkan bersebelahan.',
    },
  },
  {
    id: 'mgo', bond: 'ionic',
    title: { en: 'Magnesium oxide', bm: 'Magnesium oksida' },
    cation: 'Mg', cationCount: 1, anion: 'O', anionCount: 1,
    formula: 'MgO', equation: '2Mg + O2 -> 2MgO',
    tray: ['Mg', 'O', 'Na'],
    hint: {
      en: 'Mg gives 2 electrons and O needs 2. One edge can carry both. The Na tile is a distractor.',
      bm: 'Mg menderma 2 elektron dan O perlukan 2. Satu sisi boleh membawa kedua-duanya. Jubin Na ialah pengalih perhatian.',
    },
  },
  {
    id: 'mgcl2', bond: 'ionic',
    title: { en: 'Magnesium chloride', bm: 'Magnesium klorida' },
    cation: 'Mg', cationCount: 1, anion: 'Cl', anionCount: 2,
    formula: 'MgCl2', equation: 'Mg + Cl2 -> MgCl2',
    tray: ['Mg', 'Cl', 'Cl', 'Na'],
    hint: {
      en: 'Mg has 2 electrons to give, but each Cl accepts only 1. Mg must touch two Cl tiles.',
      bm: 'Mg ada 2 elektron untuk diderma, tetapi setiap Cl hanya menerima 1. Mg mesti menyentuh dua jubin Cl.',
    },
  },
  {
    id: 'na2o', bond: 'ionic',
    title: { en: 'Sodium oxide', bm: 'Natrium oksida' },
    cation: 'Na', cationCount: 2, anion: 'O', anionCount: 1,
    formula: 'Na2O', equation: '4Na + O2 -> 2Na2O',
    tray: ['Na', 'Na', 'O', 'Cl'],
    hint: {
      en: 'O needs 2 electrons but each Na gives only 1. Surround O with two Na tiles.',
      bm: 'O perlukan 2 elektron tetapi setiap Na hanya memberi 1. Kelilingi O dengan dua jubin Na.',
    },
  },
  {
    id: 'alcl3', bond: 'ionic',
    title: { en: 'Aluminium chloride', bm: 'Aluminium klorida' },
    cation: 'Al', cationCount: 1, anion: 'Cl', anionCount: 3,
    formula: 'AlCl3', equation: '2Al + 3Cl2 -> 2AlCl3',
    tray: ['Al', 'Cl', 'Cl', 'Cl', 'O'],
    hint: {
      en: 'Al gives 3 electrons. Three Cl tiles must each touch the Al tile.',
      bm: 'Al menderma 3 elektron. Tiga jubin Cl mesti setiap satunya menyentuh jubin Al.',
    },
  },
  {
    id: 'h2o', bond: 'covalent',
    title: { en: 'Water', bm: 'Air' },
    cation: 'H', cationCount: 2, anion: 'O', anionCount: 1,
    formula: 'H2O', equation: '2H2 + O2 -> 2H2O',
    tray: ['H', 'H', 'O', 'N'],
    hint: {
      en: 'Covalent bond: atoms share electrons. O needs 2 more electrons; each H shares 1. Place two H next to O.',
      bm: 'Ikatan kovalen: atom berkongsi elektron. O perlukan 2 elektron lagi; setiap H berkongsi 1. Letakkan dua H di sebelah O.',
    },
  },
  {
    id: 'nh3', bond: 'covalent',
    title: { en: 'Ammonia', bm: 'Ammonia' },
    cation: 'H', cationCount: 3, anion: 'N', anionCount: 1,
    formula: 'NH3', equation: 'N2 + 3H2 -> 2NH3',
    tray: ['H', 'H', 'H', 'N', 'O'],
    hint: {
      en: 'N has 5 valence electrons and needs 3 more to reach an octet. Share with three H atoms.',
      bm: 'N ada 5 elektron valens dan perlukan 3 lagi untuk mencapai oktet. Berkongsi dengan tiga atom H.',
    },
  },
  {
    id: 'al2o3', bond: 'ionic',
    title: { en: 'Aluminium oxide', bm: 'Aluminium oksida' },
    cation: 'Al', cationCount: 2, anion: 'O', anionCount: 3,
    formula: 'Al2O3', equation: '4Al + 3O2 -> 2Al2O3',
    tray: ['Al', 'Al', 'O', 'O', 'O', 'Mg'],
    hint: {
      en: 'Boss level: 2 Al give 6 electrons, 3 O need 6. Chain them O, Al, O, Al, O so the middle O is shared.',
      bm: 'Tahap bos: 2 Al memberi 6 elektron, 3 O perlukan 6. Susun O, Al, O, Al, O supaya O di tengah dikongsi.',
    },
  },
]);
