// PROGRESO DEL AGENTE (en el navegador, por nombre de jugador):
//  · Habilidad por caso: qué casos falla más (para que aparezcan más seguido) y qué vio hace poco
//    (para que no se repitan). Lo alimentan Práctica, Historia y Carrera.
//  · Carrera (modo sin fin): experiencia, rango, plata, semana/día, estadísticas e hitos.
import { FLIGHTS } from './data.js';
import { SCENARIOS } from './generator.js';
import { getPlayer } from './player.js';
import { pick, shuffle, timeToday, dayOnly } from './util.js';

const KEY = 'ckProgress';
const who = () => getPlayer().name || 'Agente';
function loadAll() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function saveAll(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {} }
export function load() {
  const all = loadAll();
  const p = all[who()] || {};
  p.skills = p.skills || {};
  p.recent = p.recent || [];
  p.stats = p.stats || { pax: 0, ok: 0, inad: 0, wrongDeny: 0, bestStreak: 0, streak: 0, days: 0, perfectDays: 0, events: {} };
  p.career = p.career || { xp: 0, money: 0, week: 1, day: 1, weekLedger: [], history: [], milestones: {}, bestDay: 0 };
  return p;
}
export function save(p) { const all = loadAll(); all[who()] = p; saveAll(all); }
// Al cambiar de nombre en el perfil, el progreso se muda
export function renameProgress(from, to) {
  const all = loadAll();
  if (all[from] && !all[to]) { all[to] = all[from]; delete all[from]; saveAll(all); }
}

// ------------------------------------------------------------------
// Temas (para las estadísticas del perfil)
// ------------------------------------------------------------------
export const TOPICS = {
  doc: 'Documentos y validez', visa: 'Visas y autorizaciones', minors: 'Menores y familias', identity: 'Identidad y reserva',
  health: 'Gestantes y alcohol', legal: 'Detenidos y deportados', domestic: 'Cabotaje', ret: 'Pasaje de regreso', conflict: 'Pasajeros difíciles', ok: 'Pasajeros en regla',
};
export function topicOf(s) {
  if (/^(minor|um_|family|one_parent|relative|infant|deceased|court|consul|tutor)/.test(s)) return 'minors';
  if (/^(no_visa|visa_|no_esta|us_br)/.test(s)) return 'visa';
  if (/^(expired|validity|dni_)/.test(s)) return 'doc';
  if (/^(impostor|name_typo|no_ticket|wrong_date|late)/.test(s)) return 'identity';
  if (/^(pregnant|drunk)/.test(s)) return 'health';
  if (/^(depa|depo|depu)/.test(s)) return 'legal';
  if (/^dom_/.test(s)) return 'domestic';
  if (/return/.test(s)) return 'ret';
  if (/^(vip_angry|angry|bomb)/.test(s)) return 'conflict';
  return 'ok';
}

// ------------------------------------------------------------------
// Peso de cada caso al armar un turno: más si lo falla, menos si lo vio hace poco
// ------------------------------------------------------------------
export function weightFn() {
  const p = load();
  const recent = new Set(p.recent);
  return (s) => {
    const k = p.skills[s];
    let w = 1;
    if (k && k.n) w *= 1 + 2.5 * (k.bad / k.n) + (k.lastBad ? 1 : 0);
    if (recent.has(s) && s !== 'ok') w *= 0.25;
    return w;
  };
}

// Registra las atenciones del counter de un turno (cualquier modo)
export function recordCounter(results) {
  const p = load();
  results.forEach((r) => {
    const s = r.pax.scenario;
    const k = (p.skills[s] = p.skills[s] || { n: 0, bad: 0, lastBad: false });
    k.n++;
    if (!r.ev.correct) k.bad++;
    k.lastBad = !r.ev.correct;
    p.stats.pax++;
    if (r.ev.correct) { p.stats.ok++; p.stats.streak++; p.stats.bestStreak = Math.max(p.stats.bestStreak, p.stats.streak); } else p.stats.streak = 0;
    if (r.decision.kind === 'accept' && r.ev.analysis.expected === 'reject') p.stats.inad++;
    if (r.decision.kind !== 'accept' && r.ev.analysis.expected === 'accept') p.stats.wrongDeny++;
  });
  // Los casos de este turno quedan como "recientes" (los últimos ~2 turnos)
  p.recent = [...results.map((r) => r.pax.scenario), ...p.recent].slice(0, 30);
  save(p);
  return p;
}

// Fortalezas y debilidades por tema
export function topicStats(p = load()) {
  const t = {};
  Object.entries(p.skills).forEach(([s, k]) => {
    if (!SCENARIOS[s]) return;
    const tp = topicOf(s);
    t[tp] = t[tp] || { n: 0, bad: 0 };
    t[tp].n += k.n; t[tp].bad += k.bad;
  });
  return Object.entries(t).map(([k, v]) => ({ key: k, label: TOPICS[k], n: v.n, pct: Math.round(((v.n - v.bad) / v.n) * 100) })).sort((a, b) => b.n - a.n);
}

// ------------------------------------------------------------------
// Vuelos y hora del turno al azar (que no sea siempre el mismo día)
// ------------------------------------------------------------------
export function randomShift(nFlights = 3) {
  const starts = ['17:20', '17:40', '18:00', '18:15', '18:30', '18:50'];
  for (let tries = 0; tries < 10; tries++) {
    const start = pick(starts);
    const today = dayOnly(new Date());
    const st = timeToday(today, start);
    // Vuelos con el check-in abierto (o por abrir pronto) y con margen antes del cierre
    const ok = FLIGHTS.filter((f) => {
      const dep = timeToday(today, f.dep);
      const open = dep - f.open * 60000, close = dep - f.close * 60000;
      return open <= st.getTime() + 25 * 60000 && close >= st.getTime() + 45 * 60000;
    });
    if (ok.length >= 2) return { start, flights: shuffle(ok).slice(0, Math.min(nFlights, ok.length)).map((f) => f.no) };
  }
  return { start: '18:15', flights: null };
}

// ------------------------------------------------------------------
// CARRERA: rangos, plata e hitos
// ------------------------------------------------------------------
export const RANKS = [
  { name: 'Trainee', xp: 0, pay: 18000, icon: 'school', level: 'basico', pax: 10, flights: 2, events: 0.25 },
  { name: 'Agente Junior', xp: 1200, pay: 22000, icon: 'account', level: 'basico', pax: 12, flights: 2, events: 0.35 },
  { name: 'Agente', xp: 3500, pay: 27000, icon: 'account-tie', level: 'intermedio', pax: 14, flights: 3, events: 0.45 },
  { name: 'Agente Senior', xp: 7500, pay: 33000, icon: 'star-circle', level: 'intermedio', pax: 16, flights: 3, events: 0.55 },
  { name: 'Líder de turno', xp: 13000, pay: 40000, icon: 'shield-star', level: 'avanzado', pax: 18, flights: 4, events: 0.65 },
  { name: 'Supervisor/a', xp: 21000, pay: 48000, icon: 'crown', level: 'avanzado', pax: 20, flights: 4, events: 0.75 },
];
export const rankOf = (xp) => RANKS.reduce((r, x, i) => (xp >= x.xp ? i : r), 0);

// Montos (pesos de Aeroplata)
export const MONEY = {
  okPax: 1500, perfectPax: 500, streak5: 2500, perfectDay: 8000, eventOk: 1500, gateOk: 1200,
  inad: -18000, wrongDeny: -7000, wrongOther: -3000, procError: -500, eventBad: -2500, gateCritical: -18000, gateProc: -600, hint: -300,
};
export const fmtMoney = (n) => `${n < 0 ? '−' : ''}$ ${Math.abs(Math.round(n)).toLocaleString('es-AR')}`;

export const MILESTONES = [
  { k: 'first_day', icon: 'briefcase-check', name: 'Primer día', desc: 'Terminaste tu primer día de carrera.' },
  { k: 'first_pay', icon: 'cash', name: 'Primer sueldo', desc: 'Cobraste tu primera semana.' },
  { k: 'pax100', icon: 'account-multiple', name: '100 pasajeros', desc: 'Atendiste 100 pasajeros.' },
  { k: 'pax500', icon: 'account-group', name: '500 pasajeros', desc: 'Atendiste 500 pasajeros.' },
  { k: 'streak10', icon: 'fire', name: 'Racha de 10', desc: '10 decisiones correctas seguidas.' },
  { k: 'streak25', icon: 'fire-circle', name: 'Racha de 25', desc: '25 decisiones correctas seguidas.' },
  { k: 'perfect_day', icon: 'star-shooting', name: 'Día perfecto', desc: 'Un día sin una sola decisión equivocada.' },
  { k: 'clean_week', icon: 'shield-check', name: 'Semana sin INAD', desc: 'Una semana entera sin aceptar a nadie que no podía viajar.' },
  { k: 'impostors5', icon: 'incognito', name: 'Ojo de halcón', desc: 'Frenaste a 5 impostores.' },
  { k: 'promo1', icon: 'arrow-up-bold-circle', name: 'Primer ascenso', desc: 'Subiste de rango.' },
  { k: 'rank_max', icon: 'crown', name: 'Supervisor/a', desc: 'Llegaste al rango máximo. Viviana tiembla.' },
  { k: 'million', icon: 'bank', name: 'Millonario/a', desc: 'Ganaste $ 1.000.000 en total.' },
  { k: 'all_events', icon: 'alert-decagram', name: 'Lo vi todo', desc: 'Viviste los cinco imprevistos.' },
  { k: 'in_debt', icon: 'emoticon-cry-outline', name: 'Le debo a la empresa', desc: 'Terminaste una semana con saldo negativo.' },
];

// Liquidación de un día de counter: devuelve las líneas del recibo y el neto
export function settleCounter(results, eventLog = [], hints = 0, rank = RANKS[0]) {
  const lines = [];
  const add = (label, amount, n = null) => { if (amount) lines.push({ label, amount, n }); };
  let streak = 0, streakBonus = 0, okPax = 0, perfect = 0, inad = 0, wrongDeny = 0, wrongOther = 0, proc = 0, impostors = 0;
  results.forEach((r) => {
    const errs = r.ev.items.filter((x) => x.ok === false).length;
    if (r.ev.correct) {
      okPax++; streak++;
      if (streak % 5 === 0) streakBonus++;
      if (!errs) perfect++;
      if (r.pax.scenario === 'impostor') impostors++;
    } else {
      streak = 0;
      if (r.decision.kind === 'accept' && r.ev.analysis.expected === 'reject') inad++;
      else if (r.decision.kind !== 'accept' && r.ev.analysis.expected === 'accept') wrongDeny++;
      else wrongOther++;
    }
    proc += Math.min(4, r.ev.correct ? errs : Math.max(0, errs - 1));
  });
  add(`Jornal (${rank.name})`, rank.pay);
  add('Pasajeros bien atendidos', okPax * MONEY.okPax, okPax);
  add('Atenciones impecables', perfect * MONEY.perfectPax, perfect);
  add('Bono por racha (cada 5 seguidos)', streakBonus * MONEY.streak5, streakBonus);
  const perfectDay = results.length && !inad && !wrongDeny && !wrongOther;
  if (perfectDay) add('Día perfecto', MONEY.perfectDay);
  const evOk = eventLog.filter((x) => x.ok === true).length, evBad = eventLog.filter((x) => x.ok === false).length;
  add('Imprevistos bien manejados', evOk * MONEY.eventOk, evOk);
  add('Multa: pasajero inadmisible aceptado (INAD)', inad * MONEY.inad, inad);
  add('Multa: denegación injustificada', wrongDeny * MONEY.wrongDeny, wrongDeny);
  add('Multa: otras decisiones equivocadas', wrongOther * MONEY.wrongOther, wrongOther);
  add('Descuento: errores de procedimiento', proc * MONEY.procError, proc);
  add('Descuento: imprevistos mal manejados', evBad * MONEY.eventBad, evBad);
  add('Descuento: consultas a Viviana ("su tiempo vale")', hints * MONEY.hint, hints);
  const net = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, net, okPax, total: results.length, inad, perfectDay, impostors };
}

// Liquidación de un día de puerta
export function settleGate(gate, hints = 0, rank = RANKS[0]) {
  const lines = [];
  const add = (label, amount, n = null) => { if (amount) lines.push({ label, amount, n }); };
  const okPax = gate.results.filter((r) => r.decision.kind === r.expected.kind).length;
  // Embarcar a quien no podía ya es error crítico (multa grande): no se cobra dos veces como "decisión equivocada"
  const critBoard = gate.results.filter((r) => r.decision.kind === 'board' && r.expected.kind === 'deny').length;
  const bad = gate.results.length - okPax - critBoard;
  const procBad = gate.proc.filter((x) => x.ok === false).length;
  add(`Jornal (${rank.name})`, rank.pay);
  add('Pasajeros bien resueltos en el podio', okPax * MONEY.gateOk, okPax);
  if (!bad && !critBoard && !gate.critical) add('Embarque perfecto', MONEY.perfectDay);
  add('Multa: errores críticos (embarcó a quien no podía / valija sin pasajero)', (gate.critical || 0) * MONEY.gateCritical, gate.critical || 0);
  add('Multa: decisiones equivocadas en el podio', bad * MONEY.wrongOther, bad);
  add('Descuento: errores de procedimiento', procBad * MONEY.gateProc, procBad);
  add('Descuento: consultas a Viviana', hints * MONEY.hint, hints);
  const net = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, net, okPax, total: gate.results.length, inad: gate.critical || 0, perfectDay: !bad && !critBoard && !gate.critical, impostors: 0 };
}

// XP de un día: lo bueno suma, lo grave resta (sin bajar de cero)
export const xpOf = (settle) => Math.max(40, settle.okPax * 30 + (settle.perfectDay ? 150 : 0) - settle.inad * 60);
