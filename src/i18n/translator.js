/**
 * Runtime translator (English -> Amharic).
 *
 * Instead of wrapping every string in every page with t('...'), this walks the
 * rendered DOM and swaps text (and placeholder/title/aria-label/alt attributes)
 * for their Amharic equivalent from the dictionary in am.js. A MutationObserver
 * keeps it in sync as React re-renders, and turning it off restores the
 * original English exactly.
 *
 * Dictionary rules (am.js):
 *  - key = the exact English text (whitespace-normalised); lookup is
 *    case-insensitive as a fallback, so "PURCHASE RECEIPT" matches "Purchase receipt".
 *  - a key containing {} is a pattern: each {} matches any text, that text is
 *    translated too if the dictionary knows it, and the value's {} (or {1}, {2}
 *    to reorder) are filled in order.
 *  - text with no dictionary entry (names, numbers, anything new) is left as is.
 * Anything inside an element marked translate="no" is never touched.
 */
import AM from './am.js';
import SERVER from './am.server.js';

// am.js (UI text) wins over am.server.js (server messages / enums) on a clash.
const DICT = { ...SERVER, ...AM };

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const exact = new Map();
const lower = new Map();
const patterns = [];
for (const [k, v] of Object.entries(DICT)) {
  const key = norm(k);
  if (key.includes('{}')) {
    const src = key.split('{}').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)');
    patterns.push({ re: new RegExp(`^${src}$`), value: v, weight: key.replace(/\{\}/g, '').length });
  } else {
    exact.set(key, v);
    lower.set(key.toLowerCase(), v);
  }
}

// Most specific pattern (most fixed text) is tried first.
patterns.sort((x, y) => y.weight - x.weight);

function lookup(core) {
  if (exact.has(core)) return exact.get(core);
  const lc = lower.get(core.toLowerCase());
  return lc;
}

// Patterns can nest (a captured group can itself be a pattern, e.g. "the
// previous {} days" inside "there was nothing in {} to compare with"), but a
// depth cap keeps a mistyped self-referencing pattern from recursing forever.
const MAX_PATTERN_DEPTH = 4;

function translateCore(core, depth = 0) {
  const hit = lookup(core);
  if (hit !== undefined) return hit;
  if (depth >= MAX_PATTERN_DEPTH) return undefined;
  for (const { re, value } of patterns) {
    const m = core.match(re);
    if (!m) continue;
    const parts = m.slice(1).map((p) => translateCore(p, depth + 1) ?? p);
    let i = 0;
    return value.replace(/\{(\d+)?\}/g, (_, n) => parts[(n ? Number(n) : ++i) - 1] ?? '');
  }
  return translateFallback(core, depth);
}

// "unitPrice" / "unit_price" -> "unit price" (server field names in validation errors).
const humanizeField = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();

/**
 * Last resorts, tried only when the whole text has no entry and matches no pattern.
 * They let a small dictionary cover text that is built from known pieces:
 *   "name: must not be blank; sku: must not be blank"  (several API messages joined)
 *   "unitPrice: must be greater than 0"                 (field: message)
 *   "Revenue, Gross Profit, Net Profit"                 (list of known labels)
 *   "In stock 5"                                        (known label + number)
 */
function translateFallback(core, depth) {
  if (core.includes('; ')) {
    const parts = core.split('; ');
    const out = parts.map((p) => translateCore(p, depth + 1));
    if (out.some((x) => x !== undefined)) return out.map((x, i) => x ?? parts[i]).join('፤ ');
  }
  const colon = core.match(/^([A-Za-z][A-Za-z0-9_ .]{0,40}): (.+)$/);
  if (colon) {
    const msg = translateCore(colon[2], depth + 1);
    if (msg !== undefined) {
      const field = translateCore(colon[1], depth + 1) ?? translateCore(humanizeField(colon[1]), depth + 1) ?? colon[1];
      return `${field}፦ ${msg}`;
    }
  }
  if (core.includes(', ')) {
    const parts = core.split(', ');
    const out = parts.map((p) => translateCore(p, depth + 1));
    if (out.every((x) => x !== undefined)) return out.join('፣ ');
  }
  if (core.includes(' and ')) {
    const parts = core.split(' and ');
    const out = parts.map((p) => translateCore(p, depth + 1));
    if (out.every((x) => x !== undefined)) return out.join(' እና ');
  }
  const num = core.match(/^(.*[A-Za-z)])\s+(-?\d[\d.,]*%?)$/);
  if (num) {
    const label = translateCore(num[1], depth + 1);
    if (label !== undefined) return `${label} ${num[2]}`;
  }
  return undefined;
}

function translateText(str) {
  const core = norm(str);
  if (!core || !/[A-Za-z]/.test(core)) return str;
  const out = translateCore(core);
  if (out === undefined) return str;
  const lead = str.match(/^\s*/)[0];
  const trail = str.match(/\s*$/)[0];
  return lead + out + trail;
}

let textState = new WeakMap(); // Text node -> { orig, shown }
let attrState = new WeakMap(); // Element -> { [attr]: { orig, shown } }
let observer = null;

const SKIP = 'script,style,textarea,code,[translate="no"]';

function processText(node) {
  const el = node.parentElement;
  if (!el || el.closest(SKIP)) return;
  const st = textState.get(node);
  if (st && node.nodeValue === st.shown) return; // our own write
  const orig = node.nodeValue;
  const shown = translateText(orig);
  if (shown !== orig) {
    textState.set(node, { orig, shown });
    node.nodeValue = shown;
  } else if (st) {
    textState.delete(node);
  }
}

function processAttrs(el) {
  if (el.closest?.('[translate="no"]')) return;
  let rec = attrState.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const value = el.getAttribute(a);
    if (rec?.[a] && value === rec[a].shown) continue;
    const shown = translateText(value);
    if (shown !== value) {
      if (!rec) { rec = {}; attrState.set(el, rec); }
      rec[a] = { orig: value, shown };
      el.setAttribute(a, shown);
    } else if (rec?.[a]) {
      delete rec[a];
    }
  }
}

function walk(root) {
  if (root.nodeType === 3) return processText(root);
  if (root.nodeType !== 1) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) processText(n);
  if (root.matches?.('[placeholder],[title],[aria-label],[alt]')) processAttrs(root);
  root.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(processAttrs);
}

function restore() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const st = textState.get(n);
    if (st && n.nodeValue === st.shown) n.nodeValue = st.orig;
  }
  document.body.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach((el) => {
    const rec = attrState.get(el);
    if (!rec) return;
    for (const a of Object.keys(rec)) {
      if (el.getAttribute(a) === rec[a].shown) el.setAttribute(a, rec[a].orig);
    }
  });
  textState = new WeakMap();
  attrState = new WeakMap();
}

export function startTranslator() {
  if (observer) return;
  walk(document.body);
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') processText(m.target);
      else if (m.type === 'attributes') processAttrs(m.target);
      else m.addedNodes.forEach((n) => walk(n));
    }
  });
  observer.observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS,
  });
}

export function stopTranslator() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
  restore();
}

/** Translate one string (used by tests and anywhere a plain string is needed). */
export function translate(str) {
  return translateText(str);
}

/**
 * For text that never reaches the DOM (alert() boxes): translated only while the
 * app is in Amharic, otherwise returned untouched.
 */
export function translateIfAmharic(str) {
  if (typeof document === 'undefined' || document.documentElement.lang !== 'am') return str;
  return translateText(str);
}
