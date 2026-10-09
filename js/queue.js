// PACIENCIA DE LA FILA (modo desafío): la fila se impacienta mientras atendés,
// murmura, se mueve, alguien se quiere colar... y si se agota, termina en un video viral.
import { createPassenger } from './generator.js';
import { faceSVG } from './docs.js';
import { esc, fmtTime, pick, chance } from './util.js';

const $ = (s) => document.querySelector(s);
let G, scene, ui;

const MURMURS = {
  1: ['¿Falta mucho?', 'Uff, esto no avanza...', '¿Por qué no abren otro mostrador?', 'Come on...', 'Nossa, que demora...', '(suspiro larguísimo)', 'Mi vuelo sale en un rato, eh...', '¿Está atendiendo a una familia de doce?'],
  2: ['¡Abran otro mostrador!', '¡Hace media hora que estamos acá!', '¡Llamen a un supervisor!', 'This is ridiculous!', '¡Voy a perder el vuelo!', 'Ya me sé de memoria el cartel de mercancías peligrosas.', '¡Estoy grabando, eh!'],
};
const CALM_COOLDOWN = 90; // segundos reales entre avisos a la fila

export function initQueue(g, sc, u) {
  G = g; scene = sc; ui = u;
  $('#view3d').insertAdjacentHTML('beforeend', `
    <div id="mood" class="mood hidden" title="Paciencia de la fila">
      <span class="face" id="moodFace">😊</span>
      <div class="moodInfo"><small>Paciencia de la fila</small><div class="bar"><i id="moodBar"></i></div></div>
      <button class="btn sm" id="btnCalm">📢 Hablar a la fila</button>
    </div>
    <div id="queueTalk" class="queueTalk hidden"></div>`);
  if (!$('#toast')) document.body.insertAdjacentHTML('beforeend', '<div id="toast" class="toast hidden"></div>');
  $('#btnCalm').onclick = calmQueue;
}

export function resetQueue() {
  Object.assign(G, { patience: 100, queueLog: [], cutters: 0, lastCutter: performance.now(), calmAt: -1e9, lastMurmur: 0, shiftStart: performance.now(), cutCheck: 0 });
  $('#mood').classList.toggle('hidden', G.mode !== 'challenge');
  scene.setQueueMood?.(0);
  render();
}

const queueLen = () => Math.max(0, G.pax.length - G.idx - 1);
export const moodLevel = () => (G.patience > 60 ? 0 : G.patience > 30 ? 1 : 2);

function render() {
  const lv = moodLevel();
  $('#moodFace').textContent = ['😊', '😐', '😠'][lv];
  const bar = $('#moodBar');
  bar.style.width = `${Math.round(G.patience)}%`;
  bar.className = ['ok', 'warn', 'bad'][lv];
  const cd = Math.ceil(CALM_COOLDOWN - (performance.now() - G.calmAt) / 1000);
  const btn = $('#btnCalm');
  btn.disabled = cd > 0 || !queueLen() || !G.cur;
  btn.textContent = cd > 0 ? `📢 (${cd} s)` : '📢 Hablar a la fila';
}

function talk(text, who = 'fila') {
  const el = $('#queueTalk');
  el.className = `queueTalk ${who}`;
  el.innerHTML = `${who === 'agent' ? '<b>📢 Vos:</b> ' : '<b>🗣 Fila:</b> '}${esc(text)}`;
  clearTimeout(talk.t);
  talk.t = setTimeout(() => el.classList.add('hidden'), who === 'agent' ? 6000 : 4200);
}

function toast(ok, html) {
  const t = $('#toast');
  t.className = `toast ${ok ? 'ok' : 'bad'}`;
  t.innerHTML = html;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add('hidden'), 9000);
}
function points(n, why) { G.score += n; G.queueLog.push({ type: 'pts', n, why }); }

// Llamado cada 250 ms desde el reloj del counter
// Globitos sobre la fila: el carácter de la gente y cómo la van llevando con la espera
const BUBBLES = {
  calm: ['📱', '🧉', '😴', '🗺️', '☕', '🎧', '📖', '🥐', '🤳', '💬'],
  wait: ['⏰', '🙄', '😒', '⌚', '😮‍💨', '🥱'],
  mad: ['😤', '💢', '😠', '📢', '🤦', '😡'],
};
let bubbleIn = 3;
function bubbles(dt, level) {
  bubbleIn -= dt;
  if (bubbleIn > 0) return;
  bubbleIn = level >= 2 ? 2 + Math.random() * 2 : level === 1 ? 3.5 + Math.random() * 3 : 6 + Math.random() * 6;
  scene.queueBubble?.(pick(level >= 2 ? BUBBLES.mad : level === 1 ? BUBBLES.wait : BUBBLES.calm));
}
// En modo aprendizaje no hay paciencia que se agote, pero la fila igual nota si una atención se hace muy larga
function learnLevel() {
  const secs = (performance.now() - (G.act?.start || performance.now())) / 1000;
  return secs > 240 ? 2 : secs > 120 ? 1 : 0;
}

export function queueTick(dt) {
  if (!G.running) return;
  const active = G.cur && !G.paused && !ui.modalOpen() && !$('#dialog').classList.contains('hidden');
  if (G.mode !== 'challenge') { if (active) bubbles(dt, learnLevel()); return; }
  if (active) {
    G.patience = Math.max(0, G.patience - (0.05 + 0.02 * Math.min(queueLen(), 12)) * dt);
    const lv = moodLevel();
    if (lv !== (scene.queueMood || 0)) scene.setQueueMood?.(lv);
    bubbles(dt, lv);
    const now = performance.now();
    if (lv >= 1 && now - G.lastMurmur > (lv === 2 ? 11000 : 17000)) { G.lastMurmur = now; talk(pick(MURMURS[lv])); }
    if (G.patience <= 0) viral();
    G.cutCheck += dt;
    if (G.cutCheck >= 5) { G.cutCheck = 0; maybeCutter(); }
  }
  render();
}

// Al terminar cada pasajero la fila avanza y se calma un poco (más si fue rápido)
export function queuePaxDone(elapsedSec) {
  if (G.mode !== 'challenge') return;
  G.patience = Math.min(100, G.patience + (elapsedSec < 60 ? 25 : elapsedSec < 100 ? 18 : 8));
  scene.setQueueMood?.(moodLevel());
  render();
}

function viral() {
  G.patience = 45;
  points(-15, 'Fila al límite: video viral');
  G.queueLog.push({ type: 'viral' });
  scene.setQueueMood?.(1);
  talk('¡Listo, lo subo a redes! "Dos horas en Aeroplata para despachar una valija 🐢"');
  toast(false, '<b>📱 La fila explotó.</b> Un pasajero filmó la espera y la subió a redes. <span class="pts">−15</span><br><small>Atender ágil, hablarle a la fila a tiempo y priorizar bien ayuda a que no llegue a este punto.</small>');
}

function calmQueue() {
  if (!G.cur || !queueLen()) return;
  G.calmAt = performance.now();
  const closing = G.flights.filter((f) => G.now >= f.openTime && G.now < f.closeTime).sort((a, b) => a.closeTime - b.closeTime)[0];
  talk(`Buenas noches, les pedimos disculpas por la demora: estamos atendiendo lo más rápido posible.${closing ? ` Pasajeros del ${closing.no} a ${closing.city}, que cierra a las ${fmtTime(closing.closeTime)}, avísennos.` : ''}`, 'agent');
  G.patience = Math.min(100, G.patience + 22);
  scene.setQueueMood?.(moodLevel());
  render();
}

// ------------------------------------------------------------------
// El que se quiere colar: ¿prioridad por cierre o "haga la fila"?
// ------------------------------------------------------------------
function maybeCutter() {
  if (G.cutters >= 2 || queueLen() < 2) return;
  const now = performance.now();
  if (now - G.lastCutter < 100000 || now - G.shiftStart < 60000) return;
  const mins = (f) => (f.closeTime - G.now) / 60000;
  const open = G.flights.filter((f) => G.now >= f.openTime && mins(f) > 0);
  const urgent = open.filter((f) => mins(f) >= 12 && mins(f) <= 22);
  const relaxed = open.filter((f) => mins(f) >= 40);
  let flight = null, isUrgent = false;
  if (urgent.length && chance(0.45)) { flight = pick(urgent); isUrgent = true; }
  else if (relaxed.length && moodLevel() >= 1 && chance(0.3)) flight = pick(relaxed);
  if (!flight) return;
  G.cutters++; G.lastCutter = now;
  showCutter(flight, isUrgent);
}

function showCutter(flight, urgent) {
  const p = createPassenger({ scenario: 'ok', overlay: 'none', flightNo: flight.no }, G.now, G.flights);
  const left = Math.max(1, Math.round((flight.closeTime - G.now) / 60000));
  const S = (es, en, pt) => ({ es, en, pt })[p.lang] || es;
  const line = urgent
    ? S(`¡Perdón, perdón! Mi vuelo a ${flight.city} cierra en ${left} minutos y la fila no avanza. ¿Me podés atender?`, `Sorry, sorry! My flight to ${flight.city} closes in ${left} minutes and the line isn't moving. Can you help me?`, `Desculpa! Meu voo para ${flight.city} fecha em ${left} minutos e a fila não anda. Pode me atender?`)
    : S('Disculpá, ¿me atendés rápido? Es solo despachar una valija, dos minutitos. Es que odio las filas.', "Excuse me, can you take me real quick? Just one bag, two minutes. I hate lines.", 'Com licença, me atende rapidinho? É só despachar uma mala, dois minutinhos. Odeio fila.');
  ui.openModal(`<div class="cutter">
    <h2>🙋 Alguien se acerca por el costado de la fila</h2>
    <div class="story"><div class="who">${faceSVG(p.face, { w: 78, h: 98, bg: '#cfdbe6' })}<b>${esc(p.first)} ${esc(p.last)}</b></div>
      <div class="says"><p>${esc(line)}</p>
      <p class="hint">Muestra su reserva: <b>${flight.no}</b> a ${esc(flight.city)} · STD ${flight.dep} · <b>cierre del check-in ${fmtTime(flight.closeTime)}</b>.<br>Hora actual: <b>${fmtTime(G.now)}</b> · En fila: ${queueLen()} pasajeros.</p></div></div>
    <div class="row end gap">
      <button class="btn ghost" id="cutLine">🙅 Pedirle que haga la fila</button>
      <button class="btn warn" id="cutNow">⏩ Atenderlo a continuación</button>
    </div></div>`, 'wide');
  const name = `${p.first} ${p.last}`;
  $('#cutNow').onclick = () => {
    ui.closeModal();
    insertNext(p, flight);
    if (urgent) {
      points(10, 'Prioridad a pasajero con cierre próximo');
      G.queueLog.push({ type: 'cut', urgent, ok: true, name, flight: flight.no, city: flight.city });
      G.patience = Math.max(0, G.patience - 5);
      talk('Bueno... si se le va el vuelo, que pase.');
      toast(true, `<b>✔ Bien priorizado.</b> <span class="pts">+10</span><br><small>Su vuelo cerraba en ${left} min. Los pasajeros con cierre próximo se adelantan para que no pierdan el vuelo: es lo que corresponde, aunque la fila proteste un poco.</small>`);
    } else {
      points(-10, 'Adelantó a un pasajero sin motivo');
      G.queueLog.push({ type: 'cut', urgent, ok: false, name, flight: flight.no, city: flight.city });
      G.patience = Math.max(0, G.patience - 25);
      talk('¡Eh! ¡Nosotros también tenemos vuelo! ¡Qué vivo!');
      toast(false, `<b>✖ Se coló.</b> <span class="pts">−10</span><br><small>Su vuelo cierra a las ${fmtTime(flight.closeTime)}: tenía tiempo de sobra. Adelantar a alguien sin motivo es injusto con la fila (y la fila lo vio todo).</small>`);
    }
    scene.setQueueMood?.(moodLevel());
    render();
  };
  $('#cutLine').onclick = () => {
    ui.closeModal();
    if (urgent) {
      points(-15, 'Pasajero con cierre próximo perdió el vuelo en la fila');
      G.queueLog.push({ type: 'cut', urgent, ok: false, name, flight: flight.no, city: flight.city });
      toast(false, `<b>✖ Perdió el cierre.</b> <span class="pts">−15</span><br><small>Su vuelo cerraba en ${left} min y con esta fila no llegaba. Ante un cierre próximo se lo prioriza: ahora Ventas tiene que reprogramarlo (y el reclamo es para la compañía).</small>`);
      talk('¡¿Cómo que haga la fila?! ¡Me voy a quedar sin vuelo!');
    } else {
      points(5, 'Respetó el orden de la fila');
      G.queueLog.push({ type: 'cut', urgent, ok: true, name, flight: flight.no, city: flight.city });
      G.patience = Math.min(100, G.patience + 10);
      G.deck.push({ scenario: 'ok', overlay: 'none', flightNo: flight.no });
      G.pax.push(p);
      talk('¡Eso! ¡A la fila como todos! 👏');
      toast(true, `<b>✔ Orden de la fila respetado.</b> <span class="pts">+5</span><br><small>Su vuelo cierra a las ${fmtTime(flight.closeTime)}: tiene tiempo. Va al final de la fila.</small>`);
    }
    scene.setQueueMood?.(moodLevel());
    render();
  };
}

function insertNext(p, flight) {
  G.deck.splice(G.idx + 1, 0, { scenario: 'ok', overlay: 'none', flightNo: flight.no, pre: p });
  G.pax.splice(G.idx + 1, 0, p);
}
