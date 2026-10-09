// CARRERA (modo sin fin, se habilita al terminar la historia): días de trabajo de lunes a viernes,
// jornal según el rango, bonos por aciertos y rachas, multas por errores, recibo de sueldo semanal,
// ascensos, perfil con estadísticas e hitos. Los turnos se arman al azar (ver generator.buildSmartDeck).
import { FLIGHTS } from './data.js';
import { buildSmartDeck } from './generator.js';
import { faceSVG } from './docs.js';
import { SUP } from './supervisor.js';
import { getPlayer, gtxt, playerFace } from './player.js';
import { esc, pick, chance, rnd, fmtAgo, dateKey } from './util.js';
import { sfx } from './sound.js';
import { load, save, weightFn, randomShift, RANKS, rankOf, settleCounter, settleGate, xpOf, fmtMoney, MILESTONES, topicStats, WEEKS_PER_MONTH, LIFE, SHOP, MOVE_COST, lifeOf, monthExpenses, commuteRoll, markPresence, PRESENCE_BONUS, presence } from './progress.js';

const $ = (s) => document.querySelector(s);
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const GATE_DAY = 3; // los miércoles toca la puerta de embarque
let api;

export function initEndless(a) { api = a; }

// Se habilita al terminar el Día 4 de la historia (el pin de Aeroplata)
export function careerUnlocked() {
  try {
    const p = JSON.parse(localStorage.getItem('ckCareer') || '{}');
    return !!(p[getPlayer().name || 'Agente'] || {})[4];
  } catch { return false; }
}

const viv = (text) => `<div class="story"><div class="who">${faceSVG(SUP.face, { w: 70, h: 88, bg: '#dce7f0' })}<b>${SUP.short}</b></div><div class="says"><p>${gtxt(text)}</p></div></div>`;
const rankTile = (r, big) => `<span class="icoTile ${['b', 'b', 'y', 'y', 'o', 'o'][r]} ${big ? 'big' : ''}"><i class="mdi mdi-${RANKS[r].icon}"></i></span>`;
function xpBar(xp) {
  const r = rankOf(xp), cur = RANKS[r], next = RANKS[r + 1];
  const pct = next ? Math.round(((xp - cur.xp) / (next.xp - cur.xp)) * 100) : 100;
  return `<div class="xpBar"><i style="width:${pct}%"></i></div><small>${next ? `${xp.toLocaleString('es-AR')} / ${next.xp.toLocaleString('es-AR')} XP · próximo rango: <b>${esc(gtxt(next.name))}</b>` : `${xp.toLocaleString('es-AR')} XP · rango máximo`}</small>`;
}

// ------------------------------------------------------------------
// Centro de la carrera
// ------------------------------------------------------------------
const monthOf = (c) => Math.floor((c.week - 1) / WEEKS_PER_MONTH) + 1;
const weekInMonth = (c) => ((c.week - 1) % WEEKS_PER_MONTH) + 1;
const ensure = (c) => { c.pending = c.pending || 0; c.weekTotals = c.weekTotals || []; c.owned = c.owned || {}; c.life = lifeOf(c); return c; };
const expensesTotal = (c) => -monthExpenses(c).reduce((s, l) => s + l.amount, 0);
const decorOf = (c) => ['mate', 'planta', 'foto'].filter((k) => c.owned[k]);

export function showCareerHub() {
  const p = load(), c = ensure(p.career);
  const r = rankOf(c.xp), R = RANKS[r];
  const weekNet = c.weekLedger.reduce((s, d) => s + d.net, 0);
  const isGate = c.day === GATE_DAY;
  api.openModal(`<div class="home career">
    <h1>💼 Carrera en Aeroplata</h1>
    <div class="rankCard">${rankTile(r, true)}<div><small>Tu rango</small><b>${esc(gtxt(R.name))}</b>${xpBar(c.xp)}</div>
      <div class="money"><small>Ahorros</small><b class="${c.money < 0 ? 'neg' : ''}">${fmtMoney(c.money)}</b><small>A cobrar este mes: <b class="inl">${fmtMoney(c.pending)}</b></small></div></div>
    ${presenceHTML()}
    <div class="weekRow">${DAYS.map((d, i) => {
      const done = c.weekLedger.find((x) => x.day === i + 1);
      return `<div class="wd ${i + 1 === c.day ? 'today' : ''} ${done ? 'done' : ''}"><small>${d}</small><i class="mdi mdi-${i + 1 === GATE_DAY ? 'airplane-takeoff' : 'account-tie-voice'}"></i><b>${done ? fmtMoney(done.net) : i + 1 === c.day ? 'Hoy' : '—'}</b></div>`;
    }).join('')}</div>
    <p class="hint">Mes ${monthOf(c)} · semana ${weekInMonth(c)} de ${WEEKS_PER_MONTH} · esta semana llevás ${fmtMoney(weekNet)}. El sueldo se cobra al terminar la semana ${WEEKS_PER_MONTH}, con los gastos del mes (≈ ${fmtMoney(expensesTotal(c))}).
      Hoy: <b>${DAYS[c.day - 1]}</b>, ${isGate ? 'te toca la <b>puerta de embarque</b>' : `<b>counter</b> con ${R.pax} pasajeros y ${R.flights} vuelos`}. Jornal: ${fmtMoney(R.pay)}.</p>
    <div class="row end gap wrap">
      <button class="btn ghost" id="cBack">← Volver</button>
      <button class="btn" id="cLife"><i class="mdi mdi-home-heart"></i> Mi vida y compras</button>
      <button class="btn" id="cProfile"><i class="mdi mdi-chart-bar"></i> Perfil</button>
      <button class="btn ok big" id="cGo">Empezar el ${DAYS[c.day - 1].toLowerCase()} ▶</button>
    </div></div>`, 'wide');
  $('#cBack').onclick = () => api.showPlay();
  $('#cProfile').onclick = () => showProfileStats(showCareerHub);
  $('#cLife').onclick = showLife;
  const pend = careerSave();
  if (pend) {
    $('.career .hint').insertAdjacentHTML('afterend', `<div class="resume"><span class="icoTile y"><i class="mdi mdi-content-save-check"></i></span>
      <div><b>Tenés el ${DAYS[c.day - 1].toLowerCase()} a medias</b><small>${pend.where}, guardado ${fmtAgo(pend.at)}.</small></div>
      <button class="btn ok" id="cResume">Seguir ▶</button></div>`);
    $('#cResume').onclick = () => resumeCareer(pend);
    $('#cGo').textContent = 'Empezar de nuevo';
    $('#cGo').classList.remove('ok', 'big');
  }
  $('#cGo').onclick = async () => {
    if (pend && !(await api.confirm({ title: 'Día a medias', text: `Si empezás el ${DAYS[c.day - 1].toLowerCase()} de nuevo, se descarta lo que tenías guardado de hoy. ¿Seguir igual?`, ok: 'Empezar de nuevo', cancel: 'Volver', icon: 'content-save-alert' }))) return;
    clearCareerSave();
    startDay();
  };
}

// ------------------------------------------------------------------
// Guardado del día de carrera (aparte de la historia): counter por pasajero o puerta
// ------------------------------------------------------------------
const C_SHIFT = 'ckCShift', C_GATE = 'ckCGate';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function careerSave() {
  const c = load().career, name = getPlayer().name || 'Agente';
  const read = (k, dates) => { try { return JSON.parse(localStorage.getItem(k) || 'null', dates ? (key, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v) : undefined); } catch { return null; } };
  const ok = (s) => s && s.name === name && s.week === c.week && s.day === c.day;
  const sh = read(C_SHIFT, true), gt = read(C_GATE, false);
  if (ok(sh)) return { kind: 'counter', saved: sh, at: sh.at, where: `Counter: atendiste ${sh.snap.idx + 1} de ${sh.snap.pax.length} pasajeros` };
  if (ok(gt)) return { kind: 'gate', saved: gt, at: gt.at, where: gt.closed ? 'Puerta: vuelo cerrado, falta el informe' : `Puerta de embarque: ${gt.boarded} de ${gt.checked} a bordo` };
  return null;
}
function clearCareerSave() { [C_SHIFT, C_GATE].forEach((k) => { try { localStorage.removeItem(k); } catch {} }); }
// Para el inicio: si hay un día de carrera a medias
export function careerPending() {
  if (!careerUnlocked()) return null;
  const s = careerSave();
  return s ? { mode: 'career', at: s.at, label: `Carrera · ${DAYS[load().career.day - 1]} · ${s.kind === 'gate' ? 'puerta de embarque' : 'counter'}` } : null;
}
function careerTag(key, extra) {
  const c = load().career;
  return { key, name: getPlayer().name || 'Agente', week: c.week, day: c.day, extra };
}
function resumeCareer(pend) {
  const c = ensure(load().career);
  const s = pend.saved;
  today = { extra: s.extra || [] };
  api.closeModal();
  api.setStudent(getPlayer().name || 'Agente');
  api.storyLine(viv(pick(['Volviste. Tu puesto quedó como lo dejaste. Nadie lo tocó: nadie quiere tu laburo.', 'Ah, apareciste. Seguimos donde estabas, que el reloj no espera a nadie.'])), () => {
    if (pend.kind === 'gate') {
      api.resumeBoarding(s, { onDone: (gate) => dayEnd({ type: 'gate', gate }), saveTag: careerTag(C_GATE, today.extra) });
      return;
    }
    api.resumeCheckin(s, {
      counterLabel: 'Mostrador 22 · Carrera', signLabel: 'CARRERA · AEROPLATA',
      perkShoes: !!c.owned.zapatillas, decor: decorOf(c),
      onEnd: (results, score, queueLog) => dayEnd({ type: 'counter', results, queueLog }),
      saveTag: careerTag(C_SHIFT, today.extra),
    });
  }, 'Volver al puesto ▶');
}

// Racha de presentismo (días reales seguidos)
function presenceHTML() {
  const pr = presence();
  const paid = load().career.presencePaid === dateKey();
  const next = PRESENCE_BONUS(pr.today ? pr.streak : pr.streak + 1);
  return `<div class="presence ${paid ? 'done' : ''}"><i class="mdi mdi-fire"></i><div><b>Presentismo: ${pr.streak === 1 ? '1 día' : `${pr.streak} días seguidos`}</b>
    <small>${paid ? 'Hoy ya cobraste el presentismo. Volvé mañana para que la racha siga.' : `Tu primer día de carrera de hoy cobra ${fmtMoney(next)} de presentismo (más cuantos más días seguidos vengas, hasta ${fmtMoney(PRESENCE_BONUS(10))}). La racha suma con la carrera o con el Turno del día; si faltás un día, vuelve a cero.`}</small></div></div>`;
}

const START_LINES = [
  'Otro día, otro dólar. Bueno, otro peso. Devaluado.',
  'Llegaste puntual. Anotado. No te lo voy a decir de nuevo.',
  'Hoy viene lleno. Siempre viene lleno. Andá.',
  'Te dejo los vuelos del día en el tablero. Leelos, no los mires.',
  'Café, credencial y paciencia. Las tres cosas, ¿eh?',
  'Si hoy no hay multas, te invito un café. De la máquina. No te emociones.',
];
const LATE_LINES = [
  'Llegaste tarde. El colectivo, ¿no? Siempre el colectivo. Te lo descuento, obvio. Y la fila ya está que arde.',
  'Veinte minutos tarde. Yo vengo desde hace treinta y un años y nunca... bueno, casi nunca. Descuento de presentismo.',
  'Mirá la hora. Mirá la fila. Ahora mirá tu recibo de sueldo, que ahí también se va a notar.',
];
const addMin = (hhmm, m) => { const [h, mi] = hhmm.split(':').map(Number); const t = h * 60 + mi + m; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
let today = null; // lo que pasó al llegar a trabajar (tarde, vianda, imprevisto del viaje)

function startDay() {
  const p = load(), c = ensure(p.career);
  const r = rankOf(c.xp), R = RANKS[r];
  const name = getPlayer().name || 'Agente';
  api.closeModal();
  api.setStudent(name);
  const roll = commuteRoll(c);
  today = { extra: [] };
  if (roll.late) today.extra.push({ label: 'Descuento por llegada tarde (presentismo)', amount: -5000 });
  if (roll.forgot) today.extra.push({ label: 'Te olvidaste la vianda: almuerzo en el aeropuerto', amount: -6000 });
  if (roll.incident) today.extra.push({ label: `Imprevisto del viaje: ${roll.incident[0]}`, amount: -roll.incident[1] });
  const notes = [roll.forgot ? '¿Y la vianda? ¿Otra vez en la heladera? Hoy comés tostado de aeropuerto, a precio de oro.' : '', roll.incident ? `${roll.incident[0]}. Qué día empezaste, eh.` : ''].filter(Boolean).join(' ');
  const opener = (roll.late ? pick(LATE_LINES) : pick(START_LINES)) + (notes ? ` ${notes}` : '');
  if (c.day === GATE_DAY) {
    const fl = pick(FLIGHTS.filter((f) => f.country !== 'AR'));
    api.storyLine(viv(`${opener} Hoy es miércoles: <b>puerta de embarque</b>, el ${fl.no} a ${fl.city}. Embarque en orden, nadie sin escanear, y cerrame el vuelo a horario.`), () => {
      api.startBoarding({ student: name, level: R.level, mode: 'challenge', flightNo: fl.no, onDone: (gate) => dayEnd({ type: 'gate', gate }), saveTag: careerTag(C_GATE, today.extra) });
    });
    return;
  }
  const rs = randomShift(R.flights);
  const deck = buildSmartDeck(R.level, R.pax, weightFn());
  const flights = rs.flights;
  const label = flights ? `${flights.length} vuelos` : 'Todos los vuelos';
  api.storyLine(viv(`${opener} ${DAYS[c.day - 1]}: <b>${R.pax} pasajeros</b> en tu mostrador. Cada acierto suma, cada error se descuenta del sueldo.`), () => {
    api.startCheckin({
      deck, flights, start: roll.late ? addMin(rs.start, 20) : rs.start, mode: 'challenge', level: R.level, team: true, consults: true,
      events: chance(R.events) ? 'force' : false,
      outage: r >= 2 && chance(0.25) ? { afterPax: rnd(3, 6), duration: 3 } : null,
      patience: roll.late ? 65 : null, perkShoes: !!c.owned.zapatillas, decor: decorOf(c),
      counterLabel: `Mostrador 22 · ${label}`, signLabel: 'CARRERA · AEROPLATA',
      onEnd: (results, score, queueLog) => dayEnd({ type: 'counter', results, queueLog }),
      saveTag: careerTag(C_SHIFT, today.extra),
    });
  });
}

// ------------------------------------------------------------------
// Fin del día: liquidación, experiencia, hitos y ascensos
// ------------------------------------------------------------------
function dayEnd({ type, results, gate }) {
  clearCareerSave();
  // Presentismo: el primer turno de cada día real suma, y más si venís todos los días
  // (se marca antes de cargar el progreso, para que el guardado de abajo no lo pise)
  const pres = markPresence();
  const p = load(), c = ensure(p.career), st = p.stats;
  const r0 = rankOf(c.xp), R = RANKS[r0];
  const hints = api.hintCount();
  const evLog = type === 'counter' ? api.eventLog() : [];
  const extra = [...(today?.extra || [])];
  if (c.presencePaid !== dateKey()) { c.presencePaid = dateKey(); extra.push({ label: `Presentismo: ${pres.streak === 1 ? 'viniste hoy' : `${pres.streak} días seguidos`}`, amount: PRESENCE_BONUS(pres.streak) }); }
  const s = type === 'counter' ? settleCounter(results, evLog, hints, R, extra, c.owned) : settleGate(gate, hints, R, extra);
  const xp = xpOf(s);
  c.xp += xp;
  c.pending += s.net;
  c.earned = (c.earned || 0) + Math.max(0, s.net);
  c.bestDay = Math.max(c.bestDay || 0, s.net);
  c.weekLedger.push({ day: c.day, type, net: s.net, inad: s.inad });
  st.days++;
  if (s.perfectDay) st.perfectDays++;
  st.impostors = (st.impostors || 0) + s.impostors;
  if (type === 'gate') { st.pax += s.total; st.ok += s.okPax; }
  evLog.forEach((e) => { if (e.ev) st.events[e.ev] = true; });
  const r1 = rankOf(c.xp);
  const got = [];
  const give = (k, cond) => { if (cond && !c.milestones[k]) { c.milestones[k] = Date.now(); got.push(k); } };
  give('first_day', st.days >= 1);
  give('pax100', st.pax >= 100);
  give('pax500', st.pax >= 500);
  give('streak10', st.bestStreak >= 10);
  give('streak25', st.bestStreak >= 25);
  give('perfect_day', s.perfectDay);
  give('impostors5', st.impostors >= 5);
  give('promo1', r1 > 0);
  give('rank_max', r1 === RANKS.length - 1);
  give('million', c.earned >= 1000000);
  give('all_events', ['unattended', 'cancel', 'delay', 'celebrity', 'promo'].every((k) => st.events[k]));
  // Viernes: cierre de la semana; la semana 4 cierra el mes y se cobra
  let week = null, month = null;
  if (c.day === 5) {
    const total = c.weekLedger.reduce((t, d) => t + d.net, 0);
    week = { n: weekInMonth(c), total, days: c.weekLedger.slice() };
    give('clean_week', c.weekLedger.every((d) => !d.inad));
    c.weekTotals.push(total);
    c.history.push({ week: c.week, total });
    if (weekInMonth(c) === WEEKS_PER_MONTH) month = closeMonth(c, give);
    c.weekLedger = [];
    c.week++;
    c.day = 1;
  } else c.day++;
  save(p);

  const comment = s.net >= R.pay * 1.5 ? 'Mirá vos. Hoy hasta me caíste bien. No se lo cuentes a nadie.'
    : s.net >= R.pay ? 'Correcto. Nada para festejar, nada para llorar. Como mi sueldo.'
      : s.net > 0 ? 'Ganaste algo. Poco. Como todos acá. Mañana prestá más atención.'
        : 'Hoy le debés plata a la empresa. Bienvenido/a al club: yo le debo la juventud.';
  const dayName = DAYS[(week ? 5 : c.day - 1) - 1].toLowerCase();
  sfx(r1 > r0 ? 'levelUp' : 'cash');
  api.openModal(`<div class="home career dayPay">
    <h1>🧾 Liquidación del ${dayName} · ${type === 'gate' ? 'Puerta de embarque' : 'Counter'}</h1>
    ${r1 > r0 ? `<div class="promo">${rankTile(r1, true)}<div><small>¡Ascenso!</small><b>${esc(gtxt(RANKS[r1].name))}</b><p>Nuevo jornal: ${fmtMoney(RANKS[r1].pay)}. Más pasajeros, más vuelos y casos más difíciles.</p></div></div>` : ''}
    <table class="grid pay">${s.lines.map((l) => `<tr><td>${esc(l.label)}${l.n != null ? ` <small>×${l.n}</small>` : ''}</td><td class="num ${l.amount < 0 ? 'neg' : 'pos'}">${fmtMoney(l.amount)}</td></tr>`).join('')}
      <tr class="tot"><td>Neto del día (a cobrar a fin de mes)</td><td class="num ${s.net < 0 ? 'neg' : 'pos'}">${fmtMoney(s.net)}</td></tr></table>
    <p class="hint">+${xp} XP · ${s.okPax} de ${s.total} bien resueltos.</p>
    ${got.length ? `<div class="newMs"><b>🏅 ${got.length === 1 ? 'Nuevo hito' : 'Nuevos hitos'}</b>${got.map((k) => { const m = MILESTONES.find((x) => x.k === k); return `<div class="ms on"><i class="mdi mdi-${m.icon}"></i><div><b>${esc(gtxt(m.name))}</b><small>${esc(gtxt(m.desc))}</small></div></div>`; }).join('')}</div>` : ''}
    ${viv(comment)}
    <div class="row end"><button class="btn ok big" id="dpGo">${month ? 'Ver el recibo de sueldo del mes ▶' : week ? 'Ver el resumen de la semana ▶' : 'Seguir ▶'}</button></div></div>`, 'wide');
  $('#dpGo').onclick = () => (month ? showPayslip(month) : week ? showWeek(week, c) : backToHub());
}

function showWeek(week, c) {
  api.openModal(`<div class="home career">
    <h1>📅 Resumen de la semana ${week.n} de ${WEEKS_PER_MONTH}</h1>
    <table class="grid pay">${week.days.map((d) => `<tr><td>${DAYS[d.day - 1]} · ${d.type === 'gate' ? 'Puerta' : 'Counter'}</td><td class="num ${d.net < 0 ? 'neg' : 'pos'}">${fmtMoney(d.net)}</td></tr>`).join('')}
      <tr class="tot"><td>Total de la semana</td><td class="num ${week.total < 0 ? 'neg' : 'pos'}">${fmtMoney(week.total)}</td></tr></table>
    <p class="hint">Acumulado del mes, a cobrar al terminar la semana ${WEEKS_PER_MONTH}: <b>${fmtMoney(c.pending)}</b>. Gastos del mes estimados: ${fmtMoney(expensesTotal(c))}.</p>
    ${viv(week.total > 0 ? 'Una semana menos. Faltan como mil para la jubilación. Seguí así.' : 'Semana para el olvido. El lunes arrancamos de cero, como mi paciencia.')}
    <div class="row end"><button class="btn ok big" id="wkGo">Seguir ▶</button></div></div>`, 'wide');
  $('#wkGo').onclick = backToHub;
}

// Cierre del mes: se cobra lo acumulado, se pagan los gastos y, si hay deuda, la tarjeta cobra intereses
function closeMonth(c, give) {
  const before = c.money;
  const income = c.pending;
  const exp = monthExpenses(c);
  const interest = c.money < 0 ? Math.round(c.money * 0.08) : 0;
  const net = income + exp.reduce((s, l) => s + l.amount, 0) + interest;
  c.money += net;
  const weeks = c.weekTotals.slice();
  c.pending = 0;
  c.weekTotals = [];
  let forced = null;
  // Deuda mayor a un mes de gastos: mudanza obligada a la pieza compartida (y chau remis)
  if (c.money < -expensesTotal(c) && (c.life.home !== 'pieza' || c.life.transport === 'remis')) {
    forced = 'Con esa deuda, la inmobiliaria no te renovó: te mudaste a la pieza compartida en Monte Grande. Y el remis, se terminó.';
    c.life.home = 'pieza';
    if (c.life.transport === 'remis') c.life.transport = 'colectivo';
  }
  give('first_pay', true);
  give('in_debt', c.money < 0);
  give('saver', c.money >= 1000000);
  return { n: monthOf(c), weeks, income, exp, interest, net, before, after: c.money, forced };
}

function showPayslip(m) {
  const line = m.forced ? m.forced
    : m.net >= 300000 ? 'Buen mes. Si te preguntan, el mérito es mío por enseñarte. Ahorrá, que esto no dura.'
      : m.net > 0 ? 'Cobraste, pagaste y te sobró algo. Eso, en este país, es un triunfo.'
        : 'Este mes gastaste más de lo que ganaste. Bienvenido/a a la adultez. Revisá cómo vivís, en "Mi vida".';
  sfx('cash');
  api.openModal(`<div class="home career payslip">
    <h1>💵 Recibo de sueldo · Mes ${m.n}</h1>
    <div class="slip"><div class="slipHead"><b>AEROPLATA S.A.</b><span>Estación EZE · ${esc(getPlayer().name || 'Agente')}</span></div>
      <table class="grid pay">${m.weeks.map((w, i) => `<tr><td>Semana ${i + 1}</td><td class="num ${w < 0 ? 'neg' : 'pos'}">${fmtMoney(w)}</td></tr>`).join('')}
        <tr class="tot"><td>Sueldo del mes</td><td class="num ${m.income < 0 ? 'neg' : 'pos'}">${fmtMoney(m.income)}</td></tr>
        ${m.exp.map((l) => `<tr><td>${esc(l.label)}</td><td class="num neg">${fmtMoney(l.amount)}</td></tr>`).join('')}
        ${m.interest ? `<tr><td>Intereses de la tarjeta (8 % de la deuda)</td><td class="num neg">${fmtMoney(m.interest)}</td></tr>` : ''}
        <tr class="tot"><td>Resultado del mes</td><td class="num ${m.net < 0 ? 'neg' : 'pos'}">${fmtMoney(m.net)}</td></tr>
        <tr><td>Ahorros: antes ${fmtMoney(m.before)} → ahora</td><td class="num ${m.after < 0 ? 'neg' : 'pos'}">${fmtMoney(m.after)}</td></tr></table></div>
    ${viv(line)}
    <div class="row end"><button class="btn ok big" id="psGo">Seguir ▶</button></div></div>`, 'wide');
  $('#psGo').onclick = backToHub;
}

// ------------------------------------------------------------------
// Mi vida: dónde vivís, cómo viajás, qué comés, y lo que comprás con los ahorros
// ------------------------------------------------------------------
function showLife() {
  const p = load(), c = ensure(p.career);
  const L = c.life;
  const group = (key) => {
    const G2 = LIFE[key];
    return `<h3><i class="mdi mdi-${G2.icon}"></i> ${G2.label}</h3><div class="lifeOpts">${Object.entries(G2.options).map(([k, o]) => {
      const locked = o.needs && !c.owned[o.needs];
      return `<button class="lifeOpt ${L[key] === k ? 'on' : ''}" data-g="${key}" data-k="${k}" ${locked ? 'disabled' : ''}><b>${esc(o.name)}</b><span class="cost">${fmtMoney(o.cost)}/mes</span><small>${esc(locked ? `Necesitás comprar ${o.needs === 'auto' ? 'el auto' : 'la moto'} primero.` : o.desc)}</small></button>`;
    }).join('')}</div>`;
  };
  api.openModal(`<div class="home career life">
    <h1>🏠 Mi vida y compras</h1>
    <div class="rankCard"><span class="icoTile g big"><i class="mdi mdi-wallet"></i></span><div><small>Ahorros</small><b class="${c.money < 0 ? 'neg' : ''}">${fmtMoney(c.money)}</b><small>Gastos del mes con lo elegido: <b class="inl">${fmtMoney(expensesTotal(c))}</b> · a cobrar este mes: <b class="inl">${fmtMoney(c.pending)}</b></small></div></div>
    ${group('home')}<p class="hint">Mudarse cuesta ${fmtMoney(MOVE_COST)} (flete y depósito). Vivir lejos hace que llegues tarde más seguido.</p>
    ${group('transport')}${group('food')}
    <h3><i class="mdi mdi-cart"></i> Compras</h3>
    <div class="shop">${SHOP.map((it) => {
      const has = c.owned[it.k];
      return `<div class="shopIt ${has ? 'owned' : ''}"><i class="mdi mdi-${it.icon}"></i><div><b>${esc(it.name)}</b><small>${esc(it.desc)}</small></div>${has ? '<span class="cloudBadge on">Tuyo</span>' : `<button class="btn sm ${c.money >= it.price ? 'ok' : ''}" data-buy="${it.k}" ${c.money >= it.price ? '' : 'disabled'}>${fmtMoney(it.price)}</button>`}</div>`;
    }).join('')}</div>
    <div class="row end"><button class="btn ok" id="lfBack">Volver</button></div></div>`, 'wide');
  document.querySelectorAll('.lifeOpt').forEach((b) => {
    b.onclick = async () => {
      const g = b.dataset.g, k = b.dataset.k;
      if (L[g] === k) return;
      if (g === 'home') {
        const ok = await api.confirm({ title: 'Mudanza', text: `¿Te mudás a "${LIFE.home.options[k].name}"? La mudanza cuesta ${fmtMoney(MOVE_COST)}.`, ok: 'Mudarme', cancel: 'Mejor no', icon: 'truck' });
        if (!ok) return;
        c.money -= MOVE_COST;
      }
      c.life[g] = k;
      if (g === 'home' && (k === 'depto' || k === 'casa') && !c.milestones.nice_home) c.milestones.nice_home = Date.now();
      save(p);
      showLife();
    };
  });
  document.querySelectorAll('[data-buy]').forEach((b) => {
    b.onclick = async () => {
      const it = SHOP.find((x) => x.k === b.dataset.buy);
      const ok = await api.confirm({ title: 'Compra', text: `¿Comprás "${it.name}" por ${fmtMoney(it.price)}?`, ok: 'Comprar', cancel: 'No', icon: 'cart' });
      if (!ok) return;
      c.money -= it.price;
      c.owned[it.k] = true;
      if (it.k === 'auto' || it.k === 'moto') c.life.transport = it.k;
      if (it.k === 'auto' && !c.milestones.first_car) c.milestones.first_car = Date.now();
      save(p);
      showLife();
    };
  });
  $('#lfBack').onclick = showCareerHub;
}

// Después de cada día se recarga la página (escena limpia) y se vuelve al centro de la carrera
function backToHub() {
  try { sessionStorage.setItem('ckOpen', 'career'); } catch {}
  location.reload();
}

// ------------------------------------------------------------------
// Perfil: rango, plata, estadísticas, temas e hitos
// ------------------------------------------------------------------
export function showProfileStats(back) {
  const p = load(), c = p.career, st = p.stats;
  const r = rankOf(c.xp);
  const topics = topicStats(p);
  const pct = st.pax ? Math.round((st.ok / st.pax) * 100) : 0;
  const box = (label, val, cls = '') => `<div><span>${label}</span><b class="${cls}">${val}</b></div>`;
  api.openModal(`<div class="home career profileStats">
    <h1>📊 Perfil del agente</h1>
    <div class="rankCard">${faceSVG(playerFace(), { w: 64, h: 80, bg: '#dce7f0' })}<div><small>${esc(gtxt(RANKS[r].name))}</small><b>${esc(getPlayer().name || 'Agente')}</b>${xpBar(c.xp)}</div>${rankTile(r, true)}</div>
    <div class="kpis">
      ${box('Ahorros', fmtMoney(c.money), c.money < 0 ? 'err' : '')}
      ${box('Ganado en total', fmtMoney(c.earned || 0))}
      ${box('Mejor día', fmtMoney(c.bestDay || 0))}
      ${box('Días trabajados', st.days)}
      ${box('Pasajeros atendidos', st.pax)}
      ${box('Decisiones correctas', `${pct} %`)}
      ${box('Mejor racha', st.bestStreak)}
      ${box('Días perfectos', st.perfectDays)}
      ${box('INAD aceptados', st.inad, st.inad ? 'err' : '')}
    </div>
    ${topics.length ? `<h3>Por tema</h3><div class="topics">${topics.map((t) => `<div class="tp"><span>${esc(t.label)}</span><div class="bar"><i class="${t.pct >= 80 ? 'ok' : t.pct >= 60 ? 'warn' : 'bad'}" style="width:${t.pct}%"></i></div><b>${t.pct} %</b><small>${t.n}</small></div>`).join('')}</div>
      <p class="hint">Los temas con menos aciertos aparecen más seguido en tus próximos turnos, hasta que los domines.</p>` : '<p class="hint">Todavía no hay estadísticas: jugá algunos turnos.</p>'}
    <h3>Hitos · ${Object.keys(c.milestones).length} de ${MILESTONES.length}</h3>
    <div class="msGrid">${MILESTONES.map((m) => `<div class="ms ${c.milestones[m.k] ? 'on' : ''}"><i class="mdi mdi-${c.milestones[m.k] ? m.icon : 'lock'}"></i><div><b>${esc(gtxt(m.name))}</b><small>${esc(gtxt(m.desc))}</small></div></div>`).join('')}</div>
    <div class="row end"><button class="btn ok" id="psBack">Volver</button></div></div>`, 'wide');
  $('#psBack').onclick = () => (back ? back() : (api.closeModal(), api.showHome()));
}
