// Lógica principal del juego: turno, interfaz del DCS, diálogo y evaluación.
import { AirportScene } from './scene3d.js';
import { startBoarding } from './boarding.js';
import { initCareer, showHome } from './career.js';
import { initQueue, resetQueue, queueTick, queuePaxDone } from './queue.js';
import { initEvents, planEvents, maybeEvent, eventsOnPax, eventsSummaryHTML } from './events.js';
import { initTeam, teamStart, teamStop, teamTick, teamSyncQueue, teamOn, teamWaiting, teamSummaryHTML, teamLocal } from './team.js';
import { initOnline, showOnline } from './online.js';
import { conflictTrigger, runConflict, MARTA } from './conflict.js';
import { firearmModal, avihModal } from './restricted.js';
import { playerFace, getPlayer } from './player.js';
import { initOutage, planOutage, outageOnPax, isManual, paneList, paneApi, manualTag, manualBp, manualItems, registerManual, identUploadBox, outageEndCheck, resetOutageLook } from './outage.js';
import { FLIGHTS, SHIFT_START, REAL_SECONDS_PER_GAME_MINUTE, FARES, BAG_FEES, SEATMAP, ENTRY_RULES, COUNTRIES, EXIT_RULES_AR, STATION, AIRLINE, UM_POLICY } from './data.js';
import { buildDeck, createPassenger, SCENARIOS } from './generator.js';
import { evaluate, computeExcess, REASONS, isIdDoc, isExitRow, partyMembers } from './rules.js';
import { faceSVG, renderDoc, docTitle } from './docs.js';
import { AGENT_EN } from './dialogues.js';
import { OVBK_POLICY, protectionsFor, volunteerScript, volunteerScriptEn, compForm, gradeComp } from './overbooking.js';
import { esc, fmtTime, fmtGds, fmtDate, timeToday, dayOnly, norm, rndf, rnd, pick, randomDigits, shuffle, chance } from './util.js';

const $ = (s) => document.querySelector(s);
// Desafío: reloj en tiempo real más exigente. Aprendizaje: cada atención consume LEARN_MINUTES_PER_PAX.
const CHALLENGE_SECONDS_PER_GAME_MINUTE = Math.round(REAL_SECONDS_PER_GAME_MINUTE * 0.6);
const LEARN_MINUTES_PER_PAX = 4;
const scene = new AirportScene($('#view3d'));

const G = {
  student: '', level: 'intermedio', running: false, paused: false,
  now: null, flights: [], pax: [], idx: -1, cur: null, act: null,
  results: [], score: 0, tab: 'ident', seatMaps: {}, checkedCount: {},
  lastBoardMinute: -1,
};

// ------------------------------------------------------------------
// Reloj
// ------------------------------------------------------------------
let lastReal = performance.now();
setInterval(() => {
  const t = performance.now();
  const dt = (t - lastReal) / 1000;
  lastReal = t;
  if (!G.running || !G.now) return;
  // Aprendizaje: el reloj no corre mientras se atiende (avanza al terminar cada pasajero)
  if (G.mode === 'challenge' && !G.paused && !modalOpen()) G.now = new Date(G.now.getTime() + (dt * 60000) / CHALLENGE_SECONDS_PER_GAME_MINUTE);
  queueTick(dt);
  if (!G.paused) teamTick(dt);
  updateTop();
  const m = Math.floor(G.now.getTime() / 60000);
  if (m !== G.lastBoardMinute) { G.lastBoardMinute = m; scene.updateBoard(boardFlights(), G.now); if (G.tab === 'ident') renderPane(); }
}, 250);

const boardFlights = () => [...G.flights, ...(G.cancelled || [])].sort((a, b) => a.depTime - b.depTime);

function updateTop() {
  $('#tClock').textContent = G.now ? fmtTime(G.now) : '--:--';
  $('#tPax').textContent = `${Math.max(0, G.idx + 1)}/${G.pax.length}`;
  $('#tQueue').textContent = Math.max(0, G.pax.length - G.idx - 1) + teamWaiting();
  $('#tScore').textContent = G.score;
  $('#tAgent').textContent = G.student || '—';
  if (G.student && !$('#tAvatar').innerHTML) $('#tAvatar').innerHTML = faceSVG(playerFace(), { w: 30, h: 37, bg: '#dce7f0' });
}

// ------------------------------------------------------------------
// Modal
// ------------------------------------------------------------------
const modalOpen = () => !$('#modal').classList.contains('hidden');
function openModal(html, cls = '') {
  $('#modalBox').className = `modalBox ${cls}`;
  $('#modalBox').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal' && $('#modalBox').classList.contains('dismissable')) closeModal();
});

// ------------------------------------------------------------------
// Inicio
// ------------------------------------------------------------------
function showPractice() {
  G.running = false;
  openModal(`
    <div class="start">
      <div class="startHero">
        <div class="logo">✈</div>
        <h1>Next, please! · Práctica libre</h1>
        <p>Aeropuerto Internacional de Ezeiza · Mostrador ${AIRLINE.name}</p>
      </div>
      <p class="lead">Sos agente de check-in. Atendé a cada pasajero: verificá su documentación y requisitos de ingreso,
      identificá la reserva en el sistema, cargá APIS, despachá el equipaje, asigná asiento y decidí si
      <b>acepta</b>, <b>no acepta</b> o <b>derivás</b>. Cada decisión se evalúa con una explicación.</p>
      <label>Nombre del alumno/a<input id="stName" maxlength="40" placeholder="Ej.: Lucía Pérez" value="${esc(localStorage.getItem('ckName') || '')}"></label>
      <label>Puesto de trabajo
        <select id="stMode">
          <option value="checkin">Counter de check-in</option>
          <option value="gate">Puerta de embarque (vuelo ${FLIGHTS.find((f) => f.no === 'AP1100').no} a Miami)</option>
        </select>
      </label>
      <label>Modo de juego
        <select id="stPace">
          <option value="learn">📘 Aprendizaje · el reloj se detiene mientras atendés, sin presión de tiempo</option>
          <option value="challenge">⏱ Desafío · reloj en tiempo real, cuenta la velocidad</option>
        </select>
      </label>
      <label>Nivel
        <select id="stLevel">
          <option value="basico">Básico · 10 pasajeros</option>
          <option value="intermedio" selected>Intermedio · 15 pasajeros</option>
          <option value="avanzado">Avanzado · 19 pasajeros</option>
        </select>
      </label>
      <label>Compañeros (counter)
        <select id="stTeam">
          <option value="on">👥 En equipo · compañeros en los mostradores 21 y 23, con fila única</option>
          <option value="off">🧍 Solo/a · sólo tu mostrador</option>
        </select>
      </label>
      <label>Imprevistos
        <select id="stEvents">
          <option value="on">⚠ Sí · valija desatendida, vuelo cancelado... (pueden pasar en cualquier momento)</option>
          <option value="off">Sin imprevistos</option>
        </select>
      </label>
      <div class="row gap">
        <button class="btn ok big" id="stGo">Comenzar turno</button>
        <button class="btn ghost" id="stManual">📘 Leer manual primero</button>
        <button class="btn ghost" id="stBack">← Volver</button>
      </div>
      <p class="disclaimer">Las reglas documentarias están simplificadas con fines didácticos. En la operación real siempre se consulta Timatic y los procedimientos vigentes de la compañía.</p>
    </div>`, 'wide');
  try { if (localStorage.getItem('ckTeam') === 'off') $('#stTeam').value = 'off'; } catch {}
  try { if (localStorage.getItem('ckEvents') === 'off') $('#stEvents').value = 'off'; } catch {}
  $('#stGo').onclick = () => {
    G.student = $('#stName').value.trim() || 'Agente';
    try { localStorage.setItem('ckName', G.student); } catch {}
    G.level = $('#stLevel').value;
    G.mode = $('#stPace').value;
    G.teamPref = $('#stTeam').value === 'on';
    G.eventsPref = $('#stEvents').value === 'on';
    try { localStorage.setItem('ckEvents', $('#stEvents').value); } catch {}
    try { localStorage.setItem('ckTeam', $('#stTeam').value); } catch {}
    closeModal();
    if ($('#stMode').value === 'gate') {
      startBoarding({ student: G.student, level: G.level, mode: G.mode, oldScene: scene, ui: { openModal, closeModal, modalOpen } });
      G.sceneDisposed = true;
      return;
    }
    startShift({});
  };
  $('#stManual').onclick = () => showManual(showPractice);
  $('#stBack').onclick = () => { closeModal(); showHome(); };
}

function startShift(opts = {}) {
  G.onEnd = opts.onEnd || null;
  G.career = opts.career || null;
  $('.brand span').textContent = `Check-in · EZE · ${G.mode === 'challenge' ? '⏱ Desafío' : '📘 Aprendizaje'}`;
  const today = dayOnly(new Date());
  G.now = timeToday(today, opts.start || SHIFT_START);
  G.flights = FLIGHTS.filter((f) => !opts.flights || opts.flights.includes(f.no)).map((f) => {
    const depTime = timeToday(today, f.dep);
    return { ...f, depTime, openTime: new Date(depTime.getTime() - f.open * 60000), closeTime: new Date(depTime.getTime() - f.close * 60000) };
  });
  G.seatMaps = {};
  G.checkedCount = {};
  G.flights.forEach((f) => { G.seatMaps[f.no] = makeOccupancy(); G.checkedCount[f.no] = rnd(40, 110); });
  // Pasajeros generados según la hora estimada de llegada al mostrador
  const deck = opts.deck || buildDeck(G.level);
  G.deck = deck;
  // Caída del sistema: configurada por el día (Modo Historia) o al azar en práctica libre
  const outCfg = opts.outage !== undefined ? opts.outage
    : !opts.deck && (G.level === 'avanzado' || (G.level === 'intermedio' && chance(0.4))) ? { afterPax: rnd(2, 4), duration: 3 } : null;
  planOutage({ outage: opts.ovbk ? null : outCfg });
  resetOutageLook();
  G.pax = deck.map((entry, i) => createPassenger(entry, new Date(G.now.getTime() + i * 9 * 60000), G.flights));
  G.idx = -1; G.results = []; G.score = 0; G.running = true; G.paused = false;
  G.cancelled = [];
  resetQueue();
  if (opts.blocked) opts.blocked.forEach((seat) => G.flights.forEach((fl) => G.seatMaps[fl.no].add(seat)));
  G.ovbk = null;
  if (opts.ovbk) {
    const f = G.flights.find((x) => x.no === opts.ovbk.flight);
    const ours = (opts.deck || []).length;
    const others = opts.ovbk.capacity - (ours - opts.ovbk.short);
    G.checkedCount[f.no] = others;
    G.ovbk = { flightNo: f.no, capacity: opts.ovbk.capacity, booked: others + ours, short: opts.ovbk.short, offeredCount: 0, volunteers: [], dnbd: [], flexSeen: 0 };
  }
  $('#tabOvbk').classList.toggle('hidden', !G.ovbk);
  scene.setCounterLabel(opts.counterLabel || 'Mostrador 22 · Todos los vuelos', opts.signLabel);
  // Trabajo en equipo: fila única con los compañeros de los mostradores vecinos (bots o en línea)
  teamStart({ on: opts.team !== undefined ? opts.team : G.teamPref !== false, consults: opts.consults !== false, online: opts.online || null });
  if (teamOn()) { scene.setQueue([]); teamSyncQueue(); } else scene.setQueue(G.pax);
  // Imprevistos (sólo Práctica libre): valija desatendida, vuelo cancelado...
  planEvents({ on: !opts.deck && !opts.online && opts.events !== false && G.eventsPref !== false });
  scene.updateBoard(boardFlights(), G.now);
  updateTop();
  nextPassenger();
}

function makeOccupancy() {
  const occ = new Set();
  // La última fila queda libre (se reserva para pasajeros con custodia)
  for (let r = 1; r < SEATMAP.economyRows[1]; r++) {
    const cols = r <= SEATMAP.businessRows.at(-1) ? SEATMAP.businessCols : SEATMAP.economyCols;
    cols.forEach((c) => { if (Math.random() < (r <= 3 ? 0.4 : 0.55)) occ.add(`${r}${c}`); });
  }
  return occ;
}

// ------------------------------------------------------------------
// Pasajero
// ------------------------------------------------------------------
function nextPassenger() {
  if (maybeEvent(nextPassenger)) return;
  G.idx++;
  if (G.idx >= G.pax.length) return endShift();
  // El pasajero se genera al llegar al mostrador, con la hora real del turno
  const p = G.deck[G.idx].pre || createPassenger(G.deck[G.idx], G.now, G.flights);
  G.pax[G.idx] = p;
  if (inOvbk(p)) {
    // Asegura que aparezcan al menos dos posibles voluntarios en el turno
    const left = G.pax.length - G.idx;
    if (!p.flexible && ['ok', 'dni_ok', 'visa_oldpp'].includes(p.scenario) && G.ovbk.flexSeen < 2 && left <= 4) p.flexible = true;
    if (p.flexible) G.ovbk.flexSeen++;
  }
  scene.replaceFront(p);
  teamLocal('call', { name: `${p.first} ${p.last}`, sex: p.sex });
  G.cur = p;
  G.act = {
    docsRequested: false, bookingLoaded: false, apis: null, apisDraft: null, bags: [], bagsShown: false,
    pet: null, retained: false, dryIceFixed: false, docViewed: false, offered: false, volunteerYes: false, apisBy: {}, seats: {}, stroller: null,
    arrival: new Date(G.now), charged: 0, dgRemoved: false, dgRevealed: false, asked: {}, seat: null, start: performance.now(), searchResults: null,
  };
  outageOnPax(() => { renderTabs(); renderPane(); });
  G.act.manual = isManual();
  G.tab = 'ident';
  $('#docs').innerHTML = '<div class="empty">Solicite la documentación al pasajero.</div>';
  $('#dialog').classList.add('hidden');
  sys('PASAJERO SE ACERCA AL MOSTRADOR...');
  renderTabs(); renderPane(); updateTop();
  lockDecision(true);
  scene.callNext().then(() => {
    if (G.cur !== p) return;
    $('#dialog').classList.remove('hidden');
    $('#portrait').innerHTML = faceSVG(p.face, { w: 92, h: 115, bg: '#cfdbe6' }) + (p.party ? `<div class="partyFaces">${p.party.members.map((m) => faceSVG(m.face, { w: 30, h: 38, bg: '#e8eef4' })).join('')}</div>` : '');
    $('#portrait').classList.toggle('wobble', !!p.drunk);
    scene.setSway(!!p.drunk);
    say(null, p.lines.greet);
    renderChips();
    lockDecision(false);
    G.act.start = performance.now();
  });
  if (teamOn()) teamSyncQueue(); else scene.syncQueue(G.pax.slice(G.idx + 1));
}

function lockDecision(lock) {
  ['#btnAccept', '#btnReject', '#btnDerive'].forEach((s) => { $(s).disabled = lock; });
}

const QUESTIONS = [
  { k: 'docs', label: '📄 Documentación y reserva', q: 'Buenas tardes. ¿Me permite su documento de viaje y la reserva, por favor?' },
  { k: 'reason', label: '🎯 Motivo del viaje', q: '¿Cuál es el motivo de su viaje?' },
  { k: 'ret', label: '📅 Regreso', q: '¿Cuándo regresa?' },
  { k: 'visa', label: '🛂 Visa / autorización', q: '¿Cuenta con visa o autorización de ingreso para su destino?' },
  { k: 'minor', label: '👥 ¿Viaja solo/a?', q: '¿Viaja solo/a o acompañado/a?' },
  { k: 'health', label: '🩺 Salud / embarazo', q: '¿Tiene alguna condición médica que debamos saber, o se encuentra embarazada?' },
  { k: 'bags', label: '🧳 Equipaje a despachar', q: '¿Va a despachar equipaje? Colóquelo en la balanza, por favor.' },
  { k: 'security', label: '⚠ Cartilla MMPP', q: '(Señalando la cartilla de mercancías peligrosas) ¿Empacó usted mismo su equipaje y lo tuvo siempre bajo su control? ¿Alguien le dio algo para llevar? ¿Lleva en su equipaje facturado aerosoles, gas butano, encendedores, pilas o baterías de litio, power banks, cigarrillos electrónicos, líquidos inflamables o corrosivos?' },
  { k: 'valuables', label: '💎 Artículos de valor', q: 'Sr./Sra., ¿lleva algún artículo de valor dentro de su equipaje? Si es así, le pedimos que lo lleve como equipaje de mano: la compañía no se hace responsable por la pérdida de elementos en bodega.' },
  { k: 'seat', label: '💺 Asiento', q: '¿Tiene alguna preferencia de asiento? Tengo disponibles asientos en salida de emergencia.' },
];

const inOvbk = (p) => G.ovbk && p && p.flight.no === G.ovbk.flightNo;
const seatsLeft = () => (G.ovbk ? G.ovbk.capacity - G.checkedCount[G.ovbk.flightNo] : Infinity);
// Asientos que faltan si todos los pasajeros que quedan en la fila (incluido el actual) viajaran
const projectedShort = () => (G.ovbk ? Math.max(0, (G.pax.length - G.idx) - seatsLeft()) : 0);
function questionList() {
  return inOvbk(G.cur) ? [...QUESTIONS, { k: 'volunteer', label: '🙋 ¿Voluntario?', q: '' }] : QUESTIONS;
}

function renderChips() {
  $('#chips').innerHTML = questionList().map((q) => `<button class="chip ${G.act.asked[q.k] ? 'done' : ''}" data-q="${q.k}">${q.label}</button>`).join('');
  $('#chips').querySelectorAll('.chip').forEach((b) => { b.onclick = () => ask(b.dataset.q); });
}

function say(agent, text) {
  $('#agentLine').textContent = agent ? `Vos: ${agent}` : '';
  const b = $('#bubble');
  b.textContent = '';
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  let i = 0;
  clearInterval(say.timer);
  say.timer = setInterval(() => { b.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(say.timer); }, 14);
}

// Frase del agente en el idioma del pasajero (inglés si es angloparlante)
function A(es, en) { return G.cur?.lang === 'en' ? en : es; }

function ask(k) {
  const p = G.cur, a = G.act;
  a.asked[k] = true;
  if (k === 'docs') teamLocal('status', { text: `🛂 Revisa el documento de ${p.first}` });
  if (k === 'volunteer') {
    a.offered = true;
    a.volunteerYes = !!p.flexible;
    G.ovbk.offeredCount++;
    say(A(volunteerScript(p.flight), volunteerScriptEn(p.flight)), p.flexible ? p.lines.volYes : p.lines.volNo);
    renderChips();
    if (G.tab === 'ovbk') renderPane();
    return;
  }
  const q = QUESTIONS.find((x) => x.k === k);
  say(p.lang === 'en' ? AGENT_EN[k] : q.q, p.lines[k]);
  if (k === 'docs' && !a.docsRequested) { a.docsRequested = true; renderDesk(); }
  if (k === 'security' && p.dgItem) a.dgRevealed = true;
  if (k === 'valuables' && p.valuables) a.valuablesRevealed = true;
  if (k === 'bags' && !a.bagsShown) {
    a.bagsShown = true;
    a.bags = p.bags.map((b) => ({ weight: b.weight, cond: b.cond, state: 'floor', tagged: false, repacked: false, tag: null, inspected: false, lr: false }));
    scene.showBags(a.bags.length);
    if (a.bags.length) setTimeout(() => placeNextBag(), 500);
  }
  renderChips();
  if (G.tab === 'bags') renderPane();
  // Pasajero difícil: el conflicto arranca cuando surge el tema
  if (!a.conflictStarted && conflictTrigger(p.scenario, k)) {
    a.conflictStarted = true;
    p.conflictHappened = true;
    $('#portrait').classList.add('angry');
    setTimeout(() => runConflict(p, p.scenario, { openModal, closeModal }, (res) => {
      a.conflict = res;
      $('#portrait').classList.remove('angry');
      if (p.scenario !== 'vip_angry') sys('INCIDENTE REGISTRADO · PASAJERO INSUBORDINADO', 'err');
    }), 1600);
  }
}

// ------------------------------------------------------------------
// Documentos
// ------------------------------------------------------------------
// Cara real de la persona dueña del documento (en familias, cada integrante)
function ownerFace(d) {
  const m = G.cur.party?.members.find((x) => x.key === d.owner);
  return m ? m.face : G.cur.face;
}

function renderDesk() {
  const docs = G.cur.docs;
  $('#docs').innerHTML = docs.map((d) => `<div class="docThumb" data-id="${d.id}"><div class="dtitle">${esc(docTitle(d))}${d.ownerName ? ` · ${esc(d.ownerName)}` : ''}</div><div class="mini">${renderDoc(d)}</div></div>`).join('');
  $('#docs').querySelectorAll('.docThumb').forEach((el) => {
    el.onclick = () => {
      const d = docs.find((x) => x.id === el.dataset.id);
      G.act.docViewed = true;
      openModal(`<div class="docView">${renderDoc(d)}</div>
        ${isIdDoc(d) ? `<div class="compare"><div><small>${d.ownerName ? esc(d.ownerName) : 'Pasajero frente a usted'}</small>${faceSVG(ownerFace(d), { w: 120, h: 150, bg: '#cfdbe6' })}</div><div><small>Foto del documento</small>${faceSVG(d.face, { w: 120, h: 150 })}</div></div>` : ''}
        <div class="row end"><button class="btn" id="mClose">Cerrar</button></div>`, 'dismissable doc');
      $('#mClose').onclick = closeModal;
    };
  });
}

// ------------------------------------------------------------------
// DCS
// ------------------------------------------------------------------
function sys(msg, kind = '') {
  const el = $('#sysmsg');
  el.className = `sysmsg ${kind}`;
  el.textContent = `> ${msg}`;
}

function renderTabs() {
  $('#tabs').querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.tab === G.tab); });
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  G.tab = b.dataset.tab;
  const TAB_STATUS = { ident: '🔎 Busca la reserva', pax: '⌨️ Carga APIS', bags: '⚖️ Despacha el equipaje', seat: '💺 Asigna el asiento', timatic: '📖 Consulta Timatic', ovbk: '🙋 Sobreventa' };
  if (G.cur && TAB_STATUS[G.tab]) teamLocal('status', { text: TAB_STATUS[G.tab] });
  renderTabs(); renderPane();
});

function renderPane() {
  const pane = $('#pane');
  if (!G.cur) { pane.innerHTML = ''; return; }
  const manual = G.act?.manual;
  ({ ident: manual ? paneList : paneIdent, pax: manual ? paneApi : panePax, bags: paneBags, seat: paneSeat, timatic: paneTimatic, ovbk: paneOvbk })[G.tab](pane);
}

// --- 1. Identificar -------------------------------------------------
function paneIdent(pane) {
  const rows = boardFlights().map((f) => {
    const st = f.cancelled ? '<span class="tag red">CANCELADO</span>' : f.delayed && G.now < f.closeTime ? `<span class="tag amber">DEMORADO · ETD ${f.delayed}</span>` : G.now < f.openTime ? '<span class="tag">NO ABIERTO</span>' : G.now >= f.closeTime ? '<span class="tag red">CERRADO</span>' : (f.closeTime - G.now) / 60000 <= 20 ? '<span class="tag amber">ÚLT. LLAMADO</span>' : '<span class="tag green">ABIERTO</span>';
    return `<tr><td>${f.no}</td><td>${STATION.code}-${f.dest}</td><td>${f.dep}</td><td>${fmtTime(f.openTime)}</td><td>${fmtTime(f.closeTime)}</td><td>${f.gate}</td><td>${G.checkedCount[f.no]}</td><td>${st}</td></tr>`;
  }).join('');
  const res = G.act.searchResults;
  pane.innerHTML = `
    <h3>Vuelos del día · ${fmtGds(G.now)}</h3>
    <table class="grid"><tr><th>Vuelo</th><th>Ruta</th><th>STD</th><th>Apert.</th><th>Cierre</th><th>Pta</th><th>CKIN</th><th>Estado</th></tr>${rows}</table>
    <h3>Buscar reserva</h3>
    <div class="row gap"><input id="q" class="mono" placeholder="PNR (6 caracteres) o APELLIDO" autocomplete="off"><button class="btn" id="qGo">Buscar</button></div>
    <div id="qRes">${res ? renderResults(res) : '<p class="hint">Busque por código de reserva (más preciso) o por apellido.</p>'}</div>`;
  const go = () => search($('#q').value);
  $('#qGo').onclick = go;
  $('#q').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  pane.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => pickResult(+b.dataset.pick); });
  identUploadBox(pane);
}

function search(raw) {
  const q = norm(raw);
  const code = raw.replace(/\s/g, '').toUpperCase();
  if (!code) return;
  const b = G.cur.booking;
  let results = [];
  if (code === b.pnr) results = [{ real: true, b }];
  else if (/\d/.test(code)) results = [];
  else if (q.length >= 3) {
    const sur = norm(b.last);
    if (sur.startsWith(q.slice(0, 4)) || sur.includes(q)) results.push({ real: true, b });
    // Otros pasajeros con apellido similar (señuelos)
    const decoyCount = results.length ? rnd(1, 2) : rnd(0, 1);
    for (let i = 0; i < decoyCount; i++) {
      const sex = pick(['M', 'F']);
      results.push({ real: false, b: { pnr: Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[0O1I]/g, 'X'), last: raw.trim() || b.last, first: pick(sex === 'M' ? ['Jorge', 'Raúl', 'Pablo', 'Andrés'] : ['Claudia', 'Mónica', 'Laura', 'Patricia']), flight: pick(G.flights), title: sex === 'M' ? 'MR' : 'MS' } });
    }
    results.sort(() => Math.random() - 0.5);
  }
  G.act.searchResults = results;
  sys(results.length ? `${results.length} RESULTADO(S)` : 'NO SE ENCONTRARON RESERVAS', results.length ? '' : 'err');
  renderPane();
}
function renderResults(res) {
  if (!res.length) return '<p class="hint err">Sin resultados. Verifique el código de reserva en el comprobante del pasajero.</p>';
  return `<table class="grid sel"><tr><th>PNR</th><th>Pasajero</th><th>Vuelo</th><th></th></tr>${res.map((r, i) => `<tr><td class="mono">${esc(r.b.pnr)}</td><td>${esc(norm(r.b.last))}/${esc(norm(r.b.first))} ${r.b.title}</td><td>${r.b.flight.no} ${STATION.code}-${r.b.flight.dest}</td><td><button class="btn sm" data-pick="${i}">Abrir</button></td></tr>`).join('')}</table>`;
}
function pickResult(i) {
  const r = G.act.searchResults[i];
  if (!r.real) {
    sys(`PNR ${r.b.pnr}: el pasajero no corresponde a esta reserva. Verifique nombre y vuelo.`, 'err');
    return;
  }
  G.act.bookingLoaded = true;
  sys(`PNR ${r.b.pnr} RECUPERADO`, 'ok');
  G.tab = 'pax'; renderTabs(); renderPane();
}

// --- 2. Pasajero / APIS --------------------------------------------
function needBooking(pane) {
  if (G.act.bookingLoaded) return false;
  pane.innerHTML = '<div class="blank">SIN PNR CARGADO<br><small>Identifique la reserva en la pestaña 1.</small></div>';
  return true;
}
function panePax(pane) {
  if (needBooking(pane)) return;
  const p = G.cur, b = p.booking, f = b.flight, fare = FARES[b.fare];
  const a = G.act;
  const idDocs = a.docsRequested ? p.docs.filter(isIdDoc) : [];
  const draft = a.apisDraft;
  pane.innerHTML = `
    <pre class="pnr">PNR: <b>${b.pnr}</b>                    ${b.ticket ? `TKT: ${b.ticket.slice(0, 3)}-${b.ticket.slice(3)}  ET/OPEN` : '<span class="err">TKT: ---  *** NO TICKET ***</span>'}
 1.1 ${esc(norm(b.last))}/${esc(norm(b.first))} ${b.title}${(b.party || []).map((x, i) => `\n ${x.title === 'INF' ? 'INF' : `${i + 2}.1`} ${esc(norm(x.last))}/${esc(norm(x.first))} ${x.title}`).join('')}
 SEG ${f.no} ${b.cabin} ${fmtGds(b.date)} ${b.origin}${f.dest} HK1 ${f.dep.replace(':', '')}
 FARE ${fare.label.toUpperCase()}   BAG ${fare.pieces}PC${fare.pieces ? ` ${fare.kg}K` : ''}${p.party ? ' (POR PASAJERO)' : ''}
 ${b.returnDate ? `RTN  ${AIRLINE.code}${+f.no.slice(2) + 1} ${fmtGds(b.returnDate)} ${f.dest}${STATION.code}` : 'RTN  ---'}
 SSR  ${b.ssr.length ? b.ssr.join(' ') : '---'}${b.created ? `\n CREADA ${fmtGds(b.created)} ${fmtTime(b.created)}` : ''}${p.legal && p.legal.type !== 'DEPU' ? `\n OSI  ${p.legal.type === 'DEPA' ? 'DETENIDO/EXTRADITADO CON CUSTODIA' : 'DEPORTADO CON ESCOLTA'}` : ''}${p.legal?.otherDepa ? `\n <span class="err">VUELO: 1 DEPA YA ACEPTADO (${p.legal.otherDepa})</span>` : ''}
 STATUS: ${a.apis ? 'APIS OK' : 'NOT CHECKED-IN'}</pre>
    <h3>APIS · Datos del documento de viaje</h3>
    ${p.party ? `<div class="apisGroup">${partyMembers(p).map((m) => `<span class="tag ${a.apisBy[m.key] ? 'green' : ''}">${esc(m.first)}${m.isInfant ? ' (INF)' : ''}: ${a.apisBy[m.key] ? 'OK' : 'pendiente'}</span>`).join(' ')}</div><p class="hint">Escaneá el documento de cada integrante, incluidos los infantes.</p>` : ''}
    ${!a.docsRequested ? '<p class="hint">Solicite la documentación para escanearla.</p>' : `
    <div class="row gap"><select id="apDoc">${idDocs.map((d) => `<option value="${d.id}" ${draft?.docId === d.id ? 'selected' : ''}>${d.ownerName ? `${esc(d.ownerName)} · ` : ''}${esc(docTitle(d))} · ${esc(d.number)}</option>`).join('')}</select>
    <button class="btn" id="apScan">⎙ Leer MRZ</button></div>
    <div class="apis">
      ${apisField('Tipo', draft?.type)}${apisField('Número', draft?.number)}${apisField('País emisor', draft?.country)}
      ${apisField('Apellido', draft?.last)}${apisField('Nombre', draft?.first)}${apisField('Nacionalidad', draft?.nat)}
      ${apisField('Nacimiento', draft?.dob)}${apisField('Sexo', draft?.sex)}${apisField('Vencimiento', draft?.exp)}
    </div>
    <div class="row gap"><button class="btn ok" id="apSend" ${draft ? '' : 'disabled'}>Enviar APIS</button>
    ${a.apis ? `<span class="apisResp ${a.apis.okBoard ? 'ok' : 'err'}">${esc(a.apis.response)}</span>` : ''}</div>`}`;
  if (!a.docsRequested) return;
  $('#apScan').onclick = () => {
    const d = p.docs.find((x) => x.id === $('#apDoc').value);
    a.apisDraft = {
      docId: d.id, owner: d.owner || 'lead', title: docTitle(d), type: d.type === 'PASSPORT' ? 'P' : 'I', number: d.dni || d.number, country: COUNTRIES[d.country || 'AR'].iso3,
      last: norm(d.last), first: norm(d.first), nat: COUNTRIES[d.nationality].iso3, dob: fmtGds(d.dob), sex: d.sex, exp: fmtGds(d.expiry), expiry: d.expiry,
    };
    sys('MRZ LEÍDA CORRECTAMENTE', 'ok');
    renderPane();
  };
  $('#apSend').onclick = () => {
    const d = a.apisDraft;
    if (!d) return;
    let response = f.country === STATION.country ? 'DATOS DEL DOCUMENTO REGISTRADOS (CABOTAJE)' : 'APIS OK · DATOS TRANSMITIDOS', okBoard = true;
    if (d.expiry < dayOnly(G.now)) { response = '⚠ DOC EXPIRED · DOCUMENTO VENCIDO'; okBoard = false; }
    else if (f.country === 'US') {
      if (ENTRY_RULES.US.esta.includes(p.nationality) && !p.hasEsta) { response = 'iAPI: DO NOT BOARD · ESTA NOT FOUND'; okBoard = false; }
      else response = 'iAPI: OK TO BOARD (0Z)';
    }
    const rec = { docId: d.docId, docTitle: d.title, response, okBoard };
    a.apisBy[d.owner] = rec;
    if (d.owner === 'lead') a.apis = rec;
    a.apisDraft = null;
    sys(`APIS ENVIADO · ${response}`, okBoard ? 'ok' : 'err');
    renderPane();
  };
}
const apisField = (l, v) => `<div class="af"><span>${l}</span><b>${v ? esc(v) : '—'}</b></div>`;

// --- 3. Equipaje ---------------------------------------------------
function placeNextBag() {
  const a = G.act;
  const i = a.bags.findIndex((b) => b.state === 'floor');
  if (i < 0 || a.bags.some((b) => b.state === 'scale')) return;
  a.bags[i].state = 'scale';
  scene.placeBagOnScale(i, a.bags[i].weight);
  if (G.tab === 'bags') renderPane();
}

function paneBags(pane) {
  if (needBooking(pane)) return;
  const p = G.cur, a = G.act, fare = FARES[p.booking.fare];
  const tagged = a.bags.filter((b) => b.tagged);
  const est = computeExcess(p, tagged.map((b) => b.weight));
  const rows = a.bags.map((b, i) => {
    const w = b.state === 'floor' ? '—' : `${b.weight.toFixed(1)} kg`;
    const cls = b.weight > BAG_FEES.maxKg ? 'err' : b.weight > fare.kg ? 'warn' : '';
    let actions = '';
    if (b.state === 'scale') {
      actions = `${b.inspected ? '' : `<button class="btn sm" data-insp="${i}">🔍 Inspección 360°</button>`}
        ${b.lr ? '<span class="tag green">LR firmado</span>' : `<button class="btn sm" data-lr="${i}">✍ Limited release</button>`}
        ${b.weight > BAG_FEES.maxKg ? `<button class="btn sm warn" data-repack="${i}">Reacondicionar</button>` : ''}
        <button class="btn sm ok" data-tag="${i}">🏷 Etiquetar</button>`;
    }
    if (b.tagged) actions = `<span class="mono small">${b.tag}</span>${b.lr ? ' <span class="tag green">LR</span>' : ''}`;
    const cond = b.inspected ? `<br><small class="${b.cond.kind === 'ok' ? '' : 'warn'}">${esc(b.cond.desc)}</small>` : '';
    return `<tr><td>Valija ${i + 1}${cond}</td><td class="${b.state !== 'floor' ? cls : ''}">${w}${b.repacked ? ' (reacond.)' : ''}</td><td>${{ floor: 'En el piso', scale: 'En balanza', sent: 'Despachada' }[b.state]}</td><td class="acts">${actions}</td></tr>`;
  }).join('');
  pane.innerHTML = `
    <div class="kv"><span>Tarifa</span><b>${fare.label} (${p.booking.cabin})</b><span>Franquicia</span><b>${fare.pieces ? `${fare.pieces} pieza(s) × ${fare.kg} kg` : 'SIN EQUIPAJE DESPACHADO'}</b><span>Límite por pieza</span><b>${BAG_FEES.maxKg} kg (absoluto)</b></div>
    <p class="hint">Tarifas de exceso: ${fare.kg < BAG_FEES.maxKg ? `sobrepeso ${fare.kg + 0.1}–${BAG_FEES.maxKg} kg USD ${BAG_FEES.overweight} · ` : ''}pieza adicional USD ${BAG_FEES.extraPiece}. Más de ${BAG_FEES.maxKg} kg: no se acepta, debe reacondicionarse.</p>
    ${!a.bagsShown ? '<div class="blank small">El pasajero aún no presentó equipaje.<br><small>Pregúntele si despacha valijas.</small></div>'
      : a.bags.length ? `<table class="grid"><tr><th>Pieza</th><th>Peso</th><th>Estado</th><th></th></tr>${rows}</table>` : '<p class="hint">Sin equipaje para despachar.</p>'}
    <div class="row gap wrap">
      <button class="btn" id="bNext" ${a.bags.some((b) => b.state === 'floor') && !a.bags.some((b) => b.state === 'scale') ? '' : 'disabled'}>Pesar siguiente valija</button>
      <button class="btn warn" id="bCharge" ${tagged.length ? '' : 'disabled'}>💲 Cobrar exceso (EMD)</button>
      ${a.dgRevealed && !a.dgRemoved ? '<button class="btn bad" id="bDG">⚠ Retirar mercancía peligrosa de la valija</button>' : ''}
      ${a.valuablesRevealed && !a.valuablesMoved ? '<button class="btn" id="bVal">💎 Recomendar llevar el artículo de valor en cabina</button>' : ''}
    </div>
    ${a.valuablesMoved ? '<p class="okline">Artículo de valor trasladado al equipaje de mano.</p>' : ''}
    ${specialItems(p, a)}
    ${a.charged ? `<p class="okline">EMD emitido: USD ${a.charged}</p>` : ''}
    ${a.dgRemoved ? '<p class="okline">Artículo con baterías de litio retirado y trasladado al equipaje de mano.</p>' : ''}
    ${tagged.length ? `<p class="hint">Cálculo del sistema sobre piezas etiquetadas: <b>USD ${est.amount}</b>${est.lines.length ? ' — ' + est.lines.map(esc).join(' · ') : ''}</p>` : ''}`;
  pane.querySelectorAll('[data-tag]').forEach((b) => { b.onclick = () => tagBag(+b.dataset.tag); });
  pane.querySelectorAll('[data-repack]').forEach((b) => { b.onclick = () => repackBag(+b.dataset.repack); });
  $('#bNext').onclick = placeNextBag;
  $('#bCharge').onclick = chargeExcess;
  pane.querySelectorAll('[data-insp]').forEach((b) => {
    b.onclick = () => {
      const bag = a.bags[+b.dataset.insp];
      bag.inspected = true;
      sys(`INSPECCIÓN 360°: ${bag.cond.desc.toUpperCase()}`, bag.cond.kind === 'ok' ? 'ok' : 'warn');
      renderPane();
    };
  });
  pane.querySelectorAll('[data-lr]').forEach((b) => {
    b.onclick = () => {
      a.bags[+b.dataset.lr].lr = true;
      say(A('Le pido por favor que firme el limited release en el reverso de la etiqueta: libera a la compañía de reclamos por daños en esta pieza.', "Please sign the limited release on the back of the tag: it releases the airline from damage claims on this item."), G.cur.lines.limited);
      sys('LIMITED RELEASE FIRMADO · COMENTARIO INGRESADO EN LA RESERVA', 'ok');
      renderPane();
    };
  });
  if ($('#bDG')) $('#bDG').onclick = () => { a.dgRemoved = true; say(A('Ese artículo no puede viajar en el equipaje facturado. Por favor retírelo de la valija; consultamos la Tabla 2.3.A para ver si puede ir en cabina.', "That item can't travel in your checked bag. Please take it out; we'll check the dangerous goods table to see if it can go in the cabin."), G.cur.lines.dgRemove); sys('MMPP: ARTÍCULO RETIRADO DE BODEGA', 'ok'); renderPane(); };
  if ($('#sStrC')) $('#sStrC').onclick = () => { a.stroller = 'counter'; say('El cochecito viaja sin cargo: lo despachamos por la cinta de sobredimensionados. Le pido que firme el limited release.', p.lines.stroller || 'Perfecto.'); sys('COCHECITO: SOBREDIMENSIONADOS · LIMITED RELEASE · SIN CARGO', 'ok'); renderPane(); };
  if ($('#sStrG')) $('#sStrG').onclick = () => { a.stroller = 'gate'; say('El cochecito lo puede usar hasta la puerta: ahí se lo etiquetamos Gate Dispatch y se lo entregan al bajar.', p.lines.stroller || 'Perfecto.'); sys('COCHECITO: GATE DISPATCH EN LA PUERTA', 'ok'); renderPane(); };
  if ($('#sPetOk')) $('#sPetOk').onclick = () => { a.pet = 'accept'; if (!p.booking.ssr.includes('PETC')) p.booking.ssr.push('PETC'); say(A('Su mascota puede viajar en cabina: en su transportín, debajo del asiento, todo el vuelo.', "Your pet can fly in the cabin: in the carrier, under the seat, the whole flight."), p.lines.petOk); sys('SSR PETC INGRESADO · FORMULARIO DE MASCOTA EN CABINA', 'ok'); renderPane(); };
  if ($('#sPetNo')) $('#sPetNo').onclick = () => { a.pet = 'reject'; say(A('Lamentablemente su mascota no puede viajar en la cabina.', "Unfortunately your pet can't travel in the cabin."), p.lines.petNo); sys('MASCOTA NO ACEPTADA EN CABINA', 'warn'); renderPane(); };
  if ($('#sSword')) $('#sSword').onclick = () => { a.retained = true; say(A('La katana no puede ir en cabina: viaja en bodega como objeto retenido, en esta bolsa cerrada. Aviso a operaciones para el NOTOC.', "The katana can't go in the cabin: it travels in the hold as a restricted item, in this sealed bag. I'll notify operations for the NOTOC."), p.lines.sword); sys('RETENIDO: BOLSA DE SEGURIDAD · NOTOC MISCELÁNEOS', 'ok'); renderPane(); };
  if ($('#sIce')) $('#sIce').onclick = () => { a.dryIceFixed = true; say(A('El hielo seco es mercancía peligrosa: puede llevar hasta 2,5 kg y marcamos la conservadora.', "Dry ice is a dangerous good: you can take up to 2.5 kg and we'll label the cooler."), p.lines.dryIce); sys('HIELO SECO: 2,5 KG · BULTO MARCADO', 'ok'); renderPane(); };
  if ($('#sGun')) $('#sGun').onclick = () => firearmModal(p, a, { openModal, closeModal }, (r) => {
    if (r.accept) { if (r.steps.includes('ssr') && !p.booking.ssr.includes('WEAP')) p.booking.ssr.push('WEAP'); say('El arma viaja como retenido: la revisa la PSA, va en la bolsa de retenidos y se la entregan al equipo de seguridad en la puerta de embarque.', p.lines.gunOk || 'Perfecto, gracias.'); sys('RETENIDO: ARMA DE FUEGO · PSA · BOLSA DE RETENIDOS', 'ok'); }
    else { say('Lamentablemente el arma no puede ser aceptada para este vuelo.', '¿Cómo que no? ...Bueno, la llamo a mi señora para que la venga a buscar.'); sys('ARMA DE FUEGO NO ACEPTADA', 'warn'); }
    renderPane();
  });
  if ($('#sAvih')) $('#sAvih').onclick = () => avihModal(p, a, { openModal, closeModal }, (r) => {
    if (r.accept) { if (r.steps.includes('ssr') && !p.booking.ssr.includes('AVIH')) p.booking.ssr.push('AVIH'); say(A('Su mascota viaja en bodega: el canil queda precintado y avisamos al comandante.', 'Your pet travels in the hold: the crate is sealed and the captain is notified.'), A('¡Gracias! Portate bien, eh.', "Thank you! Be good, okay?")); sys('AVIH ACEPTADO · CANIL PRECINTADO', 'ok'); }
    else { say(A('Lamentablemente la mascota no puede ser aceptada en bodega.', "Unfortunately your pet can't be accepted in the hold."), A('¿Y ahora qué hago? ...Voy a llamar a mi hermana.', 'What do I do now? ...I will call my sister.')); sys('AVIH NO ACEPTADO', 'warn'); }
    renderPane();
  });
  if ($('#bVal')) $('#bVal').onclick = () => { a.valuablesMoved = true; say(A('Le recomiendo llevarlo como equipaje de mano: la compañía no se hace responsable por faltantes en bodega.', "I recommend taking it in your carry-on: the airline isn't responsible for valuables in the hold."), G.cur.lines.valuablesMove); sys('ARTÍCULO DE VALOR: TRASLADADO A CABINA', 'ok'); renderPane(); };
}

// Artículos especiales: mascota en cabina, katana (retenido) y hielo seco
function specialItems(p, a) {
  const rows = [];
  if (p.pet) rows.push(`<div class="task ${a.pet ? 'done' : ''}"><div><b>🐾 Mascota en cabina: ${esc(p.pet.name)} (${esc(p.pet.species)}) · ${String(p.pet.kg).replace('.', ',')} kg con transportín</b><small>Cabina: perros, gatos, peces, tortugas y aves no rapaces · máx. 8 kg · 45×35×25 cm</small></div>${a.pet ? `<span class="tag ${a.pet === 'accept' ? 'green' : 'red'}">${a.pet === 'accept' ? 'PETC ACEPTADA' : 'NO ACEPTADA'}</span>` : '<div class="row gap"><button class="btn sm ok" id="sPetOk">Aceptar en cabina</button><button class="btn sm bad" id="sPetNo">No aceptar</button></div>'}</div>`);
  if (p.firearm && (a.bagsShown || a.asked.security)) rows.push(`<div class="task ${a.firearm ? 'done' : ''}"><div><b>🔫 Arma de fuego declarada: ${esc(p.firearm.label)}</b><small>Retenido · documento original + estuche rígido · Tabla 2.3.A</small></div>${a.firearm ? `<span class="tag ${a.firearm.accept ? 'green' : 'red'}">${a.firearm.accept ? 'RETENIDO · WEAP' : 'NO ACEPTADA'}</span>` : '<button class="btn sm warn" id="sGun">Gestionar arma</button>'}</div>`);
  if (p.avih && (a.bagsShown || a.asked.security)) rows.push(`<div class="task ${a.avih ? 'done' : ''}"><div><b>🐕 Mascota en bodega: ${esc(p.avih.name)} (${esc(p.avih.breed)})</b><small>AVIH · perros y gatos (no braquicéfalos ni razas peligrosas) · canil reglamentario</small></div>${a.avih ? `<span class="tag ${a.avih.accept ? 'green' : 'red'}">${a.avih.accept ? 'AVIH ACEPTADO' : 'NO ACEPTADO'}</span>` : '<button class="btn sm warn" id="sAvih">Gestionar AVIH</button>'}</div>`);
  if (p.sword) rows.push(`<div class="task ${a.retained ? 'done' : ''}"><div><b>⚔ Katana de colección</b><small>El pasajero quiere llevarla en la mano</small></div>${a.retained ? '<span class="tag green">RETENIDO</span>' : '<button class="btn sm" id="sSword">Gestionar como retenido</button>'}</div>`);
  if (p.party?.hasInfant) rows.push(`<div class="task ${a.stroller ? 'done' : ''}"><div><b>👶 Cochecito del infante</b><small>Sin costo si viaja con el infante (hasta 2 piezas)</small></div>${a.stroller ? `<span class="tag green">${a.stroller === 'counter' ? 'DESPACHADO + LR' : 'GATE DISPATCH'}</span>` : '<div class="row gap"><button class="btn sm" id="sStrC">Despachar en counter (LR)</button><button class="btn sm" id="sStrG">Entregar en puerta</button></div>'}</div>`);
  if (p.dryIce && a.asked.security) rows.push(`<div class="task ${a.dryIceFixed ? 'done' : ''}"><div><b>❄ Conservadora con hielo seco: ${String(p.dryIce).replace('.', ',')} kg</b><small>Declarado en la cartilla de MMPP</small></div>${a.dryIceFixed ? '<span class="tag green">2,5 KG · MARCADO</span>' : '<button class="btn sm warn" id="sIce">Reducir a 2,5 kg y marcar</button>'}</div>`);
  return rows.length ? `<h3>Artículos especiales</h3>${rows.join('')}` : '';
}

function tagBag(i) {
  teamLocal('bag');
  const a = G.act, b = a.bags[i];
  if (a.manual) {
    manualTag(i, (mt) => {
      b.tagged = true; b.state = 'sent'; b.manualTag = mt;
      b.tag = `MANUAL · ${mt.dest} · ${mt.flt}`;
      scene.sendBag(i);
      sys(`BAG TAG MANUAL COLOCADO · ${mt.dest} ${mt.flt}`, 'ok');
      renderPane();
      setTimeout(() => placeNextBag(), 900);
    });
    return;
  }
  b.tagged = true; b.state = 'sent';
  b.tag = `0${AIRLINE.ticketPrefix}${randomDigits(6)} ${AIRLINE.code} ${G.cur.flight.dest}`;
  scene.sendBag(i);
  sys(`ETIQUETA IMPRESA ${b.tag}`, 'ok');
  renderPane();
  setTimeout(() => placeNextBag(), 900);
}
function repackBag(i) {
  const b = G.act.bags[i];
  b.weight = rndf(22.5, 30.5);
  b.repacked = true;
  say(A('La valija supera los 32 kg, que es el máximo permitido por pieza. ¿Puede pasar algunas cosas al equipaje de mano?', "This bag is over 32 kg, the maximum per piece. Could you move some things to your carry-on?"), G.cur.lines.repack);
  scene.updateScale(b.weight);
  sys(`NUEVO PESO: ${b.weight.toFixed(1)} KG`);
  renderPane();
}
function chargeExcess() {
  const a = G.act;
  const est = computeExcess(G.cur, a.bags.filter((b) => b.tagged).map((b) => b.weight));
  if (!est.amount) { a.charged = 0; sys('SIN EXCESO A COBRAR: EQUIPAJE DENTRO DE FRANQUICIA', 'ok'); renderPane(); return; }
  openModal(`<h2>Cobro de exceso de equipaje</h2>
    <ul class="list">${est.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <p class="big">Total: <b>USD ${est.amount}</b></p>
    <div class="row end gap"><button class="btn ghost" id="cNo">Cancelar</button><button class="btn ok" id="cYes">Emitir EMD y cobrar</button></div>`);
  $('#cNo').onclick = closeModal;
  $('#cYes').onclick = () => {
    a.charged = est.amount;
    closeModal();
    say(A(`Tiene un exceso de equipaje de USD ${est.amount}.`, `You have excess baggage: USD ${est.amount}.`), G.cur.lines.charge);
    sys(`EMD EMITIDO USD ${est.amount}`, 'ok');
    renderPane();
  };
}

// --- 4. Asientos ---------------------------------------------------
function paneSeat(pane) {
  if (needBooking(pane)) return;
  if (inOvbk(G.cur) && seatsLeft() <= 0 && !G.act.seat) {
    pane.innerHTML = '<div class="blank"><b>VUELO COMPLETO · SIN ASIENTOS DISPONIBLES</b><br><small>El vuelo está en sobreventa. Gestioná un voluntario o un DNBD en la pestaña 6 · Sobreventa.</small></div>';
    return;
  }
  const p = G.cur, a = G.act, occ = G.seatMaps[p.flight.no];
  let html = '';
  for (let r = 1; r <= SEATMAP.economyRows[1]; r++) {
    const isJ = r <= SEATMAP.businessRows.at(-1);
    const cols = isJ ? ['A', '', 'C', '', 'D', '', 'F'] : ['A', 'B', 'C', '', 'D', 'E', 'F'];
    const exit = SEATMAP.exitRows.includes(r);
    html += `<div class="srow ${isJ ? 'j' : ''} ${exit ? 'exit' : ''}"><span class="rn">${r}</span>${cols.map((c) => {
      if (!c) return '<span class="aisle"></span>';
      const id = `${r}${c}`;
      const st = a.seat === id || Object.values(a.seats).includes(id) ? 'mine' : occ.has(id) ? 'occ' : 'free';
      return `<button class="seat ${st}" data-s="${id}" ${st === 'occ' ? 'disabled' : ''}>${c}</button>`;
    }).join('')}${exit ? '<span class="exitTag">EXIT</span>' : ''}</div>`;
    if (r === SEATMAP.businessRows.at(-1)) html += '<div class="cabinSep">— ECONOMY —</div>';
  }
  pane.innerHTML = `
    <div class="kv"><span>Vuelo</span><b>${p.flight.no} · ${p.flight.aircraft}</b><span>Cabina reservada</span><b>${p.booking.cabin === 'J' ? 'Business (J)' : 'Economy (Y)'}</b><span>SSR</span><b>${p.booking.ssr.join(' ') || '—'}</b><span>Asiento</span><b>${p.party ? partyMembers(p).filter((m) => !m.isInfant).map((m) => `${esc(m.first)} ${a.seats[m.key] || '—'}`).join(' · ') + (p.party.hasInfant ? ' · INF en brazos' : '') : a.seat || '—'}</b></div>
    ${p.party ? '<p class="hint">Tocá un asiento por cada integrante (en orden). Tocá uno asignado para liberarlo.</p>' : ''}
    <div class="legend"><span class="seat free"></span>Libre <span class="seat occ"></span>Ocupado <span class="seat mine"></span>Asignado <span class="exitTag">EXIT</span> Fila de salida de emergencia</div>
    <div class="seatmap"><div class="nose">▲ FRENTE</div>${html}</div>`;
  pane.querySelectorAll('.seat[data-s]').forEach((b) => {
    b.onclick = () => {
      if (p.party) {
        const id = b.dataset.s;
        const owner = Object.keys(a.seats).find((k) => a.seats[k] === id);
        if (owner) delete a.seats[owner];
        else {
          const next = partyMembers(p).find((m) => !m.isInfant && !a.seats[m.key]);
          if (!next) { sys('TODOS LOS INTEGRANTES YA TIENEN ASIENTO · Tocá uno asignado para liberarlo', 'warn'); return; }
          a.seats[next.key] = id;
          sys(`ASIENTO ${id} → ${norm(next.first)}${isExitRow(id) ? ' · FILA DE SALIDA: VERIFICAR REQUISITOS' : ''}`, isExitRow(id) ? 'warn' : 'ok');
        }
        a.seat = a.seats.lead || null;
        renderPane();
        return;
      }
      a.seat = b.dataset.s;
      sys(isExitRow(a.seat) ? `ASIENTO ${a.seat} · FILA DE SALIDA: VERIFICAR REQUISITOS (adulto, apto, sin asistencia, dispuesto a colaborar)` : `ASIENTO ${a.seat} ASIGNADO`, isExitRow(a.seat) ? 'warn' : 'ok');
      renderPane();
    };
  });
}

// --- 6. Sobreventa ---------------------------------------------------
function paneOvbk(pane) {
  const o = G.ovbk, p = G.cur, a = G.act;
  const f = G.flights.find((x) => x.no === o.flightNo);
  const left = seatsLeft();
  const prots = protectionsFor(f);
  pane.innerHTML = `
    <h3>Sobreventa comercial · ${f.no} ${STATION.code}-${f.dest}</h3>
    <div class="brief">
      <div><span>Capacidad</span><b>${o.capacity}</b></div><div><span>Reservas</span><b>${o.booked}</b></div><div><span>Chequeados</span><b>${G.checkedCount[f.no]}</b></div>
      <div><span>Asientos libres</span><b class="${left <= 0 ? 'err' : left <= 2 ? 'warn' : ''}">${Math.max(0, left)}</b></div><div><span>Por atender (tu fila)</span><b>${G.pax.length - G.idx}</b></div><div><span>Faltarían</span><b class="${projectedShort() ? 'err' : ''}">${projectedShort()} asiento(s)</b></div>
      <div><span>Voluntarios (VDBC)</span><b>${o.volunteers.length}</b></div><div><span>Involuntarios (DNBD)</span><b>${o.dnbd.length}</b></div><div><span>Ofertas hechas</span><b>${o.offeredCount}</b></div>
    </div>
    <p class="hint">Desde el comienzo de la atención, ofrecé a cada pasajero ser voluntario (🙋 en el diálogo). Los pasajeros que no viajan por documentación también liberan asientos. Si el vuelo se llena sin voluntarios: DNBD y protección en el vuelo más próximo.</p>
    <h3>Pasajero en el mostrador</h3>
    ${!p || !inOvbk(p) ? '<p class="hint">El pasajero actual no es de este vuelo.</p>' : `
      <p>${a.offered ? (a.volunteerYes ? '<span class="tag green">ACEPTÓ SER VOLUNTARIO</span>' : '<span class="tag red">NO ACEPTÓ</span>') : '<span class="tag">SIN OFERTA</span>'}</p>
      <div class="row gap wrap">
        <button class="btn ok" id="oVol" ${a.bookingLoaded ? '' : 'disabled'}>🙋 Registrar voluntario (VDBC)</button>
        <button class="btn bad" id="oDnbd" ${a.bookingLoaded ? '' : 'disabled'}>⛔ Embarque denegado involuntario (DNBD)</button>
      </div>`}
    <h3>Matriz (vuelo internacional desde Argentina)</h3>
    <table class="grid"><tr><th>Protección</th><th>Compensación</th></tr>
      ${prots.map((x) => `<tr><td>${esc(x.label)}</td><td>USD ${x.sameDay ? OVBK_POLICY.comp.intl.same : OVBK_POLICY.comp.intl.next}</td></tr>`).join('')}</table>
    <p class="hint">Servicios: alimentación y transporte con atraso de más de 4 h · hotel si hay pernocte para quien retorna o está en tránsito · comunicación siempre.</p>`;
  const reg = (ssr) => {
    if (!a.bookingLoaded) return;
    compForm({ openModal, closeModal }, {
      pax: p, flight: f, title: ssr === 'VDBC' ? '🙋 Registro de voluntario' : '⛔ Embarque denegado involuntario', standbyOption: ssr === 'VDBC',
      onSubmit: (form) => finish({ kind: ssr === 'VDBC' ? 'volunteer' : 'dnbd', form, comp: gradeComp(p, form, f, { ssr }) }),
    });
  };
  if ($('#oVol')) $('#oVol').onclick = () => reg('VDBC');
  if ($('#oDnbd')) $('#oDnbd').onclick = () => reg('DNBD');
}

// --- 5. Timatic ----------------------------------------------------
function paneTimatic(pane) {
  const nat = paneTimatic.nat || G.cur?.nationality || 'AR';
  const dest = paneTimatic.dest || G.cur?.flight.country || 'BR';
  const opt = (obj, v) => Object.entries(obj).map(([k, o]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${o.name}</option>`).join('');
  const r = ENTRY_RULES[dest];
  const national = nat === dest;
  const visa = r.visa[nat];
  const lines = [];
  if (national) lines.push(['ok', `Nacional de ${COUNTRIES[dest].name}: ingresa con pasaporte o documento de identidad vigente.`]);
  else {
    lines.push(r.idCardOk.includes(nat) ? ['ok', `Documento aceptado: PASAPORTE o ${COUNTRIES[nat].idName} vigente.`] : ['warn', 'Documento aceptado: SOLO PASAPORTE.']);
    if (visa) lines.push(['err', `VISA REQUERIDA: ${visa === 'VISA_US' ? 'visa estadounidense (B1/B2 u otra categoría válida)' : 'e-Visa brasileña'}.`]);
    else if (r.esta.includes(nat)) lines.push(['warn', 'Exento de visa (VWP) — requiere ESTA aprobado.']);
    else lines.push(['ok', 'Visa: NO requerida para turismo/negocios.']);
    lines.push(['info', r.validity.kind === 'afterReturn' ? `Validez: mínimo ${r.validity.months} meses posteriores a la fecha de salida del destino.` : 'Validez: vigente durante toda la estadía.']);
  }
  pane.innerHTML = `
    <h3>Timatic · Consulta de requisitos (versión didáctica)</h3>
    <div class="row gap wrap">
      <label class="inl">Nacionalidad <select id="tmNat">${opt(COUNTRIES, nat)}</select></label>
      <label class="inl">Destino <select id="tmDest">${opt(ENTRY_RULES, dest)}</select></label>
    </div>
    <div class="tmRes">
      <h4>${COUNTRIES[nat].name} → ${r.name}</h4>
      <ul class="tm">${lines.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul>
      <h4>Notas del destino</h4>
      <ul class="tm">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <h4>Salida de Argentina · Menores</h4>
      <ul class="tm">${EXIT_RULES_AR.map((n) => `<li>${esc(n)}</li>`).join('')}
      <li>Política ${AIRLINE.name}: servicio de Menor No Acompañado (UMNR) obligatorio de ${UM_POLICY.mandatoryFrom} a ${UM_POLICY.mandatoryTo} años; opcional hasta ${UM_POLICY.optionalTo}. Menores de ${UM_POLICY.minAge} años no pueden viajar solos.</li></ul>
    </div>`;
  $('#tmNat').onchange = (e) => { paneTimatic.nat = e.target.value; renderPane(); };
  $('#tmDest').onchange = (e) => { paneTimatic.dest = e.target.value; renderPane(); };
}

// ------------------------------------------------------------------
// Decisión
// ------------------------------------------------------------------
$('#btnAccept').onclick = () => {
  if (!G.act.bookingLoaded) { sys('NO SE PUEDE EMITIR TARJETA DE EMBARQUE: SIN PNR CARGADO', 'err'); return; }
  if (G.act.bags.some((b) => b.state === 'scale') && !confirmPending()) return;
  if (inOvbk(G.cur) && seatsLeft() < (G.cur.party?.seatHolders || 1)) { sys('SIN ASIENTOS DISPONIBLES · VUELO EN SOBREVENTA · Gestioná voluntario o DNBD (pestaña 6)', 'err'); G.tab = 'ovbk'; renderTabs(); renderPane(); return; }
  if (G.cur.party) autoSeatParty(); else if (!G.act.seat) autoSeat();
  if (G.act.manual) { manualBp(G.act.seat || G.act.autoSeat, (v) => { G.act.manualBp = v; finish({ kind: 'accept', reason: null }); }); return; }
  finish({ kind: 'accept', reason: null });
};
function confirmPending() { return window.confirm('Hay una valija en la balanza sin etiquetar. ¿Finalizar de todos modos?'); }
function autoSeatParty() {
  const occ = G.seatMaps[G.cur.flight.no];
  const taken = new Set([...occ, ...Object.values(G.act.seats)]);
  partyMembers(G.cur).filter((m) => !m.isInfant && !G.act.seats[m.key]).forEach((m) => {
    for (let r = 4; r <= 30; r++) {
      if (SEATMAP.exitRows.includes(r)) continue;
      const c = ['A', 'B', 'C', 'D', 'E', 'F'].find((col) => !taken.has(`${r}${col}`));
      if (c) { G.act.autoSeats = { ...(G.act.autoSeats || {}), [m.key]: `${r}${c}` }; taken.add(`${r}${c}`); return; }
    }
  });
}
function autoSeat() {
  const occ = G.seatMaps[G.cur.flight.no];
  const isJ = G.cur.booking.cabin === 'J';
  for (let r = isJ ? 1 : 4; r <= 30; r++) for (const c of ['C', 'D', 'B', 'E', 'A', 'F']) {
    const id = `${r}${c}`;
    if (!occ.has(id) && !SEATMAP.exitRows.includes(r) && (isJ ? SEATMAP.businessCols.includes(c) : true)) { G.act.autoSeat = id; return; }
  }
}
$('#btnReject').onclick = () => reasonPicker('reject');
$('#btnDerive').onclick = () => reasonPicker('derive');

function reasonPicker(kind) {
  const opts = Object.entries(REASONS).filter(([, r]) => r.kind === kind);
  openModal(`<h2>${kind === 'reject' ? '✖ No aceptar al pasajero' : '↪ Derivar al pasajero'}</h2>
    <p class="hint">${kind === 'reject' ? 'El pasajero no cumple requisitos para viajar (documentación, admisión o seguridad).' : 'El problema se resuelve en otra área (Ventas / Supervisor): reserva, boleto, horario o servicios.'} Indique el motivo:</p>
    <div class="reasons">${opts.map(([k, r]) => `<label><input type="radio" name="rs" value="${k}"> ${esc(r.label)}</label>`).join('')}</div>
    <div class="row end gap"><button class="btn ghost" id="rNo">Cancelar</button><button class="btn ${kind === 'reject' ? 'bad' : 'warn'}" id="rYes" disabled>Confirmar</button></div>`);
  $('#modalBox').querySelectorAll('input').forEach((i) => { i.onchange = () => { $('#rYes').disabled = false; }; });
  $('#rNo').onclick = closeModal;
  $('#rYes').onclick = () => {
    const reason = $('#modalBox').querySelector('input:checked').value;
    closeModal();
    finish({ kind, reason });
  };
}

function finish(decision) {
  lockDecision(true);
  const p = G.cur, a = G.act;
  const elapsed = (performance.now() - a.start) / 1000;
  const ovbkCtx = inOvbk(p) ? { full: seatsLeft() <= 0, needed: projectedShort() > 0, offeredCount: G.ovbk.offeredCount } : null;
  const ev = evaluate(p, a, decision, a.arrival, elapsed, G.mode, ovbkCtx);
  if (a.conflict) { ev.items.push(...a.conflict.items); ev.total += a.conflict.total; }
  const mi = manualItems(p, a, decision);
  if (mi.length) { ev.items.push(...mi); ev.total += mi.reduce((t, x) => t + x.pts, 0); }
  registerManual(p, a, decision);
  if (decision.kind === 'volunteer') G.ovbk.volunteers.push(p);
  if (decision.kind === 'dnbd') G.ovbk.dnbd.push(p);
  if (G.mode !== 'challenge') G.now = new Date(G.now.getTime() + LEARN_MINUTES_PER_PAX * 60000);
  G.score += ev.total;
  const seat = a.seat || a.autoSeat;
  if (decision.kind === 'accept' && p.party) {
    const all = { ...(a.autoSeats || {}), ...a.seats };
    Object.values(all).forEach((x) => G.seatMaps[p.flight.no].add(x));
    G.checkedCount[p.flight.no] += p.party.seatHolders;
  } else if (decision.kind === 'accept' && seat) { G.seatMaps[p.flight.no].add(seat); G.checkedCount[p.flight.no]++; }
  G.results.push({ pax: p, decision, ev, act: a, time: fmtTime(G.now), elapsed });
  queuePaxDone(elapsed);
  teamLocal('done', { dec: decision.kind === 'accept' ? 'accept' : 'reject', name: `${p.first} ${p.last}`, sex: p.sex, seatNo: decision.kind === 'accept' ? (p.party ? null : seat) : null, flight: p.flight.no });
  eventsOnPax();
  if (decision.kind === 'accept') {
    const f = p.flight;
    say(A(`Acá tiene su tarjeta de embarque${a.bags.some((b) => b.tagged) ? ' y el comprobante de equipaje' : ''}. Embarca por la puerta ${f.gate} a las ${fmtTime(new Date(f.depTime - 45 * 60000))}; verifique la puerta en las pantallas. ¡Buen viaje!`, `Here's your boarding pass${a.bags.some((b) => b.tagged) ? ' and baggage receipt' : ''}. Boarding at gate ${f.gate} at ${fmtTime(new Date(f.depTime - 45 * 60000))}; please check the screens for gate changes. Have a nice flight!`), p.lines.accept);
  } else say(null, p.lines[decision.kind]);
  scene.dismiss(decision.kind);
  updateTop();
  setTimeout(() => showFeedback(p, decision, ev, seat), 600);
}

function boardingPass(p, seat) {
  const f = p.flight;
  const boarding = new Date(f.depTime.getTime() - 45 * 60000);
  return `<div class="bp">
    <div class="bpMain">
      <div class="bpHead"><b>✈ ${AIRLINE.name}</b><span>TARJETA DE EMBARQUE · BOARDING PASS</span></div>
      <div class="bpName">${esc(norm(p.booking.last))}/${esc(norm(p.booking.first))} ${p.booking.title}</div>
      <div class="bpGrid">
        <div><span>Desde</span><b>${STATION.code}</b></div><div><span>Hacia</span><b>${f.dest}</b></div>
        <div><span>Vuelo</span><b>${f.no}</b></div><div><span>Fecha</span><b>${fmtGds(G.now)}</b></div>
        <div><span>Embarque</span><b>${fmtTime(boarding)}</b></div><div><span>Puerta</span><b>${f.gate}</b></div>
        <div><span>Asiento</span><b>${seat || '—'}</b></div><div><span>Clase</span><b>${p.booking.cabin}</b></div>
      </div>
      <div class="barcode"></div>
    </div>
    <div class="bpStub"><span>${f.no}</span><b>${seat || ''}</b><span>SEQ ${G.checkedCount[f.no]}</span></div>
  </div>`;
}

function showFeedback(p, decision, ev, seat) {
  const icon = ev.correct ? '✔' : '✖';
  const items = ev.items.map((x) => `<li class="${x.ok === true ? 'ok' : x.ok === false ? 'bad' : 'info'}"><div><b>${esc(x.title)}</b>${x.detail ? `<p>${esc(x.detail)}</p>` : ''}</div>${x.pts ? `<span class="pts">${x.pts > 0 ? '+' : ''}${x.pts}</span>` : ''}</li>`).join('');
  openModal(`
    <div class="fbHead ${ev.correct ? 'ok' : 'bad'}"><span class="ico">${icon}</span><div><h2>${ev.correct ? 'Decisión correcta' : 'Decisión incorrecta'}</h2><small>Caso: ${esc(SCENARIOS[p.scenario])}${p.overlay !== 'none' ? ` · ${esc(overlayLabel(p.overlay))}` : ''}</small></div><b class="tot">${ev.total > 0 ? '+' : ''}${ev.total}</b></div>
    ${decision.kind === 'accept' ? boardingPass(p, seat) : ''}
    <ul class="fb">${items}</ul>
    <div class="row end"><button class="btn ok big" id="fbNext">${G.idx + 1 >= G.pax.length ? 'Ver informe del turno' : 'Llamar al siguiente pasajero ▶'}</button></div>`, 'wide');
  $('#fbNext').onclick = () => { closeModal(); nextPassenger(); };
}
const overlayLabel = (o) => ({ firearm: 'arma de fuego', avih: 'mascota en bodega (AVIH)', overweight: 'sobrepeso', heavy: 'valija > 32 kg', extra_bag: 'pieza adicional', light_bag: 'tarifa sin valija', dg: 'mercancía peligrosa', exit_restricted: 'pide salida de emergencia', face_change: 'cambio de aspecto' })[o] || o;

// ------------------------------------------------------------------
// Fin de turno
// ------------------------------------------------------------------
function endShift() {
  G.running = false;
  $('#mood').classList.add('hidden');
  const outLog = outageEndCheck();
  if (outLog.length) (G.queueLog = G.queueLog || []).push({ type: 'outage', log: outLog });
  teamLocal('end', { score: G.score, ok: G.results.filter((r) => r.ev.correct).length, total: G.results.length });
  const teamSum = teamStop();
  if (teamSum) (G.queueLog = G.queueLog || []).push(teamSum);
  if (G.onEnd) { const cb = G.onEnd; G.onEnd = null; cb(G.results, G.score, G.queueLog || []); return; }
  G.cur = null;
  renderPane();
  $('#dialog').classList.add('hidden');
  const ok = G.results.filter((r) => r.ev.correct).length;
  const inad = G.results.filter((r) => r.decision.kind === 'accept' && r.ev.analysis.expected !== 'accept').length;
  const wrongDeny = G.results.filter((r) => r.decision.kind !== 'accept' && r.ev.analysis.expected === 'accept').length;
  const avg = G.results.reduce((s, r) => s + r.elapsed, 0) / Math.max(1, G.results.length);
  const pct = Math.round((ok / Math.max(1, G.results.length)) * 100);
  const rows = G.results.map((r, i) => {
    const errs = r.ev.items.filter((x) => x.ok === false).map((x) => x.title);
    const lab = { accept: 'Aceptó', reject: 'No aceptó', derive: 'Derivó', volunteer: 'Voluntario', dnbd: 'DNBD' };
    return `<tr class="${r.ev.correct ? '' : 'bad'}"><td>${i + 1}</td><td>${r.time}</td><td>${esc(norm(r.pax.last))}/${esc(norm(r.pax.first))}<br><small>${r.pax.flight.no} · ${COUNTRIES[r.pax.nationality].iso3}</small></td><td>${esc(SCENARIOS[r.pax.scenario])}</td><td>${lab[r.decision.kind]}<br><small>Correcto: ${lab[r.ev.analysis.expected]}</small></td><td>${errs.length ? errs.map(esc).join('<br>') : '—'}</td><td class="num">${r.ev.total}</td></tr>`;
  }).join('');
  const grade = pct >= 90 ? 'Excelente' : pct >= 75 ? 'Muy bien' : pct >= 60 ? 'Aprobado' : 'A reforzar';
  openModal(`
    <div class="report" id="report">
      <h1>Informe de turno · Check-in ${STATION.code}</h1>
      <p>Agente: <b>${esc(G.student)}</b> · Nivel: <b>${G.level}</b> · Modo: <b>${G.mode === 'challenge' ? 'Desafío' : 'Aprendizaje'}</b> · Fecha: ${fmtDate(new Date())}</p>
      <div class="kpis">
        <div><span>Puntaje</span><b>${G.score}</b></div>
        <div><span>Decisiones correctas</span><b>${ok}/${G.results.length} (${pct}%)</b></div>
        <div><span>Pasajeros INAD aceptados</span><b class="${inad ? 'err' : ''}">${inad}</b></div>
        <div><span>Denegaciones injustificadas</span><b class="${wrongDeny ? 'err' : ''}">${wrongDeny}</b></div>
        <div><span>Tiempo promedio</span><b>${Math.round(avg)} s</b></div>
        <div><span>Calificación</span><b>${grade}</b></div>
      </div>
      <table class="grid rep"><tr><th>#</th><th>Hora</th><th>Pasajero</th><th>Caso</th><th>Decisión</th><th>Errores</th><th>Pts</th></tr>${rows}</table>
      ${teamSummaryHTML(teamSum)}
      ${eventsSummaryHTML()}
    </div>
    <div class="row end gap noprint"><button class="btn ghost" id="rpPrint">🖨 Imprimir / PDF</button><button class="btn ok" id="rpNew">Nuevo turno</button></div>`, 'wide report');
  $('#rpPrint').onclick = () => window.print();
  $('#rpNew').onclick = () => location.reload();
  try {
    const hist = JSON.parse(localStorage.getItem('ckHistory') || '[]');
    hist.push({ name: G.student, level: G.level, score: G.score, pct, date: new Date().toISOString() });
    localStorage.setItem('ckHistory', JSON.stringify(hist.slice(-50)));
  } catch {}
}

// ------------------------------------------------------------------
// Manual
// ------------------------------------------------------------------
function showManual(after) {
  const wasPaused = G.paused;
  G.paused = true;
  openModal(`<div class="manual">
    <h1>📘 Manual del agente de check-in</h1>
    <p class="hint">Basado en la Guía de Atención al Pasajero · Unidad 4 (Billetaje y Reservas · TUGA). Cada aerolínea define sus tiempos y procedimientos: en el trabajo real manda el manual de la compañía.</p>
    <h3>Tiempos (vuelos internacionales)</h3>
    <p>Internacional: set up −190 STD · apertura −180 · <b>cierre −70</b>. Cabotaje: set up −130 · apertura −120 · <b>cierre −50</b>. El cierre por sistema (CLOSE CHECK-IN) es obligatorio. Observe el reloj y el tablero.</p>
    <h3>Secuencia de atención en counter</h3>
    <ol>
      <li><b>Saludo cordial</b> con contacto visual. Pida documento de viaje y reserva. Compare la <b>foto</b> con la persona: forma de la cara, nariz, cejas, ojos y tono de piel (peinado, color de pelo o anteojos pueden cambiar).</li>
      <li><b>Identificar la reserva</b> en el sistema (pestaña 1) por código de reserva o apellido: pasajero correcto, vuelo, <b>fecha de hoy</b> y <b>boleto emitido</b>. Identificación positiva: el nombre del boleto coincide con el documento.</li>
      <li><b>Requisitos de ingreso</b> con TIMATIC (pestaña 5): documento aceptado, visa / ESTA / e-Visa, validez y, para visitantes no residentes en EE.UU. y España, <b>pasaje de regreso o de continuación</b> (Migraciones de Argentina no lo controla: es responsabilidad del agente). Quien no cumple no puede ser chequeado ni despachar equipaje.</li>
      <li><b>Familias:</b> con ambos padres, partida de nacimiento + documento del menor; con un solo padre, permiso notarial del que no viaja; con otro adulto (abuelo/a), permiso de ambos padres que lo identifique. Casos especiales: progenitor fallecido → certificado de defunción; ausente → autorización del tribunal de familia (para ese destino); en el exterior → autorización por consulado (no sirve una carta simple); tutor/a → certificado del tribunal que acredite la tutela. Infantes: documento propio, en la reserva (INF), cochecito sin cargo (counter con limited release o Gate Dispatch), nunca en salida de emergencia. APIS y asiento para cada integrante.</li>
      <li><b>Menores:</b> si viaja solo, permiso notarial de ambos padres; con un solo padre, permiso del que no viaja. Servicio UMNR obligatorio entre ${UM_POLICY.mandatoryFrom} y ${UM_POLICY.mandatoryTo} años (política de la compañía del juego).</li>
      <li><b>Gestantes:</b> hasta la semana 28 viajan sin certificado; de la 29 a la 38 con certificado médico / MEDIF de gineco-obstetra, emitido como máximo 10 días antes, con semanas, itinerario y declaración expresa de aptitud; desde la semana 39 no pueden viajar.</li>
      <li><b>Pasajeros insubordinados:</b> CAT 1, tono agresivo o insultos menores pero acata (lo resuelve el agente, con cortesía y firmeza, sin conceder nada fuera de la tarifa). CAT 2, desafiante, no acata: supervisor o seguridad, no se acepta. CAT 3, violencia, daños o amenazas ("llevo una bomba", aunque sea en chiste): se interrumpe la atención, no se toca el equipaje, aviso a la PSA, no viaja.</li>
      <li><b>Cabotaje:</b> documento de viaje vigente (DNI o pasaporte; extranjeros, pasaporte o documento del Mercosur). Por extravío o robo: licencia de conducir vigente, denuncia policial o certificado de trámite. Sin documento no embarca. Datos del documento en el sistema, obligatorios.</li>
      <li><b>Armas de fuego (en este juego, sólo en vuelos de cabotaje):</b> son retenidos. Documento ORIGINAL de tenencia y portación y estuche RÍGIDO. La PSA revisa el documento, SSR WEAP, aviso a operaciones, bolsa de retenidos y entrega en la puerta al equipo de seguridad con la aeronave en posición. DGR 2024: sin NOTOC si la munición pesa menos de 5 kg.</li>
      <li><b>Mascotas en bodega (AVIH):</b> perros y gatos, salvo braquicéfalos y razas peligrosas. Canil rígido, en buen estado, con ventilación, fondo impermeable y tamaño para pararse, darse vuelta y acostarse; precintos en las puertas. Hasta 2 adultos (14 kg c/u) o 3 cachorros de la misma camada por canil. CVI de SENASA para el exterior. SSR AVIH y NOTOC con aviso al capitán.</li>
      <li><b>Condiciones legales:</b> DEPA (detenido/extraditado): reserva con 24 h, mínimo 2 escoltas de una fuerza reconocida por el Estado (uno del mismo sexo si es mujer), ropa de civil, 1 por vuelo, esposado desde la puerta, embarca primero, última fila. Deportado con escolta: al menos 1 escolta (del mismo sexo si es uno), sin esposas, última fila, sin límite de horas. DEPU: sin restricciones.</li>
      <li><b>Alcohol:</b> si observa dos o más señales (habla trabada, rostro congestionado, inestabilidad, incoherencia, no sigue instrucciones, agresividad), el pasajero no debe ser embarcado.</li>
      <li><b>API</b> (pestaña 2): ingrese los datos del documento VIGENTE con el que viaja. En vuelos a EE.UU. verifique la respuesta iAPI (OK TO BOARD / DO NOT BOARD).</li>
      <li><b>Equipaje</b> (pestaña 3): inspección visual en <b>360°</b> de cada pieza; <b>limited release</b> para equipajes no convencionales, en film, sobredimensionados, heavy o con daños. Máximo ${BAG_FEES.maxKg} kg por pieza (ART): reacondicionar. Excesos → cobrar (EMD).</li>
      <li><b>Cartilla de mercancías peligrosas:</b> preguntar siempre y asegurar la respuesta. Ante dudas, Tabla 2.3.A vigente. <b>Artículos de valor:</b> recomendar llevarlos en cabina.</li>
      <li><b>Asiento</b> (pestaña 4): ofrezca proactivamente la salida de emergencia (filas ${SEATMAP.exitRows.join(' y ')}). Solo mayores de 15 años, que lean y comprendan español o inglés, sin movilidad reducida (WCHR/WCHS/WCHC/WCBD/WCBW), sin mascota en cabina (PETC), BLND, DEAF o PPOC, y dispuestos a asistir.</li>
      <li><b>Sistema caído (atención manual):</b> kit de contingencia (boarding pass y bag tag manuales, lista de pasajeros, planilla de control, planilla API manual, planilla de estiba). Tildar al pasajero en la lista, copiar el documento en la planilla API, escribir bag tag (destino y vuelo) y boarding pass a mano. Al volver el sistema, cargar a los pasajeros manuales y transmitir la API antes del cierre.</li>
      <li><b>Decisión:</b> <span class="tag green">Aceptar</span> emite la tarjeta de embarque · <span class="tag red">No aceptar</span> documentación, admisión, identidad, gestación, alcohol · <span class="tag amber">Derivar</span> problemas comerciales (boleto, fecha, nombre, cierre, servicio UM).</li>
      <li><b>Despedida:</b> entregue tarjeta de embarque y comprobante de equipaje, e indique puerta y hora de presentación (verificar en pantallas).</li>
    </ol>
    <h3>Regla de oro</h3>
    <p>Nunca etiquete equipaje antes de confirmar que el pasajero puede viajar: el vuelo no lleva equipajes sin su pasajero. Un pasajero inadmisible (INAD) debe ser devuelto al origen y le cuesta a la aerolínea multas y el vuelo de retorno.</p>
    <div class="row end"><button class="btn ok" id="manClose">Entendido</button></div>
  </div>`, 'wide');
  $('#manClose').onclick = () => { closeModal(); G.paused = wasPaused; if (after) after(); };
}

$('#btnManual').onclick = () => showManual();
$('#btnPause').onclick = () => {
  if (!G.running) return;
  G.paused = true;
  openModal('<div class="pause"><h1>⏸ Pausa</h1><p>El reloj del turno está detenido.</p><button class="btn ok big" id="resume">Continuar</button></div>');
  $('#resume').onclick = () => { closeModal(); G.paused = false; };
};

initQueue(G, scene, { openModal, closeModal, modalOpen });
initTeam(G, scene);
initEvents(G, scene, { boardUpdate: () => { scene.updateBoard(boardFlights(), G.now); if (G.tab === 'ident') renderPane(); } });
initOutage(G, { openModal, closeModal, sys, renderPane, renderTabs, marta: (w) => faceSVG(MARTA, { w, h: Math.round(w * 1.25), bg: '#dce7f0' }) });
initCareer({
  openModal, closeModal, modalOpen, scene, faceSVG,
  getCheckin: () => G,
  setStudent: (name) => { G.student = name; $('#tAvatar').innerHTML = faceSVG(playerFace(), { w: 30, h: 37, bg: '#dce7f0' }); },
  startCheckin: (opts) => { G.level = opts.level || 'basico'; G.mode = opts.mode || 'learn'; startShift(opts); },
  showPractice,
  showOnline,
  startBoarding: (opts) => startBoarding({ ...opts, oldScene: scene, ui: { openModal, closeModal, modalOpen } }),
  showManual,
});

// Sala online: todos arrancan el mismo turno; el anfitrión comparte la ocupación de los vuelos
function startOnline(o) {
  G.student = getPlayer().name || 'Agente';
  G.level = o.level; G.mode = o.mode;
  $('#tAvatar').innerHTML = faceSVG(playerFace(), { w: 30, h: 37, bg: '#dce7f0' });
  startShift({
    team: true, consults: true, counterLabel: `Mostrador ${o.seat} · Todos los vuelos`,
    online: { mySeat: o.seat, players: o.players.filter((p) => p.seat !== o.seat), bots: o.bots, host: o.host, emit: o.emit },
  });
  if (o.shared) {
    Object.entries(o.shared.seatMaps).forEach(([k, arr]) => { G.seatMaps[k] = new Set(arr); });
    Object.assign(G.checkedCount, o.shared.checkedCount);
    renderPane();
  }
  return { seatMaps: Object.fromEntries(Object.entries(G.seatMaps).map(([k, s]) => [k, [...s]])), checkedCount: { ...G.checkedCount } };
}
function toast(html) {
  if (!$('#toast')) document.body.insertAdjacentHTML('beforeend', '<div id="toast" class="toast hidden"></div>');
  const t = $('#toast');
  t.className = 'toast';
  t.innerHTML = html;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add('hidden'), 8000);
}
initOnline({ openModal, closeModal, showHome, startOnline, toast });

// Repaso de los casos que fallaron en un día del Modo Historia
function startReplay(r) {
  G.student = (() => { try { return localStorage.getItem('ckName') || 'Agente'; } catch { return 'Agente'; } })();
  G.level = r.level || 'intermedio';
  G.mode = 'learn';
  if (G.student) $('#tAvatar').innerHTML = faceSVG(playerFace(), { w: 30, h: 37, bg: '#dce7f0' });
  const n = r.where === 'gate' ? r.cases.length - 2 : r.deck.length;
  openModal(`<div class="home"><h1>🔁 Repaso · Día ${r.day} · ${esc(r.title)}</h1>
    <p>${r.where === 'gate' ? 'Puerta de embarque' : 'Counter'}: vas a ver de nuevo ${n === 1 ? 'el caso' : `los ${n} casos`} que te costaron, con pasajeros distintos. Modo aprendizaje, sin reloj y sin afectar tus estrellas.</p>
    <p class="hint">Tip: si dudás, abrí el 📘 Manual. Para eso está.</p>
    <div class="row end gap"><button class="btn ghost" id="rpHome">Volver al menú</button><button class="btn ok big" id="rpGo">Empezar ▶</button></div></div>`, 'wide');
  $('#rpHome').onclick = () => { closeModal(); showHome(); };
  $('#rpGo').onclick = () => {
    closeModal();
    if (r.where === 'gate') {
      startBoarding({ student: G.student, level: G.level, mode: 'learn', flightNo: r.flightNo, cases: r.cases, oldScene: scene, ui: { openModal, closeModal, modalOpen } });
      G.sceneDisposed = true;
    } else {
      startShift({ deck: shuffle(r.deck.slice()), flights: r.flights, start: r.start, counterLabel: 'Mostrador 22 · Repaso', signLabel: 'REPASO DE CASOS', team: false });
    }
  };
}
const replay = (() => { try { const r = JSON.parse(sessionStorage.getItem('ckReplay') || 'null'); sessionStorage.removeItem('ckReplay'); return r; } catch { return null; } })();
if (replay) startReplay(replay); else showHome();
