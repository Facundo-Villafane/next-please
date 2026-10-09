// IMPREVISTOS (Práctica libre): eventos que cortan el turno y se ven en el hall.
//  · Equipaje desatendido → protocolo PSA (evacuación, vallado, brigada de explosivos).
//  · Vuelo cancelado → información, protección y asistencia (Res. ANAC 1532/98); si se maneja mal, piquete.
// El protocolo ocurre igual aunque el agente se equivoque (lo activa otro): la decisión solo suma o resta.
import * as THREE from 'three';
import { canvasTex } from './scene3d.js';
import { randomFace } from './generator.js';
import { teamPause, teamFigs, teamAfterEvac } from './team.js';
import { gtxt, getPlayer } from './player.js';
import { esc, fmtTime, pick, rnd, shuffle } from './util.js';
import { sfx } from './sound.js';

const $ = (s) => document.querySelector(s);
let G, sc, api;
const E = { plan: [], active: null, log: [], protest: null };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function initEvents(g, scene, a) {
  G = g; sc = scene; api = a;
  $('#view3d').insertAdjacentHTML('beforeend', `
    <div id="evt" class="evt hidden">
      <div class="evtHead"><span id="evtIco"></span><div><b id="evtTitle"></b><small id="evtSub"></small></div></div>
      <p id="evtText"></p>
      <div id="evtOpts" class="tmOpts"></div>
      <div class="tmBar hidden" id="evtBarW"><i id="evtBar"></i></div>
      <div id="evtFb" class="evtFb"></div>
    </div>
    <div id="evtTalk" class="queueTalk evtTalk hidden"></div>`);
}

export const eventActive = () => !!E.active;
export const eventLog = () => E.log;

// Un imprevisto por turno (dos en avanzado), en un momento al azar
export function planEvents({ on }) {
  E.plan = []; E.log = []; E.active = null;
  endProtest(true);
  (E.after || []).forEach((a) => a.done()); E.after = [];
  if (!on) return;
  const n = G.pax.length;
  const kinds = shuffle(Object.keys(RUNNERS)).slice(0, G.level === 'avanzado' ? 2 : 1);
  let at = rnd(2, Math.max(2, Math.min(5, n - 3)));
  kinds.forEach((k) => { E.plan.push({ kind: k, at }); at += rnd(4, 6); });
}

// Imprevistos disponibles y cuándo se pueden dar (según los vuelos abiertos en ese momento)
const RUNNERS = {
  unattended: { ok: () => true, run: () => runUnattended() },
  cancel: { ok: () => !!cancelTarget(), run: () => runCancel() },
  delay: { ok: () => !!delayTarget(), run: () => runDelay() },
  celebrity: { ok: () => !!intlOpen().length, run: () => runCelebrity() },
  promo: { ok: () => !!promoFlight(), run: () => runPromo() },
};

// Se llama al pedir el siguiente pasajero: si toca un imprevisto, lo corre y después sigue
export function maybeEvent(next) {
  if (E.active) return true;
  const nextIdx = G.idx + 1;
  const ev = E.plan.find((e) => !e.done && e.at <= nextIdx && nextIdx < G.pax.length);
  if (!ev) return false;
  ev.done = true;
  // Si el planeado ya no es posible (p. ej. cerró el vuelo), va otro que no se haya usado
  const used = E.plan.filter((e) => e.done).map((e) => e.ran);
  const kind = RUNNERS[ev.kind].ok() ? ev.kind : shuffle(Object.keys(RUNNERS)).find((k) => !used.includes(k) && RUNNERS[k].ok()) || 'unattended';
  ev.ran = kind;
  const run = RUNNERS[kind].run;
  E.active = kind;
  $('#view3d').classList.add('evtOn');
  run().catch((e) => console.error(e)).finally(() => { E.active = null; hideCard(); $('#view3d').classList.remove('evtOn'); $('#team')?.classList.remove('dimmed'); next(); });
  return true;
}

// Al pasar pasajeros, el piquete se va desarmando
export function eventsOnPax() {
  if (E.protest && --E.protest.left <= 0) endProtest();
  // Figuras que quedan dando vueltas un rato después del evento
  E.after = (E.after || []).filter((a) => { if (--a.left > 0) return true; a.done(); return false; });
}

// ------------------------------------------------------------------
// Tarjeta del evento (no es modal: el reloj sigue corriendo en modo desafío)
// ------------------------------------------------------------------
function card(ico, title, sub, text) {
  sfx('alarm');
  $('#evt').classList.remove('hidden');
  $('#team')?.classList.add('dimmed');
  $('#evtIco').textContent = ico;
  $('#evtTitle').textContent = title;
  $('#evtSub').textContent = sub || '';
  $('#evtText').innerHTML = text || '';
  $('#evtOpts').innerHTML = '';
  $('#evtFb').innerHTML = '';
  $('#evtBarW').classList.add('hidden');
}
function hideCard() { $('#evt').classList.add('hidden'); }
function caption(ico, title, text) { card(ico, title, '', text); }

// Pregunta con tiempo: resuelve con la opción elegida o null si se acabó el tiempo
function ask(q, opts) {
  $('#evtText').innerHTML += `<p class="q">${esc(q)}</p>`;
  const list = shuffle(opts.slice());
  $('#evtOpts').innerHTML = list.map((o, i) => `<button class="btn sm" data-i="${i}">${esc(o.t)}</button>`).join('');
  const limit = G.mode === 'challenge' ? 25 : 60;
  let left = limit;
  $('#evtBarW').classList.remove('hidden');
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (G.paused || !$('#modal').classList.contains('hidden')) return;
      left -= 0.25;
      $('#evtBar').style.width = `${Math.max(0, (left / limit) * 100)}%`;
      if (left <= 0) { clearInterval(iv); finish(null); }
    }, 250);
    const finish = (o) => {
      clearInterval(iv);
      $('#evtOpts').innerHTML = '';
      $('#evtBarW').classList.add('hidden');
      resolve(o);
    };
    $('#evtOpts').querySelectorAll('button').forEach((b) => { b.onclick = () => finish(list[+b.dataset.i]); });
  });
}

// Puntaje + explicación de una decisión del evento
function grade(ev, o, opts, ptsOk, ptsBad, why, title) {
  const good = opts.find((x) => x.ok);
  const ok = !!o?.ok;
  const pts = ok ? ptsOk : ptsBad;
  G.score += pts;
  E.log.push({ ev, title, ok, pts, answer: o ? o.t : 'No respondiste a tiempo', right: good.t, why });
  $('#evtFb').innerHTML = `<div class="${ok ? 'ok' : 'bad'}"><b>${ok ? '✔' : '✖'} ${o ? (ok ? 'Correcto' : 'Incorrecto') : 'Se acabó el tiempo'}</b> <span class="pts">${pts > 0 ? '+' : ''}${pts}</span>
    <p>${ok ? '' : `Correcto: <b>${esc(good.t)}</b>. `}${esc(why)}</p></div>`;
  return ok;
}

function talk(text, ms = 3500) {
  const t = $('#evtTalk');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(talk.t);
  talk.t = setTimeout(() => t.classList.add('hidden'), ms);
}

function camTo(pos, tgt) {
  if (!sc.camHome) sc.camHome = { pos: sc.camBase.clone(), tgt: sc.camTarget.clone() };
  sc.camGoal = pos ? { pos: new THREE.Vector3(...pos), tgt: new THREE.Vector3(...tgt) } : sc.camHome;
}

// ------------------------------------------------------------------
// Figuras especiales
// ------------------------------------------------------------------
function officer() {
  const f = sc.makePerson({ ...randomFace(pick(['M', 'F']), rnd(26, 45), 'AR'), glasses: false, shirt: '#1d2b4f', pants: '#1a1f2e' });
  const navy = new THREE.MeshStandardMaterial({ color: '#16213d', roughness: 0.6 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.08, 18), navy); cap.position.y = 1.76; f.add(cap);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.1), navy); visor.position.set(0, 1.73, -0.13); f.add(visor);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.3), new THREE.MeshStandardMaterial({ color: '#c8d82a', roughness: 0.6 }));
  vest.position.y = 1.22; f.add(vest);
  const lab = canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#c8d82a'; g.fillRect(0, 0, w, h); g.fillStyle = '#16213d'; g.font = 'bold 34px system-ui'; g.textAlign = 'center'; g.fillText('PSA', w / 2, 36); }).tex;
  [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.1), new THREE.MeshBasicMaterial({ map: lab })); p.position.set(0, 1.26, s * 0.153); if (s < 0) p.rotation.y = Math.PI; f.add(p); });
  return f;
}

function bombSuit() {
  const olive = '#4f5a3c';
  const f = sc.makePerson({ ...randomFace('M', 35, 'AR'), glasses: false, beard: false, hairStyle: 'bald', shirt: olive, pants: olive }, false, 1.12);
  const m = new THREE.MeshStandardMaterial({ color: '#5b6646', roughness: 0.8 });
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 22, 16), m); helmet.position.y = 1.67; helmet.scale.set(1, 1.1, 1.05); f.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.205, 22, 12, Math.PI * 0.62, Math.PI * 0.76, Math.PI * 0.3, Math.PI * 0.32), new THREE.MeshStandardMaterial({ color: '#10161c', roughness: 0.1, metalness: 0.6 }));
  visor.position.y = 1.67; visor.scale.set(1, 1.1, 1.05); f.add(visor);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.32), m); chest.position.y = 1.12; f.add(chest);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 10, 20), m); collar.rotation.x = Math.PI / 2; collar.position.y = 1.47; f.add(collar);
  const lab = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#5b6646'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e2c8'; g.font = 'bold 30px system-ui'; g.textAlign = 'center'; g.fillText('PSA · EXPLOSIVOS', w / 2, 42); }).tex;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.11), new THREE.MeshBasicMaterial({ map: lab })); p.position.set(0, 1.3, 0.165); f.add(p);
  return f;
}

function crowdPerson(withBag = true) {
  const sex = pick(['M', 'F']);
  return sc.makePerson(randomFace(sex, rnd(20, 70), pick(['AR', 'AR', 'CL', 'BR', 'UY', 'US'])), withBag, 0.96 + Math.random() * 0.08);
}

// Vallado con tensabarriers alrededor de un punto
function cordon(cx, cz, r, n = 10) {
  const grp = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: '#b8bec6', metalness: 0.85, roughness: 0.25 });
  const beltMat = new THREE.MeshStandardMaterial({ color: '#d6a400', roughness: 0.6 });
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  const parts = [];
  pts.forEach(([x, z], i) => {
    const post = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 10), postMat); p.position.y = 0.475; post.add(p);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 16), postMat); b.position.y = 0.015; post.add(b);
    post.position.set(x, 0, z);
    const [x2, z2] = pts[(i + 1) % n];
    const len = Math.hypot(x2 - x, z2 - z);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.01), beltMat);
    belt.position.set((x + x2) / 2, 0.88, (z + z2) / 2);
    belt.rotation.y = -Math.atan2(z2 - z, x2 - x);
    post.visible = false; belt.visible = false;
    grp.add(post, belt);
    parts.push(post, belt);
  });
  sc.scene.add(grp);
  parts.forEach((p, i) => setTimeout(() => { p.visible = true; }, 250 * i));
  return grp;
}

// ------------------------------------------------------------------
// Evacuación del sector (todos salen; después vuelven a su lugar)
// ------------------------------------------------------------------
let saved = [];
function evacuate() {
  const figs = new Map();
  sc.queue.forEach((q) => figs.set(q.fig, null));
  Object.values(sc.side || {}).forEach((c) => figs.set(c.agent, null));
  teamFigs().forEach((f) => figs.set(f, null));
  sc.walkers.forEach((w) => { if (w.ambient || w.idle) figs.set(w.fig, w); });
  (E.protest?.figs || []).forEach((f) => figs.set(f, null));
  saved = [...figs.entries()].map(([fig, w]) => ({ fig, w, pos: fig.position.clone(), rot: fig.rotation.y }));
  sc.walkers = sc.walkers.filter((w) => !figs.has(w.fig));
  saved.forEach((e, i) => {
    const p = e.fig.position;
    const path = p.z < 0 ? [[16, -1.4]] : [[Math.max(p.x, -2.5) + 0.6, Math.max(p.z, 7.6)], [16, 8.6 + (i % 6) * 0.45]];
    setTimeout(() => sc.walkTo(e.fig, path, 1.55 + Math.random() * 0.4).then(() => { e.fig.visible = false; }), i * 90);
  });
}
function restore() {
  const figs = new Set(saved.map((e) => e.fig));
  sc.walkers = sc.walkers.filter((w) => !figs.has(w.fig));
  saved.forEach((e) => {
    e.fig.visible = true;
    e.fig.position.copy(e.pos);
    e.fig.rotation.y = e.rot;
    if (e.w) sc.walkers.push(e.w);
  });
  sc.queue.forEach((q, i) => { const [x, z] = sc.slots[i]; q.fig.position.set(x, 0, z); q.fig.rotation.y = Math.PI; });
  saved = [];
  teamAfterEvac();
}

// ------------------------------------------------------------------
// 1) EQUIPAJE DESATENDIDO
// ------------------------------------------------------------------
const UNATTENDED_WHY = 'Ante un equipaje desatendido: no se toca, no se mueve ni se abre. Quien lo detecta da aviso a la PSA. La PSA acude, ordena evacuar el sector, lo acordona con tensabarriers y convoca a la brigada de explosivos. Hasta que el sector se habilita, nadie atiende.';

async function runUnattended() {
  const BX = -4.5, BZ = 8.3;
  teamPause(true);
  const bag = sc.makeBag(pick(['#2d5a3d', '#6b4a2a', '#7a1f2a', '#1f3b57']));
  bag.position.set(BX, 0, BZ); bag.rotation.y = 0.4;
  sc.scene.add(bag);
  const tmp = [bag];
  camTo([-2.4, 3.4, 2.4], [BX, 1.2, BZ]);
  // Marca en el piso (la valija tiene que verse entre la gente)
  const mark = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 32), new THREE.MeshBasicMaterial({ color: '#ffc04d', transparent: true, side: THREE.DoubleSide }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(BX, 0.02, BZ); sc.scene.add(mark); tmp.push(mark);
  const pulse = (dt, t) => { mark.material.opacity = 0.45 + Math.sin(t * 5) * 0.4; mark.scale.setScalar(1 + Math.sin(t * 5) * 0.12); };
  sc.animators.push(pulse);
  card('🧳', 'Equipaje desatendido en el sector', 'Imprevisto', `Una valija sola junto a un tacho de basura, a pocos metros de las filas de check-in. Pasan los minutos y nadie la reclama. Un pasajero de tu fila la señala: "¿De quién es eso?"`);
  talk('—¿De quién es esa valija? Hace rato que está ahí sola...');
  const q1 = [
    { t: 'Doy aviso a la PSA de inmediato', ok: true },
    { t: 'Me acerco, la abro para ver de quién es y la llevo a Objetos Perdidos', ok: false },
    { t: 'Pregunto en voz alta de quién es y sigo atendiendo: seguro aparece el dueño', ok: false },
  ];
  const a1 = await ask('¿Qué hacés?', q1);
  grade('unattended', a1, q1, 15, a1 && a1.t.includes('abro') ? -20 : -10, UNATTENDED_WHY, 'Equipaje desatendido: aviso');
  await wait(4500);

  // Llega la PSA (si no la llamaste vos, la llamó otro)
  caption('🚓', 'Llega la PSA', a1?.ok ? 'Avisaste a la PSA: en un par de minutos llegan dos efectivos.' : 'Un agente del mostrador de al lado dio aviso a la PSA. En un par de minutos llegan dos efectivos.');
  const cops = [officer(), officer()];
  cops.forEach((c, i) => { c.position.set(15, 0, 8.4 + i * 0.7); sc.scene.add(c); tmp.push(c); });
  await Promise.all(cops.map((c, i) => sc.walkTo(c, [[BX + 2.6 + i * 0.4, BZ + 1.4 - i * 1.2]], 2.4)));
  cops.forEach((c) => { c.rotation.y = Math.atan2(c.position.x - BX, c.position.z - BZ); });
  talk('PSA: —¡Atención! Por razones de seguridad, desalojen el sector. Diríjanse hacia la salida, por favor.', 5000);
  await wait(1500);

  const q2 = [
    { t: 'Dejo el puesto y salgo con los pasajeros por donde indica la PSA', ok: true },
    { t: 'Termino de despachar a los que esperan: es un minuto', ok: false },
    { t: 'Me quedo en el mostrador para cuidar el sistema abierto', ok: false },
  ];
  caption('🚨', 'La PSA ordena evacuar el sector', 'Todos los mostradores cerca de la valija quedan dentro del área a desalojar.');
  const a2 = await ask('¿Qué hacés?', q2);
  grade('unattended', a2, q2, 10, -15, 'Cuando la PSA ordena desalojar, se deja el puesto y se sale con los pasajeros por donde indican. Nadie atiende ni vuelve a buscar nada hasta que la PSA habilita el sector.', 'Equipaje desatendido: evacuación');
  evacuate();
  await wait(1200);
  // El agente queda fuera del sector: se ve todo de lejos
  camTo([1.0, 2.5, 12.2], [BX, 0.9, BZ - 0.3]);
  caption('🚧', 'Sector evacuado y acordonado', 'La PSA cierra el área con tensabarriers. Desde afuera del sector se espera a la brigada de explosivos.');
  const ring = cordon(BX, BZ, 1.9);
  tmp.push(ring);
  await Promise.all(cops.map((c, i) => sc.walkTo(c, [i ? [BX - 2.4, BZ + 0.8] : [BX + 2.4, BZ - 1.3]], 1.4)));
  cops.forEach((c) => { c.rotation.y = Math.PI; });
  await wait(4000);

  caption('💣', 'Llega la brigada de explosivos de la PSA', 'Un técnico con traje antiexplosivos se acerca a la valija; otro lo asiste con el equipo de rayos X portátil.');
  const eod = bombSuit(), eod2 = bombSuit();
  eod.position.set(15, 0, 9.4); eod2.position.set(16, 0, 9.8);
  sc.scene.add(eod, eod2); tmp.push(eod, eod2);
  await Promise.all([sc.walkTo(eod, [[BX + 2.8, 8.6], [BX + 0.55, BZ + 0.15]], 0.75), sc.walkTo(eod2, [[BX + 3.6, 9.2], [BX + 2.3, BZ + 2.3]], 0.8)]);
  // Se agacha frente a la valija
  eod.rotation.y = Math.PI / 2 + 0.2;
  const crouch = (dt) => { eod.position.y = Math.max(-0.34, eod.position.y - dt * 0.6); eod.userData.legs?.forEach((l) => { l.rotation.x = Math.max(-1.3, l.rotation.x - dt * 3); }); eod.userData.arms?.forEach((a) => { a.rotation.x = Math.max(-1.1, a.rotation.x - dt * 2); }); };
  sc.animators.push(crouch);
  const xray = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.06), new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.5 }));
  xray.position.set(BX - 0.45, 0.22, BZ); xray.rotation.y = Math.PI / 2;
  setTimeout(() => sc.scene.add(xray), 2500); tmp.push(xray);
  caption('🔍', 'Inspección de la valija', 'Placa de rayos X, inspección visual... el hall en silencio. Mientras tanto, el sector sigue cerrado.');
  talk('(Alguien en la fila evacuada: —Yo sabía que hoy no tenía que venir...)', 4000);
  await wait(7000);
  sc.animators.splice(sc.animators.indexOf(crouch), 1);
  eod.position.y = 0; eod.userData.legs?.forEach((l) => { l.rotation.x = 0; }); eod.userData.arms?.forEach((a) => { a.rotation.x = 0; });

  // Falsa alarma: aparece el dueño con un café
  const owner = crowdPerson(false);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.11, 12), new THREE.MeshStandardMaterial({ color: '#f4efe6' }));
  cup.position.set(0.26, 0.95, -0.12); owner.add(cup);
  owner.position.set(15, 0, 10.2); sc.scene.add(owner); tmp.push(owner);
  caption('☕', 'Falsa alarma', 'La valija tenía ropa, un mate y un alfajor a medio comer. Y aparece el dueño...');
  await sc.walkTo(owner, [[BX + 4.2, BZ + 3.0]], 1.5);
  talk(`—¡Es mía! Fui a buscar un cortado... ¿qué pasó acá?`, 4500);
  await sc.walkTo(cops[0], [[BX + 3.6, BZ + 2.7]], 1.3);
  talk('PSA: —Señor, acompáñenos, por favor. Vamos a tener que labrar un acta.', 4500);
  await wait(3000);
  // Se llevan la valija y al dueño
  eod.add(bag); bag.position.set(0.42, 0, 0.05); bag.rotation.set(0, 0, 0);
  caption('🚶', 'La PSA retira la valija', 'La brigada se lleva la valija; el dueño acompaña a la PSA para el acta. Se levanta el vallado.');
  ring.visible = false;
  await Promise.race([wait(6500), Promise.all([
    sc.walkTo(eod, [[16, 9.4]], 1.5), sc.walkTo(eod2, [[16, 9.9]], 1.5), sc.walkTo(owner, [[16, 10.4]], 1.5),
    sc.walkTo(cops[0], [[16, 10.8]], 1.5), sc.walkTo(cops[1], [[16, 8.8]], 1.5),
  ])]);

  // Tiempo: el sector estuvo cerrado
  const mins = rnd(25, 35);
  G.now = new Date(G.now.getTime() + mins * 60000);
  E.log.push({ ev: 'unattended', title: 'Sector cerrado', ok: null, pts: 0, answer: `${mins} minutos sin atención`, why: 'El tiempo que el sector está cerrado corre para todos los vuelos: después del imprevisto, revisá qué vuelos cierran pronto.' });
  sc.animators.splice(sc.animators.indexOf(pulse), 1);
  tmp.forEach((o) => sc.scene.remove(o));
  restore();
  camTo(null);
  caption('✅', `La PSA habilita el sector · ⏱ +${mins} min`, `Son las ${fmtTime(G.now)}. Volvés al mostrador: la fila se rearma y algunos vuelos están más cerca del cierre. Revisá el tablero.`);
  api.boardUpdate();
  teamPause(false);
  await wait(6000);
}

// ------------------------------------------------------------------
// 2) VUELO CANCELADO (Res. ANAC 1532/98)
// ------------------------------------------------------------------
function cancelTarget() {
  const open = G.flights.filter((f) => G.now >= f.openTime && (f.closeTime - G.now) / 60000 > 15);
  const cands = open.map((f) => ({ f, next: G.flights.filter((g) => g.dest === f.dest && g.depTime > f.depTime).sort((a, b) => a.depTime - b.depTime)[0] })).filter((x) => x.next);
  return cands.length ? pick(cands) : null;
}

const RES_WHY = 'Res. ANAC 1532/98 (Condiciones Generales del Contrato de Transporte Aéreo): ante una cancelación, la compañía debe ofrecer la protección en el primer vuelo disponible o el reembolso, y brindar sin cargo comunicación, comidas y refrigerios acordes a la espera y, si hay que pasar la noche, hotel y traslados.';
const SIGNS = ['¡AEROPLATA RESPETÁ AL PASAJERO!', 'QUEREMOS VOLAR', 'RES. 1532/98 ¡CUMPLAN!', '¿Y MI VALIJA?', 'NI UN VUELO MENOS', '¡¿Y EL VOUCHER?!'];
const CHANTS = ['🥁 ¡Que-re-mos vo-lar! ¡Que-re-mos vo-lar!', '🥁 ¡Ae-ro-pla-ta, es-cu-chá: el pa-sa-je-ro no se va!', '📣 ¡¿Dónde está el gerente?! ¡¿Dónde está?!', '🥁 Pum, pum, pum... (alguien trajo un bombo, nadie sabe de dónde)', '📣 ¡Se va a acabar, se va a acabar, esta costumbre de cancelar!'];

async function runCancel() {
  const { f, next } = cancelTarget();
  f.cancelled = true;
  G.cancelled = [...(G.cancelled || []), f];
  G.flights = G.flights.filter((x) => x !== f);
  api.boardUpdate();
  const waitH = Math.round(((next.depTime - f.depTime) / 3600000) * 10) / 10;
  card('✖', `${f.no} a ${f.city}: CANCELADO`, 'Imprevisto · IROPS', `El CCO informa: el ${f.no} de las ${f.dep} a ${f.city} se cancela por una falla técnica de la aeronave. En el tablero ya dice <b>CANCELADO</b> y los pasajeros del vuelo vienen todos juntos a tu mostrador.`);
  // Llega el grupo del vuelo cancelado
  const crowd = [];
  for (let i = 0; i < 9; i++) {
    const c = crowdPerson(true);
    c.position.set(4 + Math.random() * 6, 0, 10.5 + Math.random() * 1.5);
    sc.scene.add(c); crowd.push(c);
  }
  const spots = crowd.map((c, i) => [1.5 + (i % 3) * 0.6 + Math.random() * 0.2, 2.5 + Math.floor(i / 3) * 0.8 + Math.random() * 0.2]);
  crowd.forEach((c, i) => setTimeout(() => sc.walkTo(c, [spots[i]], 1.4 + Math.random() * 0.4).then(() => { c.rotation.y = 0.35; }), i * 250));
  talk(`—¡¿Cómo que cancelado?! ¡Yo tengo que estar en ${f.city} esta noche!`, 4500);
  let errors = 0;

  const q1 = [
    { t: 'Informo con claridad: motivo, que se los va a proteger en otro vuelo y que van a tener asistencia mientras esperan', ok: true },
    { t: 'Les digo que no tengo información y que esperen', ok: false },
    { t: 'Les digo que es por mal tiempo, así no reclaman', ok: false },
  ];
  if (!grade('cancel', await ask('Los pasajeros se agolpan en tu mostrador. ¿Qué hacés primero?', q1), q1, 10, -10, 'Ante una contingencia, la información clara y honesta es lo primero: qué pasó, qué se va a hacer y qué asistencia van a recibir. Inventar un motivo o "no saber nada" es lo que enciende la protesta.', 'Cancelación: información')) errors++;
  await wait(4500);

  card('🔁', 'Protección', `Próximo vuelo a ${f.city}: ${next.no} de las ${next.dep}, con lugar`, '');
  const q2 = [
    { t: `Protección en el ${next.no} de las ${next.dep} (mismo día) o el reembolso, a elección del pasajero`, ok: true },
    { t: 'Sólo el reembolso del pasaje', ok: false },
    { t: 'Que llamen al call center para reprogramar', ok: false },
  ];
  if (!grade('cancel', await ask('¿Qué les ofrecés?', q2), q2, 10, -10, RES_WHY, 'Cancelación: protección')) errors++;
  await wait(4500);

  card('🍽', 'Asistencia', `Espera hasta el ${next.no}: unas ${waitH} horas, sin pasar la noche`, '');
  const q3 = [
    { t: 'Comunicación y comidas o refrigerios acordes a la espera (vouchers)', ok: true },
    { t: 'Hotel y traslados para todos', ok: false },
    { t: 'Nada: es una falla técnica, no corresponde asistencia', ok: false },
  ];
  if (!grade('cancel', await ask('¿Qué asistencia corresponde?', q3), q3, 10, -10, `${RES_WHY} Con ${waitH} horas de espera en el mismo día corresponden comunicación y comidas o refrigerios; hotel y traslados, sólo si la espera obliga a pernoctar.`, 'Cancelación: asistencia')) errors++;
  await wait(4500);

  if (errors === 0) {
    caption('🙌', 'Contingencia bien manejada', `Los pasajeros del ${f.no} se van al patio de comidas con sus vouchers, protegidos en el ${next.no}. Alguno hasta te agradece.`);
    talk('—Bueno, por lo menos nos explicaron... ¿alguien sabe dónde está el patio de comidas?', 4500);
    E.log.push({ ev: 'cancel', title: 'Pasajeros del vuelo cancelado', ok: true, pts: 0, answer: 'Se retiraron tranquilos', why: '' });
    await wait(1500);
    crowd.forEach((c, i) => setTimeout(() => sc.walkTo(c, [[-3 - Math.random() * 3, 8.5], [-16, 9.5]], 1.2).then(() => sc.scene.remove(c)), i * 200));
    await wait(4000);
    return;
  }
  // Piquete en los mostradores
  caption('🪧', '¡Piquete en los mostradores!', `Entre la demora y las respuestas, los pasajeros del ${f.no} se organizaron: carteles, cantos y un bombo. Vas a tener que seguir atendiendo así un rato.`);
  E.log.push({ ev: 'cancel', title: 'Piquete en los mostradores', ok: false, pts: -10, answer: `${errors} ${errors === 1 ? 'respuesta' : 'respuestas'} mal o a destiempo`, why: 'Una contingencia mal informada o lenta termina en protesta: afecta a todos los vuelos del sector, no sólo al cancelado.' });
  G.score -= 10;
  if (G.patience != null) G.patience = Math.max(0, G.patience - 35);
  startProtest(crowd, f);
  await wait(5000);
}

function startProtest(crowd, f) {
  crowd.forEach((c, i) => {
    const text = SIGNS[i % SIGNS.length].replace('QUEREMOS VOLAR', `¡QUEREMOS IR A ${f.city.toUpperCase()}!`);
    if (i % 3 === 2) return;
    const t = canvasTex(320, 150, (g, w, h) => {
      g.fillStyle = '#f7f3e8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = i % 2 ? '#b3122a' : '#14306b'; g.font = 'bold 34px Impact, system-ui'; g.textAlign = 'center';
      const words = text.split(' '); let line = '', y = 50; const lines = [];
      words.forEach((wd) => { if (g.measureText(`${line} ${wd}`).width > w - 30) { lines.push(line); line = wd; } else line = line ? `${line} ${wd}` : wd; });
      lines.push(line);
      y = h / 2 - ((lines.length - 1) * 38) / 2 + 12;
      lines.forEach((l, k) => g.fillText(l, w / 2, y + k * 38));
    }).tex;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.35), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.8 }));
    sign.position.y = 2.15; sign.rotation.y = Math.PI;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.75), new THREE.MeshStandardMaterial({ color: '#8a6d3b' }));
    stick.position.y = 1.75;
    c.add(sign, stick);
  });
  const anim = (dt, t) => {
    crowd.forEach((c, i) => {
      if (!c.visible) return;
      c.position.y = Math.abs(Math.sin(t * 5 + i * 1.3)) * 0.08;
      c.userData.arms?.forEach((a, k) => { a.rotation.x = -2.5 + Math.sin(t * 6 + i + k) * 0.35; });
    });
  };
  sc.animators.push(anim);
  let ci = 0;
  const iv = setInterval(() => { if (E.protest) talk(CHANTS[ci++ % CHANTS.length], 3800); }, 5500);
  E.protest = { figs: crowd, anim, iv, left: 3, f };
  talk(CHANTS[0], 3800);
}

function endProtest(silent) {
  const p = E.protest;
  if (!p) return;
  E.protest = null;
  clearInterval(p.iv);
  const k = sc.animators.indexOf(p.anim);
  if (k >= 0) sc.animators.splice(k, 1);
  if (silent) { p.figs.forEach((c) => sc.scene.remove(c)); return; }
  talk(`Viviana llegó con los vouchers, la protección para el próximo vuelo y cara de pocos amigos a ${p.f.city}. El piquete se levanta... por ahora.`, 5500);
  p.figs.forEach((c, i) => {
    c.position.y = 0; c.userData.arms?.forEach((a) => { a.rotation.x = 0; });
    setTimeout(() => sc.walkTo(c, [[-3 - Math.random() * 3, 8.5], [-16, 9.5]], 1.2).then(() => sc.scene.remove(c)), i * 200);
  });
}

// ------------------------------------------------------------------
// Utilidades de escena para los grupos
// ------------------------------------------------------------------
const openNow = (f, margin = 15) => G.now >= f.openTime && (f.closeTime - G.now) / 60000 > margin;
const intlOpen = () => G.flights.filter((f) => f.country !== 'AR' && openNow(f));
const faceTo = (fig, x, z) => { fig.rotation.y = Math.atan2(-(x - fig.position.x), -(z - fig.position.z)); };
function leave(figs, side = 1) {
  figs.forEach((c, i) => setTimeout(() => {
    c.position.y = 0;
    c.userData.arms?.forEach((a) => { a.rotation.x = 0; });
    sc.walkTo(c, [[side * 3 + Math.random() * 2, 8.4 + Math.random()], [side * 16, 9.5]], 1.3).then(() => sc.scene.remove(c));
  }, i * 180));
}
function addAnim(fn) { sc.animators.push(fn); return () => { const k = sc.animators.indexOf(fn); if (k >= 0) sc.animators.splice(k, 1); }; }
// Cartel o bandera de tela (mira hacia el mostrador)
function banner(text, w, h, colors = ['#f7f3e8', '#b3122a']) {
  const t = canvasTex(Math.round(w * 400), Math.round(h * 400), (g, cw, ch) => {
    g.fillStyle = colors[0]; g.fillRect(0, 0, cw, ch);
    g.fillStyle = colors[1]; g.font = `bold ${Math.round(ch * 0.42)}px Impact, system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, cw / 2, ch / 2 + 4);
  }).tex;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.8 }));
  m.rotation.y = Math.PI;
  return m;
}
// Tres preguntas seguidas: devuelve cuántas salieron mal
async function quiz(ev, steps) {
  let errors = 0;
  for (const s of steps) {
    if (s.card) card(...s.card);
    if (s.say) talk(s.say, 5000);
    if (!grade(ev, await ask(s.q, s.opts), s.opts, s.pts?.[0] ?? 10, s.pts?.[1] ?? -10, s.why, s.title)) errors++;
    await wait(4800);
  }
  return errors;
}

// ------------------------------------------------------------------
// 3) VUELO DEMORADO
// ------------------------------------------------------------------
const CONNECT = { MIA: ['Miami', 'Orlando'], MAD: ['Madrid', 'Roma'], GRU: ['São Paulo', 'Recife'], SCL: ['Santiago', 'Lima'], BRC: ['Bariloche', 'El Calafate'], IGR: ['Iguazú', 'Asunción'] };
function delayTarget() {
  // Demora de unas 3 horas sin pasar la medianoche (no hay pernocte)
  const c = G.flights.filter((f) => openNow(f, 10) && !f.delayed && f.depTime.getHours() * 60 + f.depTime.getMinutes() + 210 < 24 * 60);
  return c.length ? pick(c) : null;
}

async function runDelay() {
  const f = delayTarget();
  const mins = pick([150, 165, 180, 195]);
  const etd = new Date(f.depTime.getTime() + mins * 60000);
  f.delayed = fmtTime(etd);
  api.boardUpdate();
  const h = Math.round((mins / 60) * 10) / 10;
  card('⏳', `${f.no} a ${f.city}: DEMORADO`, 'Imprevisto · IROPS', `El CCO informa que el avión del ${f.no} llega tarde de su vuelo anterior: nueva hora estimada de salida <b>${f.delayed}</b> (${h} h de demora). En el tablero ya dice DEMORADO y en la fila empiezan los suspiros.`);
  sc.setQueueMood?.(1);
  talk(pick(['—¿Demorado? Le aviso a mi suegra que llego tarde... qué pena, che.', '—¡Tres horas! Ya me sé de memoria el cartel de mercancías peligrosas.', '—¿Y ahora qué hacemos acá tres horas?']), 5000);
  // El que se acuesta en el piso y el nene con el avioncito
  const extra = [];
  const sleeper = crowdPerson(false);
  sleeper.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - 0.2);
  sleeper.position.set(2.6, 0.12, 7.8);
  const pillow = sc.makeBag('#7a1f2a'); pillow.rotation.z = Math.PI / 2; pillow.position.set(3.45, 0, 7.75);
  const kid = sc.makePerson(randomFace(pick(['M', 'F']), 6, 'AR'), false, 0.55);
  const toy = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.06), new THREE.MeshStandardMaterial({ color: '#f2f2f2' }));
  toy.position.set(0, 1.85, 0); kid.add(toy);
  sc.scene.add(sleeper, pillow, kid);
  extra.push(sleeper, pillow, kid);
  const stopKid = addAnim((dt, t) => {
    const a = t * 1.6;
    kid.position.set(-1.6 + Math.cos(a) * 1.1, 0, 7.6 + Math.sin(a) * 0.7);
    kid.rotation.y = -a;
    kid.userData.arms?.forEach((arm) => { arm.rotation.x = -2.9; });
    kid.userData.legs?.forEach((l, k) => { l.rotation.x = Math.sin(t * 12 + k * Math.PI) * 0.6; });
    sleeper.position.y = 0.12 + Math.sin(t * 1.2) * 0.008;
  });
  await wait(2500);
  const [hub, other] = CONNECT[f.dest] || ['destino', 'otra ciudad'];
  const errors = await quiz('delay', [
    {
      q: '¿Qué le decís a la fila?', title: 'Demora: información',
      opts: [
        { t: `Informo la demora y la nueva hora estimada (${f.delayed}), y que estén atentos a las pantallas y anuncios`, ok: true },
        { t: 'No digo nada hasta que la hora esté confirmada', ok: false },
        { t: 'Les digo que "ya sale", así no se ponen nerviosos', ok: false },
      ],
      why: 'Ante una demora, información clara y temprana: qué pasa, la nueva hora estimada y cómo se van a ir enterando de los cambios. El silencio o una promesa falsa es lo que más enoja.',
    },
    {
      card: ['🍽', 'Asistencia por demora', `${h} horas de espera, sin pasar la noche`, ''], q: '¿Qué asistencia corresponde?', title: 'Demora: asistencia',
      opts: [
        { t: 'Comunicación y comidas o refrigerios acordes a la espera (vouchers)', ok: true },
        { t: 'Nada: es una demora, no una cancelación', ok: false },
        { t: 'Hotel y traslados para todos', ok: false },
      ],
      why: `Res. ANAC 1532/98: ante una demora, la compañía debe brindar sin cargo comunicación, comidas y refrigerios acordes a la espera y, si hay que pasar la noche, hotel y traslados. Con ${h} horas en el mismo día: comunicación y comidas o refrigerios.`,
    },
    {
      card: ['🔗', 'Pasajero en conexión', `Con la demora pierde su conexión en ${hub} a ${other}`, ''],
      say: `—${getPlayer().gender === 'M' ? 'Señor' : 'Señorita'}, yo en ${hub} tengo una conexión a ${other}. Con esta demora no llego ni loco...`,
      q: '¿Qué hacés?', title: 'Demora: conexión perdida',
      opts: [
        { t: `Lo protejo en una conexión posterior a ${other} y se lo informo antes de que viaje`, ok: true },
        { t: `Que lo resuelva cuando llegue a ${hub}`, ok: false },
        { t: 'Le sugiero que no viaje hoy', ok: false },
      ],
      why: 'Si la demora le hace perder una conexión, se lo protege en la conexión siguiente (o en una alternativa) desde el origen, y se le informa antes de viajar. Mandarlo "a resolverlo allá" es dejarlo varado.',
    },
  ]);
  E.after.push({ left: 4, done: () => { stopKid(); extra.forEach((o) => sc.scene.remove(o)); } });
  if (errors >= 2) {
    caption('🪧', '¡Se calienta la fila!', `Los pasajeros del ${f.no} se cansaron de esperar sin respuestas y arman un piquete frente a los mostradores.`);
    E.log.push({ ev: 'delay', title: 'Piquete por la demora', ok: false, pts: -10, answer: `${errors} respuestas mal o a destiempo`, why: 'Una demora mal informada se convierte en protesta.' });
    G.score -= 10;
    if (G.patience != null) G.patience = Math.max(0, G.patience - 30);
    const crowd = [];
    for (let i = 0; i < 7; i++) {
      const c = crowdPerson(true);
      c.position.set(4 + Math.random() * 5, 0, 10.5 + Math.random());
      sc.scene.add(c); crowd.push(c);
    }
    await Promise.all(crowd.map((c, i) => sc.walkTo(c, [[1.5 + (i % 3) * 0.6, 2.6 + Math.floor(i / 3) * 0.8]], 1.6)));
    crowd.forEach((c) => { c.rotation.y = 0.35; });
    startProtest(crowd, f);
  } else {
    caption('👍', 'Demora bien informada', `La fila resopla, pero entiende. Los del ${f.no} se van a pasar la espera con sus vouchers... menos el señor que ya se durmió en el piso.`);
  }
  sc.setQueueMood?.(0);
  await wait(5000);
}

// ------------------------------------------------------------------
// 4) UN FAMOSO EN EL HALL
// ------------------------------------------------------------------
const CELEBS = [
  { name: 'Brayan Lux', what: 'cantante de cumbia', sex: 'M', fans: ['¡BRAYAN TE AMO!', 'BRAYAN 💜', 'FIRMAME LA VALIJA'] },
  { name: 'el Tano Ferraro', what: 'goleador de la Selección', sex: 'M', fans: ['¡TANO, LA CAMISETA!', 'FERRARO 9', 'TANO SOS DIOS'] },
  { name: 'Mía Galván', what: 'influencer y actriz de tiras', sex: 'F', fans: ['MÍA TE AMO', '¡UNA SELFIE!', 'FAN #1 DE MÍA'] },
];
async function runCelebrity() {
  const f = pick(intlOpen());
  const c = pick(CELEBS);

  card('🌟', `¡${c.name} en el hall!`, 'Imprevisto', `Llega ${c.name} (${c.what}) a hacer el check-in del ${f.no} a ${f.city}, con anteojos oscuros y su representante. En treinta segundos se arma una ronda de fans con celulares.`);
  // El famoso, su representante y los fans
  const star = sc.makePerson({ ...randomFace(c.sex, 31, 'AR'), glasses: true, shirt: '#f4f4f4', pants: '#111' });
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24), new THREE.MeshStandardMaterial({ color: '#e5b93a', metalness: 0.9, roughness: 0.2 }));
  chain.rotation.x = Math.PI / 2 + 0.3; chain.position.y = 1.42; star.add(chain);
  const mgr = sc.makePerson({ ...randomFace('M', 50, 'AR'), shirt: '#222', pants: '#222' }, true);
  star.position.set(9, 0, 10.6); mgr.position.set(9.8, 0, 10.9);
  sc.scene.add(star, mgr);
  const SX = 1.5, SZ = 3.9;
  sc.walkTo(mgr, [[SX + 0.7, SZ - 0.5]], 1.2).then(() => faceTo(mgr, 0, 0.8));
  await sc.walkTo(star, [[SX, SZ]], 1.2);
  faceTo(star, 0, 0.8);
  const fans = [];
  for (let i = 0; i < 9; i++) {
    const fan = crowdPerson(false);
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.015), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveIntensity: 0 }));
    phone.position.set(0, -0.68, -0.03);
    fan.userData.arms?.[1]?.add(phone);
    fan.userData.phone = phone;
    fan.position.set(-6 + Math.random() * 14, 0, 9.5 + Math.random() * 2);
    sc.scene.add(fan); fans.push(fan);
    if (i < 3) { const s = banner(c.fans[i], 0.8, 0.32, ['#ffe9f6', '#b3127a']); s.position.y = 2.1; fan.add(s); }
    const a = (i / 9) * Math.PI * 2;
    const tx = SX + Math.cos(a) * 1.05, tz = SZ + 0.4 + Math.sin(a) * 0.95;
    setTimeout(() => sc.walkTo(fan, [[tx, tz]], 2 + Math.random()).then(() => { faceTo(fan, SX, SZ); fan.userData.ready = true; }), i * 150);
  }
  const stopFans = addAnim((dt, t) => {
    fans.forEach((fan, i) => {
      if (!fan.userData.ready) return;
      const arm = fan.userData.arms?.[1];
      if (arm) arm.rotation.x = -2.4 + Math.sin(t * 2 + i) * 0.15;
      fan.position.y = Math.abs(Math.sin(t * 4 + i)) * 0.04;
      fan.userData.phone.material.emissiveIntensity = Math.random() < 0.04 ? 3 : Math.max(0, fan.userData.phone.material.emissiveIntensity - dt * 12);
    });
  });
  talk(pick(['—¡¡¡AAAAH!!! ¡ES ÉL! ¡ES ÉL!', '—¡Una foto, una foto! ¡Mirá para acá!', '—Mamá, ¡no sabés a quién tengo adelante!']).replace('ÉL! ¡ES ÉL', c.sex === 'F' ? 'ELLA! ¡ES ELLA' : 'ÉL! ¡ES ÉL'), 4500);
  await wait(2500);
  const errors = await quiz('celebrity', [
    {
      say: `Representante: —${gtxt('Querido/a')}, ¿${c.sex === 'F' ? 'la' : 'lo'} atendés ya? Viaja en económica, pero entendé que es ${c.name}...`,
      q: `${c.name} viaja en clase económica, sin ninguna prioridad. ¿${c.sex === 'F' ? 'La' : 'Lo'} hacés pasar adelante?`, title: 'Famoso: la fila',
      opts: [
        { t: 'No: hace la fila como cualquier pasajero de su tarifa', ok: true },
        { t: `Sí: ${c.sex === 'F' ? 'la' : 'lo'} atiendo ya para que se termine el lío`, ok: false },
      ],
      why: 'La prioridad la dan la tarifa, la clase o una condición (PMR, cierre próximo), no la fama. Si el tumulto molesta, se pide apoyo para ordenar el sector, no se saltea la fila.',
    },
    {
      card: ['🛂', 'Sin pasaporte', `Ya en el mostrador, ${c.name} se saca los anteojos y sonríe`, ''],
      say: `—No traje el pasaporte, pero todo el mundo sabe quién soy. Googleame.`,
      q: `¿${c.sex === 'F' ? 'La' : 'Lo'} aceptás?`, title: 'Famoso: documento',
      opts: [
        { t: 'No: sin su documento de viaje válido no puede viajar, como cualquiera', ok: true },
        { t: `Sí: ${c.sex === 'F' ? 'la' : 'lo'} identifico con fotos de internet`, ok: false },
      ],
      why: `La identificación y el documento de viaje válido para ${f.city} se exigen a todos por igual. (Por suerte el representante tenía el pasaporte en su mochila...)`,
    },
    {
      card: ['📱', 'La fan número uno', 'Se acerca al mostrador una fan con los ojos llenos de lágrimas', ''],
      say: `—¡Por favor! ¿En qué asiento va? ¿A qué hora embarca? ¡Le quiero llevar un regalo al avión!`,
      q: '¿Qué le contestás?', title: 'Famoso: datos del pasajero',
      opts: [
        { t: 'Que no puedo darle datos de ningún pasajero: son confidenciales', ok: true },
        { t: 'Le digo el asiento, total es una fan', ok: false },
        { t: 'Le digo la puerta y la hora de embarque, pero no el asiento', ok: false },
      ],
      why: 'Los datos de los pasajeros (asiento, vuelo, horarios, si viajó o no) son confidenciales: no se dan a terceros, ni a fans, ni a periodistas.',
    },
  ]);
  caption(errors ? '📸' : '🌟', errors ? 'El video ya circula' : 'Todo en orden', errors
    ? `Un video del mostrador ya circula en redes: "En Aeroplata, si sos ${c.name}, las reglas son otras". Te toca un llamado de Atención al Cliente...`
    : `${c.name} te firma un autógrafo para tu sobrina y sigue hacia Migraciones. Los fans se van detrás, cantando.`);
  if (errors) E.log.push({ ev: 'celebrity', title: 'Repercusión en redes', ok: false, pts: 0, answer: `${errors} ${errors === 1 ? 'error' : 'errores'} con ${c.name}`, why: 'Con un pasajero conocido, todo lo que se hace en el mostrador termina en las redes.' });
  await wait(3500);
  stopFans();
  fans.forEach((fan) => { fan.userData.arms?.[1] && (fan.userData.arms[1].rotation.x = 0); });
  leave([star, mgr], 1);
  setTimeout(() => leave(fans, 1), 600);
  await wait(3500);
}

// ------------------------------------------------------------------
// 5) VIAJE DE EGRESADOS A BARILOCHE
// ------------------------------------------------------------------
const promoFlight = () => G.flights.find((f) => f.dest === 'BRC' && openNow(f, 15));
async function runPromo() {
  const f = promoFlight();
  const school = pick(['Colegio San Martín de Morón', 'Escuela Técnica N.º 4 de Lanús', 'Instituto Belgrano de Quilmes', 'Colegio Nacional de Ramos Mejía']);
  card('🎒', '¡Llegaron los egresados!', `Imprevisto · ${f.no} a Bariloche`, `Cuarenta chicos del ${school} con camperas iguales, una bandera y un parlante. Los acompaña un coordinador de la empresa de viajes con cara de no haber dormido.`);
  const kids = [];
  const hoodie = pick(['#7b2ff7', '#e8417a', '#14a37f', '#ff7a1a']);
  for (let i = 0; i < 12; i++) {
    const k = sc.makePerson({ ...randomFace(pick(['M', 'F']), 17, 'AR'), shirt: hoodie, pants: '#1c1f2a' }, i % 3 === 0, 0.9 + Math.random() * 0.06);
    k.position.set(3 + Math.random() * 7, 0, 10 + Math.random() * 2);
    sc.scene.add(k); kids.push(k);
  }
  const coord = sc.makePerson({ ...randomFace('M', 29, 'AR'), shirt: '#f2c200', pants: '#333' }, true);
  coord.position.set(6, 0, 11); sc.scene.add(coord);
  const flag = banner(`PROMO ${String(new Date().getFullYear()).slice(2)} · BARILOCHE 🏔`, 2.2, 0.5, ['#ffffff', hoodie]);
  flag.position.set(1.9, 2.05, 3.0); flag.visible = false; sc.scene.add(flag);
  sc.walkTo(coord, [[0.3, 1.7]], 1.4).then(() => faceTo(coord, 0.15, 0.2));
  await Promise.all(kids.map((k, i) => sc.walkTo(k, [[1.1 + (i % 4) * 0.52 + Math.random() * 0.15, 2.9 + Math.floor(i / 4) * 0.75]], 1.5 + Math.random() * 0.5)));
  kids.forEach((k) => faceTo(k, 0.5, 0.5));
  flag.visible = true;
  const stopJump = addAnim((dt, t) => {
    kids.forEach((k, i) => {
      k.position.y = Math.abs(Math.sin(t * 6 + (i % 2) * Math.PI)) * 0.13;
      k.userData.arms?.forEach((a, n) => { a.rotation.x = (i + n) % 2 ? -2.7 : Math.sin(t * 6) * 0.4; });
    });
    flag.position.y = 2.05 + Math.sin(t * 6) * 0.05;
  });
  talk('🎵 ¡Ba-ri-lo-che! ¡Ba-ri-lo-che! ¡Ba-ri-lo-cheeee! 🎵', 5000);
  await wait(2000);
  const errors = await quiz('promo', [
    {
      say: 'Coordinador: —Te traje la lista y las fotocopias de los DNI de los cuarenta, así es más rápido. ¿Me los despachás a todos juntos?',
      q: '¿Cómo hacés el check-in del grupo?', title: 'Egresados: documentación',
      opts: [
        { t: 'Cada chico presenta su documento original: los atiendo uno por uno, en orden', ok: true },
        { t: 'Con la lista y las fotocopias alcanza: los acepto a todos juntos', ok: false },
      ],
      why: 'En cabotaje cada pasajero presenta su documento vigente (original) en el counter y al embarcar, y el agente carga los datos de cada uno en el sistema. Una fotocopia no es un documento de viaje.',
    },
    {
      card: ['📝', 'Los permisos de los menores', 'Pasa una chica de 17 años, sola, con su DNI', ''],
      say: 'Coordinador: —Los permisos de los padres los tengo todos yo, en esta carpeta. ¿Hace falta que te los muestre?',
      q: '¿Qué hacés con la autorización de viaje de la menor?', title: 'Egresados: permisos',
      opts: [
        { t: 'Sí: el coordinador me muestra el permiso de ella cuando pasa, y lo verifico como el de cualquier menor', ok: true },
        { t: 'No hace falta: viaja con un grupo y un coordinador', ok: false },
        { t: 'Que llame a los padres y me autoricen por teléfono', ok: false },
      ],
      why: 'En un grupo de menores la regla es la misma que para cualquier menor. El coordinador suele llevar la documentación del grupo y muestra el permiso de cada chico cuando pasa por el mostrador; el agente lo verifica. Cada compañía lo organiza a su manera, pero siempre cumpliendo la normativa (en grupos, conviene preguntar el destino: muchas veces son vuelos especiales).',
    },
    {
      card: ['🪪', 'El que perdió el DNI', 'Siempre hay uno', ''],
      say: '—Profe... perdí el DNI en el micro. Pero ayer hice la denuncia en la comisaría, acá está.',
      q: '¿Puede viajar a Bariloche?', title: 'Egresados: denuncia policial',
      opts: [
        { t: 'Sí: en cabotaje, la denuncia policial por extravío sirve para viajar', ok: true },
        { t: 'No: sin el DNI no viaja', ok: false },
      ],
      why: 'Cabotaje, extravío o robo del documento: se acepta la licencia de conducir vigente, la denuncia policial o el certificado de DNI en trámite.',
    },
    {
      card: ['🎆', 'Revisión de la cartilla', 'Al preguntar por mercancías peligrosas, uno se pone colorado', ''],
      say: '—Eh... en la valija traje unas bengalas y unos fuegos artificiales. Para la fiesta del último día...',
      q: '¿Qué hacés con la pirotecnia?', title: 'Egresados: pirotecnia',
      opts: [
        { t: 'No puede viajar ni en bodega ni en cabina: se retira del equipaje', ok: true },
        { t: 'En la valija despachada puede ir', ok: false },
        { t: 'Que la lleve en el equipaje de mano', ok: false },
      ],
      why: 'Los fuegos artificiales y las bengalas son explosivos: están prohibidos para los pasajeros, tanto en el equipaje despachado como en el de mano.',
    },
  ]);
  stopJump();
  flag.visible = false;
  caption(errors ? '🎢' : '🏔', errors ? 'Egresados en problemas' : '¡A Bariloche!', errors
    ? 'El coordinador se lleva al grupo a la fila de PSA... donde los están esperando con algunas preguntas. Esto no termina acá.'
    : 'El grupo despacha en orden, sin bengalas y con el chico de la denuncia incluido. Se van cantando hacia Seguridad. El coordinador te mira como a un ángel.');
  if (errors) E.log.push({ ev: 'promo', title: 'Egresados', ok: false, pts: 0, answer: `${errors} ${errors === 1 ? 'error' : 'errores'} con el grupo`, why: 'Un grupo grande no es excusa para saltear controles: cada pasajero se atiende igual.' });
  talk('🎵 ¡Y ya lo ve, y ya lo ve, nos vamos a Bariloche y no volvemos más! 🎵', 4500);
  await wait(3000);
  sc.scene.remove(flag);
  leave([coord, ...kids], 1);
  await wait(3000);
}

// Resumen para el informe del turno
export function eventsSummaryHTML() {
  if (!E.log.length) return '';
  return `<div class="teamSum"><h3>⚠ Imprevistos del turno</h3><ul class="fb">${E.log.map((x) => `<li class="${x.ok === true ? 'ok' : x.ok === false ? 'bad' : 'info'}"><div><b>${esc(x.title)}</b><p>${esc(x.answer)}${x.ok === false && x.right ? ` · Correcto: ${esc(x.right)}` : ''}</p></div>${x.pts ? `<span class="pts">${x.pts > 0 ? '+' : ''}${x.pts}</span>` : ''}</li>`).join('')}</ul></div>`;
}
