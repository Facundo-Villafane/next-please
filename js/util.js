// Utilidades generales: azar, fechas y texto.

export const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const rndf = (a, b, dec = 1) => +(Math.random() * (b - a) + a).toFixed(dec);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dayOnly(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
export function addYears(d, n) {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
}
export function sameDay(a, b) {
  return dayOnly(a).getTime() === dayOnly(b).getTime();
}
export function ageOn(dob, date) {
  let age = date.getFullYear() - dob.getFullYear();
  const m = date.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && date.getDate() < dob.getDate())) age--;
  return age;
}

const MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MON_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const pad = (n, l = 2) => String(n).padStart(l, '0');

export const fmtDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
// Formato tipo DCS/GDS: 07OCT26
export const fmtGds = (d) => `${pad(d.getDate())}${MON_EN[d.getMonth()]}${String(d.getFullYear()).slice(2)}`;
// Formato de pasaporte bilingüe: 07 OCT/OCT 2026
export const fmtPass = (d) => `${pad(d.getDate())} ${MON_ES[d.getMonth()]}/${MON_EN[d.getMonth()]} ${d.getFullYear()}`;
export const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const yymmdd = (d) => `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

export function timeToday(base, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const norm = (s) => stripAccents(String(s)).toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function randomLetters(n, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ') {
  let s = '';
  for (let i = 0; i < n; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
export function randomDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

// ------------------------------------------------------------------
// Guardado de estados complejos (la puerta de embarque): conserva referencias compartidas
// y ciclos (p. ej. la pareja con tarjetas cruzadas), fechas y Sets. Omite funciones.
// ------------------------------------------------------------------
export function packGraph(value) {
  const nodes = [];
  const ids = new Map();
  const enc = (v) => {
    if (typeof v === 'function' || v === undefined) return undefined;
    if (v === null || typeof v !== 'object') return v;
    if (v instanceof Date) return { $d: v.toISOString() };
    if (ids.has(v)) return { $r: ids.get(v) };
    const id = nodes.length;
    ids.set(v, id);
    nodes.push(null);
    let out;
    if (v instanceof Set) out = { $s: [...v].map(enc) };
    else if (Array.isArray(v)) out = v.map((x) => { const e = enc(x); return e === undefined ? null : e; });
    else {
      out = {};
      Object.keys(v).forEach((k) => { const e = enc(v[k]); if (e !== undefined) out[k] = e; });
    }
    nodes[id] = out;
    return { $r: id };
  };
  const root = enc(value);
  return JSON.stringify({ root, nodes });
}

export function unpackGraph(str) {
  const { root, nodes } = JSON.parse(str);
  const built = [];
  const dec = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if ('$d' in v) return new Date(v.$d);
    if ('$r' in v) return get(v.$r);
    return v;
  };
  const get = (i) => {
    if (built[i]) return built[i];
    const n = nodes[i];
    if (n && !Array.isArray(n) && '$s' in n) { const s = new Set(); built[i] = s; n.$s.forEach((x) => s.add(dec(x))); return s; }
    if (Array.isArray(n)) { const a = []; built[i] = a; n.forEach((x) => a.push(dec(x))); return a; }
    const o = {};
    built[i] = o;
    Object.keys(n).forEach((k) => { o[k] = dec(n[k]); });
    return o;
  };
  return dec(root);
}


// "hace 5 minutos", "hace 2 horas", "el 08/10"
export function fmtAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  if (m < 24 * 60) return `hace ${Math.round(m / 60)} h`;
  const d = new Date(t);
  return `el ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Fecha local "2026-10-09" (el día real, para el turno del día y el presentismo)
export function dateKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Azar con semilla: mientras dura, Math.random da siempre la misma secuencia. Devuelve la función para volver atrás.
export function seedRandom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  const orig = Math.random;
  Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return () => { Math.random = orig; };
}
