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
