/**
 * equation.js
 * Chemical text helpers. Port of ChemicalEquation.cs plus HTML formatting.
 *  - countAtoms("Al2(SO4)3")          -> { Al: 2, S: 3, O: 12 }
 *  - parseEquation("2Na + Cl2 -> 2NaCl")
 *  - atomTable(equation)              -> per-element left/right counts (for the popup)
 *  - chemHTML("Mg2+ and Cl2")         -> "Mg<sup>2+</sup> and Cl<sub>2</sub>"
 */

/**
 * Counts atoms in a formula. Grammar: { Element | "(" formula ")" } each with an
 * optional count. Element = capital letter + optional lower-case letter.
 * Throws on malformed input.
 */
export function countAtoms(formula) {
  let i = 0;
  const s = formula.trim();

  const readCount = () => {
    let digits = '';
    while (i < s.length && s[i] >= '0' && s[i] <= '9') digits += s[i++];
    return digits ? Number(digits) : 1;
  };

  const sequence = (nested) => {
    const atoms = {};
    const add = (sym, k) => { atoms[sym] = (atoms[sym] ?? 0) + k; };
    while (i < s.length) {
      const c = s[i];
      if (c === ')') {
        if (nested) return atoms;
        throw new Error(`Unexpected ')' in ${s}`);
      }
      if (c === '(') {
        i++;
        const inner = sequence(true);
        if (s[i] !== ')') throw new Error(`Missing ')' in ${s}`);
        i++;
        const times = readCount();
        for (const [sym, k] of Object.entries(inner)) add(sym, k * times);
        continue;
      }
      if (c >= 'A' && c <= 'Z') {
        let sym = s[i++];
        if (i < s.length && s[i] >= 'a' && s[i] <= 'z') sym += s[i++];
        add(sym, readCount());
        continue;
      }
      throw new Error(`Unexpected '${c}' in ${s}`);
    }
    if (nested) throw new Error(`Missing ')' in ${s}`);
    return atoms;
  };

  const atoms = sequence(false);
  if (!Object.keys(atoms).length) throw new Error('Empty formula');
  return atoms;
}

/**
 * Parses "N2 + 3H2 -> 2NH3" into { reactants:[{coef, formula}], products:[...] }.
 * Accepts "->", "=>" or the arrow character.
 */
export function parseEquation(text) {
  const normalised = text.replace(/→|=>/g, '->');
  const parts = normalised.split('->');
  if (parts.length !== 2) throw new Error(`Expected one arrow in "${text}"`);

  const side = (str) => str.split('+').map((raw) => {
    const term = raw.trim();
    const m = /^(\d*)\s*(.+)$/.exec(term);
    if (!m) throw new Error(`Empty term in "${text}"`);
    const coef = m[1] ? Number(m[1]) : 1;
    countAtoms(m[2]); // validates the formula
    return { coef, formula: m[2] };
  });

  return { reactants: side(parts[0]), products: side(parts[1]) };
}

/** Sums atoms on one side of an equation. */
function tally(terms) {
  const total = {};
  for (const { coef, formula } of terms) {
    for (const [sym, k] of Object.entries(countAtoms(formula))) {
      total[sym] = (total[sym] ?? 0) + k * coef;
    }
  }
  return total;
}

/**
 * Per-element atom counts on both sides, in order of first appearance.
 * [{ symbol, left, right, balanced }]
 */
export function atomTable(equation) {
  const left = tally(equation.reactants);
  const right = tally(equation.products);
  const symbols = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return symbols.map((symbol) => ({
    symbol,
    left: left[symbol] ?? 0,
    right: right[symbol] ?? 0,
    balanced: (left[symbol] ?? 0) === (right[symbol] ?? 0),
  }));
}

/** True when every element has the same atom count on both sides. */
export function isBalanced(equation) {
  return atomTable(equation).every((row) => row.balanced);
}

const escapeHTML = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Formats chemistry inside plain text as HTML:
 *   ion charges   Mg2+  Cl-  Al3+   -> superscripts
 *   formula counts Cl2  H2O  Na2O   -> subscripts (digit after a letter or ")")
 *   electrons      e-               -> e with superscript minus
 *   arrows         ->               -> right arrow
 * Coefficients ("2NaCl") and configurations ("2.8.1") stay as normal digits.
 * Input is escaped first, so it is safe for any text.
 */
export function chemHTML(text) {
  return escapeHTML(String(text))
    .replace(/-&gt;/g, '→')
    .replace(/(^|[^A-Za-z])e-(?!\w)/g, '$1e<sup>−</sup>')
    .replace(
      /([A-Z][a-z]?)(\d?)([+-])(?![\w+\-\d])|([A-Za-z)])(\d+)/g,
      (match, ionSym, ionNum, sign, letter, count, offset, whole) => {
        if (ionSym) {
          const charge = sign === '-' ? '−' : '+';
          // Inside a polyatomic ion (NH4+) the digit is a count, not part of the charge.
          const polyatomic = offset > 0 && /[A-Za-z)]/.test(whole[offset - 1]);
          if (polyatomic && ionNum) return `${ionSym}<sub>${ionNum}</sub><sup>${charge}</sup>`;
          return `${ionSym}<sup>${ionNum}${charge}</sup>`;
        }
        return `${letter}<sub>${count}</sub>`;
      },
    );
}

/** Greatest common divisor, used for formula ratios. */
export function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}
