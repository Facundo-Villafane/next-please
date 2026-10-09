// CARRERA (modo sin fin, se habilita al terminar la historia): días de trabajo de lunes a viernes,
// jornal según el rango, bonos por aciertos y rachas, multas por errores, recibo de sueldo semanal,
// ascensos, perfil con estadísticas e hitos. Los turnos se arman al azar (ver generator.buildSmartDeck).
import { FLIGHTS } from './data.js';
import { buildSmartDeck } from './generator.js';
import { faceSVG } from './docs.js';
import { SUP } from './supervisor.js';
import { getPlayer, gtxt, playerFace } from './player.js';
import { esc, pick, chance, rnd } from './util.js';
import { load, save, weightFn, randomShift, RANKS, rankOf, settleCounter, settleGate, xpOf, fmtMoney, MILESTONES, topicStats } from './progress.js';

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
export function showCareerHub() {
  const p = load(), c = p.career;
  const r = rankOf(c.xp), R = RANKS[r];
  const weekNet = c.weekLedger.reduce((s, d) => s + d.net, 0);
  const isGate = c.day === GATE_DAY;
  api.openModal(`<div class="home career">
    <h1>💼 Carrera en Aeroplata</h1>
    <div class="rankCard">${rankTile(r, true)}<div><small>Tu rango</small><b>${esc(gtxt(R.name))}</b>${xpBar(c.xp)}</div>
      <div class="money"><small>Saldo acumulado</small><b class="${c.money < 0 ? 'neg' : ''}">${fmtMoney(c.money)}</b></div></div>
    <div class="weekRow">${DAYS.map((d, i) => {
      const done = c.weekLedger.find((x) => x.day === i + 1);
      return `<div class="wd ${i + 1 === c.day ? 'today' : ''} ${done ? 'done' : ''}"><small>${d}</small><i class="mdi mdi-${i + 1 === GATE_DAY ? 'airplane-takeoff' : 'account-tie-voice'}"></i><b>${done ? fmtMoney(done.net) : i + 1 === c.day ? 'Hoy' : '—'}</b></div>`;
    }).join('')}</div>
    <p class="hint">Semana ${c.week} · llevás ${fmtMoney(weekNet)} esta semana. El viernes se cobra.
      Hoy: <b>${DAYS[c.day - 1]}</b>, ${isGate ? 'te toca la <b>puerta de embarque</b>' : `<b>counter</b> con ${R.pax} pasajeros y ${R.flights} vuelos`}. Jornal del rango: ${fmtMoney(R.pay)}.</p>
    <div class="row end gap">
      <button class="btn ghost" id="cBack">← Volver</button>
      <button class="btn" id="cProfile"><i class="mdi mdi-chart-bar"></i> Perfil y estadísticas</button>
      <button class="btn ok big" id="cGo">Empezar el ${DAYS[c.day - 1].toLowerCase()} ▶</button>
    </div></div>`, 'wide');
  $('#cBack').onclick = () => { api.closeModal(); api.showHome(); };
  $('#cProfile').onclick = () => showProfileStats(showCareerHub);
  $('#cGo').onclick = startDay;
}

const START_LINES = [
  'Otro día, otro dólar. Bueno, otro peso. Devaluado.',
  'Llegaste puntual. Anotado. No te lo voy a decir de nuevo.',
  'Hoy viene lleno. Siempre viene lleno. Andá.',
  'Te dejo los vuelos del día en el tablero. Leelos, no los mires.',
  'Café, credencial y paciencia. Las tres cosas, ¿eh?',
  'Si hoy no hay multas, te invito un café. De la máquina. No te emociones.',
];

function startDay() {
  const p = load(), c = p.career;
  const r = rankOf(c.xp), R = RANKS[r];
  const name = getPlayer().name || 'Agente';
  api.closeModal();
  api.setStudent(name);
  if (c.day === GATE_DAY) {
    const fl = pick(FLIGHTS.filter((f) => f.country !== 'AR'));
    api.storyLine(viv(`${pick(START_LINES)} Hoy es miércoles: <b>puerta de embarque</b>, el ${fl.no} a ${fl.city}. Embarque en orden, nadie sin escanear, y cerrame el vuelo a horario.`), () => {
      api.startBoarding({ student: name, level: R.level, mode: 'challenge', flightNo: fl.no, onDone: (gate) => dayEnd({ type: 'gate', gate }) });
    });
    return;
  }
  const rs = randomShift(R.flights);
  const deck = buildSmartDeck(R.level, R.pax, weightFn());
  const flights = rs.flights;
  const label = flights ? `${flights.length} vuelos` : 'Todos los vuelos';
  api.storyLine(viv(`${pick(START_LINES)} ${DAYS[c.day - 1]}: <b>${R.pax} pasajeros</b> en tu mostrador. Cada acierto suma, cada error se descuenta del sueldo. Así que atención.`), () => {
    api.startCheckin({
      deck, flights, start: rs.start, mode: 'challenge', level: R.level, team: true, consults: true,
      events: chance(R.events) ? 'force' : false,
      outage: r >= 2 && chance(0.25) ? { afterPax: rnd(3, 6), duration: 3 } : null,
      counterLabel: `Mostrador 22 · ${label}`, signLabel: 'CARRERA · AEROPLATA',
      onEnd: (results, score, queueLog) => dayEnd({ type: 'counter', results, queueLog }),
    });
  });
}

// ------------------------------------------------------------------
// Fin del día: liquidación, experiencia, hitos y ascensos
// ------------------------------------------------------------------
function dayEnd({ type, results, gate }) {
  const p = load(), c = p.career, st = p.stats;
  const r0 = rankOf(c.xp), R = RANKS[r0];
  const hints = api.hintCount();
  const evLog = type === 'counter' ? api.eventLog() : [];
  const s = type === 'counter' ? settleCounter(results, evLog, hints, R) : settleGate(gate, hints, R);
  const xp = xpOf(s);
  c.xp += xp;
  c.money += s.net;
  c.earned = (c.earned || 0) + Math.max(0, s.net);
  c.bestDay = Math.max(c.bestDay || 0, s.net);
  c.weekLedger.push({ day: c.day, type, net: s.net, inad: s.inad });
  st.days++;
  if (s.perfectDay) st.perfectDays++;
  st.impostors = (st.impostors || 0) + s.impostors;
  if (type === 'gate') { st.pax += s.total; st.ok += s.okPax; }
  evLog.forEach((e) => { if (e.ev) st.events[e.ev] = true; });
  const r1 = rankOf(c.xp);
  // Hitos
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
  const weekEnd = c.day === 5;
  let week = null;
  if (weekEnd) {
    const total = c.weekLedger.reduce((t, d) => t + d.net, 0);
    week = { n: c.week, days: c.weekLedger.slice(), total };
    give('first_pay', true);
    give('clean_week', c.weekLedger.every((d) => !d.inad));
    give('in_debt', total < 0);
    c.history.push({ week: c.week, total });
    c.weekLedger = [];
    c.week++;
    c.day = 1;
  } else c.day++;
  save(p);

  const comment = s.net >= R.pay * 1.5 ? 'Mirá vos. Hoy hasta me caíste bien. No se lo cuentes a nadie.'
    : s.net >= R.pay ? 'Correcto. Nada para festejar, nada para llorar. Como mi sueldo.'
      : s.net > 0 ? 'Ganaste algo. Poco. Como todos acá. Mañana prestá más atención.'
        : 'Hoy le debés plata a la empresa. Bienvenido/a al club: yo le debo la juventud.';
  api.openModal(`<div class="home career dayPay">
    <h1>🧾 Liquidación del ${DAYS[(weekEnd ? 5 : c.day - 1) - 1].toLowerCase()} · ${type === 'gate' ? 'Puerta de embarque' : 'Counter'}</h1>
    ${r1 > r0 ? `<div class="promo">${rankTile(r1, true)}<div><small>¡Ascenso!</small><b>${esc(gtxt(RANKS[r1].name))}</b><p>Nuevo jornal: ${fmtMoney(RANKS[r1].pay)}. Más pasajeros, más vuelos y casos más difíciles.</p></div></div>` : ''}
    <table class="grid pay">${s.lines.map((l) => `<tr><td>${esc(l.label)}${l.n != null ? ` <small>×${l.n}</small>` : ''}</td><td class="num ${l.amount < 0 ? 'neg' : 'pos'}">${fmtMoney(l.amount)}</td></tr>`).join('')}
      <tr class="tot"><td>Neto del día</td><td class="num ${s.net < 0 ? 'neg' : 'pos'}">${fmtMoney(s.net)}</td></tr></table>
    <p class="hint">+${xp} XP · ${s.okPax} de ${s.total} bien resueltos.</p>
    ${got.length ? `<div class="newMs"><b>🏅 ${got.length === 1 ? 'Nuevo hito' : 'Nuevos hitos'}</b>${got.map((k) => { const m = MILESTONES.find((x) => x.k === k); return `<div class="ms on"><i class="mdi mdi-${m.icon}"></i><div><b>${esc(gtxt(m.name))}</b><small>${esc(gtxt(m.desc))}</small></div></div>`; }).join('')}</div>` : ''}
    ${viv(comment)}
    <div class="row end"><button class="btn ok big" id="dpGo">${week ? 'Ver el recibo de sueldo ▶' : 'Seguir ▶'}</button></div></div>`, 'wide');
  $('#dpGo').onclick = () => (week ? showPayslip(week) : backToHub());
}

function showPayslip(week) {
  const line = week.total >= 150000 ? 'Buena semana. Si te preguntan, el mérito es mío por enseñarte.'
    : week.total > 0 ? 'Cobraste. No alcanza para nada, pero cobraste. Así es esto.'
      : 'Esta semana terminaste debiéndole a la empresa. Te recomiendo no comentarlo en tu casa.';
  api.openModal(`<div class="home career payslip">
    <h1>💵 Recibo de sueldo · Semana ${week.n}</h1>
    <div class="slip"><div class="slipHead"><b>AEROPLATA S.A.</b><span>Estación EZE · ${esc(getPlayer().name || 'Agente')}</span></div>
      <table class="grid pay">${week.days.map((d) => `<tr><td>${DAYS[d.day - 1]} · ${d.type === 'gate' ? 'Puerta' : 'Counter'}</td><td class="num ${d.net < 0 ? 'neg' : 'pos'}">${fmtMoney(d.net)}</td></tr>`).join('')}
        <tr><td>Descuento: café de la máquina</td><td class="num neg">${fmtMoney(-1500)}</td></tr>
        <tr class="tot"><td>Total a cobrar</td><td class="num ${week.total - 1500 < 0 ? 'neg' : 'pos'}">${fmtMoney(week.total - 1500)}</td></tr></table></div>
    ${viv(line)}
    <div class="row end"><button class="btn ok big" id="psGo">Cobrar y seguir ▶</button></div></div>`, 'wide');
  $('#psGo').onclick = () => {
    const p = load();
    p.career.money -= 1500;
    save(p);
    backToHub();
  };
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
      ${box('Saldo acumulado', fmtMoney(c.money), c.money < 0 ? 'err' : '')}
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
