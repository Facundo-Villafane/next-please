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
  { k: 'first_pay', icon: 'cash', name: 'Primer sueldo', desc: 'Cobraste tu primer mes.' },
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
  { k: 'in_debt', icon: 'emoticon-cry-outline', name: 'Vivo en cuotas', desc: 'Cerraste un mes con los ahorros en negativo.' },
  { k: 'saver', icon: 'piggy-bank', name: 'Ahorrista', desc: 'Juntaste $ 1.000.000 de ahorros.' },
  { k: 'first_car', icon: 'car-side', name: 'Primer auto', desc: 'Te compraste un auto. Chau colectivo.' },
  { k: 'nice_home', icon: 'home-heart', name: 'Mudanza con estilo', desc: 'Te mudaste a un depto o a una casa.' },
];

// Liquidación de un día de counter: devuelve las líneas del recibo y el neto
export function settleCounter(results, eventLog = [], hints = 0, rank = RANKS[0], extra = [], perks = {}) {
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
  if (perks.idiomas) { const n = results.filter((r) => r.ev.correct && r.pax.lang && r.pax.lang !== 'es').length; add('Bono por idiomas (pasajeros extranjeros)', n * 600, n); }
  extra.forEach((l) => add(l.label, l.amount));
  const net = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, net, okPax, total: results.length, inad, perfectDay, impostors };
}

// Liquidación de un día de puerta
export function settleGate(gate, hints = 0, rank = RANKS[0], extra = []) {
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
  extra.forEach((l) => add(l.label, l.amount));
  const net = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, net, okPax, total: gate.results.length, inad: gate.critical || 0, perfectDay: !bad && !critBoard && !gate.critical, impostors: 0 };
}

// XP de un día: lo bueno suma, lo grave resta (sin bajar de cero)
export const xpOf = (settle) => Math.max(40, settle.okPax * 30 + (settle.perfectDay ? 150 : 0) - settle.inad * 60);

// ------------------------------------------------------------------
// ECONOMÍA MENSUAL: cómo vive el agente (vivienda, transporte, comida) y lo que compra.
// El sueldo se acumula día a día y se cobra al terminar la semana 4 de cada mes.
// ------------------------------------------------------------------
export const WEEKS_PER_MONTH = 4;
export const LIFE = {
  home: {
    label: 'Vivienda', icon: 'home',
    options: {
      pieza: { name: 'Pieza compartida en Monte Grande', cost: 120000, far: 2, desc: 'Barata. Lejos, y el baño se comparte con cuatro.' },
      mono: { name: 'Monoambiente en Ezeiza', cost: 230000, far: 1, desc: 'Chiquito, pero a quince minutos del aeropuerto.' },
      depto: { name: 'Depto de 2 ambientes en Ezeiza', cost: 340000, far: 0, desc: 'Cerca del trabajo y con lugar para la bicicleta fija que nunca usás.' },
      casa: { name: 'Casa con patio en Canning', cost: 520000, far: 1, desc: 'Parrilla, patio y vecinos que cortan el pasto un domingo a las ocho.' },
    },
  },
  transport: {
    label: 'Transporte', icon: 'bus',
    options: {
      colectivo: { name: 'Colectivo', cost: 30000, late: [0.1, 0.2, 0.32], desc: 'Barato. A veces llegás tarde: descuento y una fila de mal humor.' },
      remis: { name: 'Remis', cost: 160000, late: [0.04, 0.05, 0.07], desc: 'Caro, pero casi siempre llegás a horario.' },
      moto: { name: 'Moto propia', cost: 55000, late: [0.03, 0.04, 0.05], needs: 'moto', incident: 0.05, desc: 'Seguro y nafta. Rápida, salvo que llueva.' },
      auto: { name: 'Auto propio', cost: 145000, late: [0.02, 0.02, 0.03], needs: 'auto', incident: 0.06, desc: 'Seguro, nafta y patente. Llegás seco y a horario... salvo una goma pinchada.' },
    },
  },
  food: {
    label: 'Comida', icon: 'food',
    options: {
      vianda: { name: 'Vianda casera', cost: 110000, forget: 0.15, desc: 'Barata. A veces queda en la heladera de tu casa.' },
      aeropuerto: { name: 'Comer en el aeropuerto', cost: 260000, desc: 'Un tostado al precio de un vuelo. Pero no te olvidás nada.' },
    },
  },
};
export const SERVICES = 60000; // luz, gas, internet, celular
export const MOVE_COST = 50000;
export const DEFAULT_LIFE = { home: 'pieza', transport: 'colectivo', food: 'vianda' };
export const SHOP = [
  { k: 'moto', icon: 'motorbike', name: 'Moto usada', price: 900000, desc: 'Habilita la moto como transporte: casi nunca llegás tarde.' },
  { k: 'auto', icon: 'car', name: 'Auto usado', price: 2400000, desc: 'Habilita el auto: no llegás tarde y llegás seco. Seguro y nafta aparte.' },
  { k: 'idiomas', icon: 'translate', name: 'Curso de inglés y portugués', price: 350000, desc: '+$ 600 por cada pasajero extranjero bien atendido.' },
  { k: 'zapatillas', icon: 'shoe-sneaker', name: 'Zapatillas cómodas', price: 80000, desc: 'En los días de desafío, la fila se impacienta un 20 % más lento (vos estás de mejor humor).' },
  { k: 'cafetera', icon: 'coffee-maker', name: 'Cafetera propia', price: 120000, desc: 'Chau descuento del "café de la máquina" en el recibo.' },
  { k: 'mate', icon: 'cup', name: 'Mate y termo en el mostrador', price: 40000, desc: 'Decoración: se ve en tu mostrador. Viviana te pide uno.' },
  { k: 'planta', icon: 'sprout', name: 'Plantita para el mostrador', price: 25000, desc: 'Decoración: se ve en tu mostrador. Hay que regarla (no, mentira).' },
  { k: 'foto', icon: 'image-frame', name: 'Foto en el mostrador', price: 15000, desc: 'Decoración: un portarretrato al lado del monitor.' },
];
export const COFFEE = 6000; // "café de la máquina", por mes

export function lifeOf(c) { return { ...DEFAULT_LIFE, ...(c.life || {}) }; }
// Gastos del mes según cómo vive
export function monthExpenses(c) {
  const L = lifeOf(c), owned = c.owned || {};
  const lines = [
    { label: `Alquiler · ${LIFE.home.options[L.home].name}`, amount: -LIFE.home.options[L.home].cost },
    { label: `Transporte · ${LIFE.transport.options[L.transport].name}`, amount: -LIFE.transport.options[L.transport].cost },
    { label: `Comida · ${LIFE.food.options[L.food].name}`, amount: -LIFE.food.options[L.food].cost },
    { label: 'Servicios (luz, gas, internet, celular)', amount: -SERVICES },
  ];
  if (!owned.cafetera) lines.push({ label: 'Café de la máquina (Viviana no invita)', amount: -COFFEE });
  return lines;
}
// Lo que pasa al llegar a trabajar (según dónde vive y cómo viaja)
export function commuteRoll(c) {
  const L = lifeOf(c);
  const far = LIFE.home.options[L.home].far;
  const T = LIFE.transport.options[L.transport];
  const F = LIFE.food.options[L.food];
  const out = { late: Math.random() < T.late[far], incident: T.incident && Math.random() < T.incident ? (L.transport === 'auto' ? pick([['Se te pinchó una goma: gomería', 25000], ['Service del auto (ruido raro en el tren delantero)', 85000], ['Multa por estacionar en la dársena de remises', 40000]]) : pick([['Se te pinchó la rueda de la moto', 15000], ['Te mojaste entero/a: tintorería del uniforme', 12000]])) : null, forgot: !!F.forget && Math.random() < F.forget };
  return out;
}
