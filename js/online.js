// SALA ONLINE: hasta 3 compañeros atienden el mismo turno (mostradores 21, 22 y 23).
// Conexión directa entre navegadores (WebRTC con PeerJS): no hace falta un servidor propio.
// Quien crea la sala es el anfitrión: reparte los mostradores, corre los bots de los puestos vacíos
// y reenvía lo que hace cada uno a los demás (topología en estrella).
import { teamRemote, teamBotify, teamOffline, pickBots } from './team.js';
import { getPlayer, playerFace } from './player.js';
import { faceSVG } from './docs.js';
import { esc } from './util.js';

const $ = (s) => document.querySelector(s);
const PEER_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'aeroplata-ckin-';
const SEATS = [22, 21, 23];
let api;
let R = null; // estado de la sala

export function initOnline(a) { api = a; }
export const inRoom = () => !!R?.started;

function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PEER_URL;
    s.onload = () => resolve(window.Peer);
    s.onerror = () => reject(new Error('No se pudo cargar la librería de conexión.'));
    document.head.appendChild(s);
  });
}

const newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
const me = () => { const p = getPlayer(); return { name: p.name || 'Agente', gender: p.gender || 'F' }; };

function leave() {
  clearInterval(R?.beat);
  try { R?.peer?.destroy(); } catch {}
  R = null;
}

// ------------------------------------------------------------------
// Pantalla de inicio de la sala
// ------------------------------------------------------------------
export function showOnline() {
  leave();
  api.openModal(`<div class="home online">
    <h1>🌐 Jugar en sala con compañeros</h1>
    <p class="lead">Hasta tres agentes atienden el mismo turno, cada uno en su mostrador, con la misma fila y los mismos vuelos.
    Ves lo que hacen tus compañeros y les podés mandar mensajes rápidos. Si son menos de tres, los mostradores vacíos los atiende un bot.</p>
    <div class="homeGrid">
      <button class="homeCard" id="onCreate"><span class="big">🏠</span><h2>Crear una sala</h2><p>Te damos un código para compartir con tus compañeros.</p></button>
      <div class="homeCard join"><span class="big">🔑</span><h2>Unirme a una sala</h2>
        <div class="row gap"><input id="onCode" maxlength="4" placeholder="CÓDIGO" autocomplete="off"><button class="btn ok" id="onJoin">Entrar</button></div></div>
    </div>
    <p class="hint" id="onMsg"></p>
    <div class="row end"><button class="btn ghost" id="onBack">← Volver</button></div>
  </div>`, 'wide');
  $('#onBack').onclick = () => { leave(); api.closeModal(); api.showHome(); };
  $('#onCreate').onclick = createRoom;
  $('#onCode').oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); };
  $('#onCode').onkeydown = (e) => { if (e.key === 'Enter') $('#onJoin').click(); };
  $('#onJoin').onclick = () => { const c = $('#onCode').value.trim(); if (c.length === 4) joinRoom(c); else msg('El código tiene 4 letras.'); };
}
const msg = (t) => { const el = $('#onMsg'); if (el) el.textContent = t; };

// ------------------------------------------------------------------
// Anfitrión
// ------------------------------------------------------------------
async function createRoom(tries = 0) {
  msg('Creando la sala...');
  let Peer;
  try { Peer = await loadPeer(); } catch (e) { msg(e.message); return; }
  const code = newCode();
  const peer = new Peer(PREFIX + code);
  R = { host: true, code, peer, conns: new Map(), players: [{ id: 'host', seat: 22, ...me() }], started: false };
  R.seen = new Map();
  // Latido: WebRTC puede tardar mucho en avisar que alguien cerró la ventana
  R.beat = setInterval(() => {
    broadcast({ t: 'ping' });
    R.conns.forEach((c, id) => { if (performance.now() - (R.seen.get(id) || performance.now()) > 15000) { c.close(); onHostClose(c); } });
  }, 4000);
  peer.on('open', () => lobby());
  peer.on('error', (e) => {
    if (e.type === 'unavailable-id' && tries < 4) { clearInterval(R.beat); peer.destroy(); createRoom(tries + 1); return; }
    msg(`No se pudo crear la sala (${e.type}). Revisá la conexión a internet.`);
  });
  peer.on('connection', (conn) => {
    conn.on('data', (m) => onHostData(conn, m));
    conn.on('close', () => onHostClose(conn));
  });
}

function broadcast(m, except) {
  R?.conns.forEach((c, id) => { if (id !== except && c.open) c.send(m); });
}

function onHostData(conn, m) {
  R.seen.set(conn.peer, performance.now());
  if (m.t === 'ping') return;
  if (m.t === 'hello') {
    if (R.started) { conn.send({ t: 'refuse', why: 'El turno de esta sala ya empezó.' }); return; }
    const free = SEATS.filter((s) => !R.players.some((p) => p.seat === s));
    if (!free.length) { conn.send({ t: 'refuse', why: 'La sala está completa (3 de 3).' }); return; }
    R.conns.set(conn.peer, conn);
    R.players.push({ id: conn.peer, seat: free[0], name: String(m.name || 'Agente').slice(0, 30), gender: m.gender === 'M' ? 'M' : 'F' });
    sendRoster();
    lobby();
    return;
  }
  if (m.t === 'desk') {
    // Lo que hizo un compañero: se aplica acá y se reenvía al resto
    teamRemote(m);
    broadcast(m, conn.peer);
  }
}

function onHostClose(conn) {
  const pl = R?.players.find((p) => p.id === conn.peer);
  if (!R?.conns.has(conn.peer)) return;
  R?.conns.delete(conn.peer);
  if (!pl) return;
  R.players = R.players.filter((p) => p !== pl);
  if (R.started) {
    // Su mostrador lo toma un bot
    const key = pickBots([pl.seat], pl.name)[pl.seat];
    teamBotify(pl.seat, key);
    broadcast({ t: 'botify', seat: pl.seat, key });
    api.toast?.(`🔌 ${pl.name} se desconectó: su mostrador lo atiende un bot.`);
  } else { sendRoster(); lobby(); }
}

const sendRoster = () => broadcast({ t: 'roster', players: R.players, code: R.code });

function hostStart() {
  const level = $('#onLevel').value, mode = $('#onPace').value;
  const empty = SEATS.filter((s) => !R.players.some((p) => p.seat === s));
  const bots = pickBots(empty, R.players.map((p) => p.name).join(' '));
  R.started = true;
  api.closeModal();
  // Lo que pase antes de que los demás reciban el "start" se guarda y se manda después
  let ready = false;
  const buf = [];
  const shared = api.startOnline({ seat: 22, players: R.players, bots, host: true, level, mode, emit: (m) => (ready ? broadcast(m) : buf.push(m)) });
  broadcast({ t: 'start', level, mode, players: R.players, bots, shared });
  ready = true;
  buf.forEach((m) => broadcast(m));
}

// ------------------------------------------------------------------
// Compañero que se une
// ------------------------------------------------------------------
async function joinRoom(code) {
  msg('Conectando...');
  let Peer;
  try { Peer = await loadPeer(); } catch (e) { msg(e.message); return; }
  const peer = new Peer();
  R = { host: false, code, peer, conn: null, players: [], started: false };
  R.seenHost = performance.now();
  R.beat = setInterval(() => {
    if (!R?.conn?.open) return;
    R.conn.send({ t: 'ping' });
    if (performance.now() - R.seenHost > 15000) { R.conn.close(); hostLost(); }
  }, 4000);
  peer.on('error', (e) => {
    if (e.type === 'peer-unavailable') msg(`No existe una sala con el código ${code} (o el anfitrión la cerró).`);
    else msg(`Error de conexión (${e.type}).`);
  });
  peer.on('open', () => {
    const conn = peer.connect(PREFIX + code, { reliable: true });
    R.conn = conn;
    conn.on('open', () => conn.send({ t: 'hello', ...me() }));
    conn.on('data', onClientData);
conn.on('close', hostLost);
  });
}

function onClientData(m) {
  R.seenHost = performance.now();
  if (m.t === 'ping') return;
  if (m.t === 'refuse') { msg(m.why); leave(); return; }
  if (m.t === 'roster') { R.players = m.players; lobby(); return; }
  if (m.t === 'start') {
    R.started = true;
    R.players = m.players;
    const mine = m.players.find((p) => p.id === R.peer.id);
    api.closeModal();
    api.startOnline({ seat: mine.seat, players: m.players, bots: m.bots, host: false, level: m.level, mode: m.mode, emit: (x) => R?.conn?.open && R.conn.send(x), shared: m.shared });
    return;
  }
  if (m.t === 'desk') teamRemote(m);
  if (m.t === 'botify') teamBotify(m.seat, m.key);
}

// ------------------------------------------------------------------
// Sala de espera
// ------------------------------------------------------------------
function lobby() {
  const prev = { level: $('#onLevel')?.value, pace: $('#onPace')?.value };
  if (!R) return;
  const seat = (s) => {
    const p = R.players.find((x) => x.seat === s);
    return `<div class="rSeat ${p ? 'on' : ''}"><small>Mostrador ${s}</small>${p
      ? `${faceSVG(playerFace(p.gender), { w: 44, h: 55, bg: '#dce7f0' })}<b>${esc(p.name)}</b>${p.id === 'host' ? '<em>anfitrión/a</em>' : ''}`
      : '<span class="big">🤖</span><b>Libre</b><em>lo atiende un bot</em>'}</div>`;
  };
  api.openModal(`<div class="home online">
    <h1>🌐 Sala ${esc(R.code)}</h1>
    ${R.host
      ? `<p class="lead">Pasales este código a tus compañeros: <b class="code">${esc(R.code)}</b> (en el menú, 🌐 <i>Jugar en sala</i> → <i>Unirme</i>).</p>`
      : '<p class="lead">¡Adentro! Esperando que quien creó la sala empiece el turno...</p>'}
    <div class="rSeats">${[21, 22, 23].map(seat).join('')}</div>
    ${R.host ? `<div class="row gap wrap">
      <label>Nivel<select id="onLevel"><option value="basico">Básico</option><option value="intermedio" selected>Intermedio</option><option value="avanzado">Avanzado</option></select></label>
      <label>Modo<select id="onPace"><option value="challenge" selected>⏱ Desafío · el reloj corre igual para todos</option><option value="learn">📘 Aprendizaje · cada uno a su ritmo</option></select></label>
    </div>` : ''}
    <p class="hint">Cada uno atiende sus propios pasajeros, pero la fila, los vuelos y los asientos son de todos.</p>
    <div class="row end gap"><button class="btn ghost" id="onLeave">Salir de la sala</button>${R.host ? '<button class="btn ok big" id="onStart">Empezar turno ▶</button>' : ''}</div>
  </div>`, 'wide');
  $('#onLeave').onclick = () => { leave(); api.closeModal(); api.showHome(); };
  if (R.host) {
    if (prev.level) $('#onLevel').value = prev.level;
    if (prev.pace) $('#onPace').value = prev.pace;
    $('#onStart').onclick = hostStart;
  }
}

// Se perdió la conexión con el anfitrión
function hostLost() {
  if (!R) return;
  clearInterval(R.beat);
  if (R.started) { teamOffline(); api.toast?.('🔌 Se cortó la conexión con la sala. Seguís con compañeros bot.'); }
  else msg('Se cerró la sala.');
  R = null;
}
