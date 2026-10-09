// TRABAJO EN EQUIPO: compañeros en los mostradores 21 y 23 que atienden la misma fila única.
// Hoy son bots; cada mostrador es un "puesto" que recibe acciones (tomar pasajero, avanzar, decidir),
// así más adelante el mismo puesto puede manejarlo un compañero conectado en una sala.
import { ENTRY_RULES, COUNTRIES, NAMES, PREGNANCY, BAG_FEES, EXIT_RULES_AR, SEATMAP, STATION } from './data.js';
import { createPassenger, randomFace } from './generator.js';
import { faceSVG } from './docs.js';
import { playerFace } from './player.js';
import { esc, pick, rnd, chance, shuffle } from './util.js';

const $ = (s) => document.querySelector(s);
let G, scene;

// ------------------------------------------------------------------
// Compañeros (personalidades)
// ------------------------------------------------------------------
const CREW = {
  lucia: {
    name: 'Lucía', g: 'F', role: 'veterana', desc: '12 años en el counter. Rápida y prolija.', speed: [36, 50], acc: 0.95, consult: 0.1,
    face: { sex: 'F', age: 41, skin: 0, hairColor: '#5a3a22', hairStyle: 'long', glasses: true, beard: false, shape: 'oval', nose: 1, brows: 'thin', eye: 3, smile: true, shirt: '#123a63', pants: '#1c1f26' },
    idle: ['☕ Toma un sorbo de mate', '📋 Ordena los bag tags', '🖨️ Cambia el rollo de la impresora'],
  },
  martin: {
    name: 'Martín', g: 'M', role: 'veterano', desc: 'Conoce Timatic de memoria. Nunca se apura, nunca se equivoca.', speed: [38, 52], acc: 0.95, consult: 0.1,
    face: { sex: 'M', age: 46, skin: 2, hairColor: '#8d8d8d', hairStyle: 'short', glasses: false, beard: true, shape: 'round', nose: 2, brows: 'thick', eye: 1, smile: true, shirt: '#123a63', pants: '#1c1f26' },
    idle: ['📻 Escucha la radio de rampa', '📋 Ordena los bag tags', '🧮 Cuenta las tarjetas del día'],
  },
  tomas: {
    name: 'Tomás', g: 'M', role: 'nuevo', desc: 'Su segunda semana. Pone ganas, pero duda y pregunta mucho.', speed: [58, 80], acc: 0.55, consult: 0.5,
    face: { sex: 'M', age: 23, skin: 1, hairColor: '#2b1d14', hairStyle: 'curly', glasses: true, beard: false, shape: 'long', nose: 0, brows: 'thin', eye: 0, smile: false, shirt: '#123a63', pants: '#1c1f26' },
    idle: ['📘 Relee el manual', '😅 Respira hondo', '🖱️ Busca dónde estaba el botón de APIS'],
    flavor: ['📘 Busca algo en el manual...', '🤔 Duda frente a la pantalla', '🔁 Vuelve a revisar el documento'],
  },
  rocio: {
    name: 'Rocío', g: 'F', role: 'charlatana', desc: 'Atiende bien, pero charla con todos. Todos.', speed: [62, 85], acc: 0.8, consult: 0.35,
    face: { sex: 'F', age: 30, skin: 3, hairColor: '#1d1714', hairStyle: 'curly', glasses: false, beard: false, shape: 'round', nose: 1, brows: 'thick', eye: 2, smile: true, shirt: '#123a63', pants: '#1c1f26' },
    idle: ['💬 Le cuenta su fin de semana a Marta', '📱 Mira el pronóstico de Bariloche', '🎶 Tararea algo'],
    flavor: ['🗣️ Le recomienda una parrilla en el destino', '😂 Se ríe con el pasajero', '🗣️ Charla sobre el clima en {city}'],
  },
};
export const crewList = () => Object.values(CREW);

const NAT_ADJ = { AR: ['argentino', 'argentina'], BR: ['brasileño', 'brasileña'], UY: ['uruguayo', 'uruguaya'], CL: ['chileno', 'chilena'], ES: ['español', 'española'], US: ['estadounidense', 'estadounidense'] };
const adj = (nat, sex) => NAT_ADJ[nat][sex === 'F' ? 1 : 0];
const subj = (nat, sex = pick(['M', 'F'])) => ({ nat, sex, name: `${pick(NAMES[nat][sex])} ${pick(NAMES[nat].last)}`, un: sex === 'F' ? 'una pasajera' : 'un pasajero', lo: sex === 'F' ? 'la' : 'lo', el: sex === 'F' ? 'ella' : 'él', adj: adj(nat, sex) });

// ------------------------------------------------------------------
// Consultas entre compañeros (casos alineados con las reglas de data.js)
//   opts: { t, ok, dec }  · dec = qué termina haciendo el compañero si sigue ese consejo
//   bad[dec]: qué pasa si se equivoca (para "Qué pasó después")
// ------------------------------------------------------------------
const CONSULTS = [
  // Documento de identidad (Mercosur) o pasaporte
  (fl) => {
    const f = pick(fl.filter((x) => ['BR', 'CL'].includes(x.country)));
    if (!f) return null;
    const R = ENTRY_RULES[f.country];
    const s = subj(pick(R.idCardOk.filter((n) => n !== f.country && COUNTRIES[n].idName)));
    return {
      s, f, q: `Tengo a ${s.un} ${s.adj} que va a ${f.city} sólo con su ${COUNTRIES[s.nat].idName}, sin pasaporte. ¿${cap(s.lo)} acepto?`,
      opts: [{ t: 'Sí: con ese documento vigente puede viajar', ok: true, dec: 'accept' }, { t: 'No: tiene que presentar pasaporte', ok: false, dec: 'reject' }],
      why: R.notes[0],
      bad: { reject: `${s.name} se quedó sin viajar a ${f.city} porque le pidieron pasaporte... y no lo necesitaba. Reclamo formal y un "¡en el Mercosur viajo con el documento!".` },
    };
  },
  (fl) => {
    const f = pick(fl.filter((x) => ['US', 'ES'].includes(x.country)));
    if (!f) return null;
    const s = subj('AR');
    return {
      s, f, q: `${cap(s.un)} argentin${s.sex === 'F' ? 'a' : 'o'} a ${f.city} me da el DNI tarjeta. Dice que el pasaporte "lo tiene vencido, pero el DNI está nuevo". ¿${cap(s.lo)} acepto con el DNI?`,
      opts: [{ t: 'Sí: el DNI vigente alcanza', ok: false, dec: 'accept' }, { t: 'No: a ese destino se viaja con pasaporte vigente', ok: true, dec: 'reject' }],
      why: f.country === 'US' ? ENTRY_RULES.US.notes[0] : 'A España (Schengen) sólo los ciudadanos españoles viajan con DNI; el resto, con pasaporte vigente.',
      bad: { accept: `Migraciones Ezeiza frenó a ${s.name}: no se puede salir hacia ${f.city} con DNI. Hubo que bajarle la valija del ${f.no}.` },
    };
  },
  // Visa vigente en pasaporte vencido
  (fl) => {
    const f = pick(fl.filter((x) => x.country === 'US'));
    if (!f) return null;
    const s = subj(pick(['AR', 'BR', 'UY']));
    return {
      s, f, q: `${cap(s.un)} ${s.adj} a ${f.city}: la visa de EE.UU. vigente está en su pasaporte viejo, que está vencido. Trae los dos pasaportes y los datos coinciden. ¿Va?`,
      opts: [{ t: 'Sí: presenta los dos pasaportes y la visa sigue vigente', ok: true, dec: 'accept' }, { t: 'No: la visa no sirve si el pasaporte está vencido', ok: false, dec: 'reject' }],
      why: ENTRY_RULES.US.notes[2],
      bad: { reject: `${s.name} perdió el vuelo a ${f.city} con la visa vigente en la mano. Reclamo a la compañía y reprogramación a cargo de Aeroplata.` },
    };
  },
  // ESTA
  (fl) => {
    const f = pick(fl.filter((x) => x.country === 'US'));
    if (!f) return null;
    const s = subj(pick(['ES', 'CL']));
    return {
      s, f, q: `${cap(s.un)} ${s.adj} con pasaporte vigente a ${f.city}. Me dice que no necesita visa. ¿Lo dejo así?`,
      opts: [
        { t: 'Sí, no necesita nada más', ok: false, dec: 'accept' },
        { t: 'Visa no, pero sí ESTA aprobada: mirá la respuesta APIS/iAPI', ok: true, dec: 'accept' },
        { t: 'No: necesita visa B1/B2', ok: false, dec: 'reject' },
      ],
      why: ENTRY_RULES.US.notes[3],
      bad: { accept: `${s.name} no tenía ESTA: la respuesta iAPI decía DO NOT BOARD y nadie la miró. Lo frenaron antes de embarcar y hubo que bajar su valija.`, reject: `${s.name} es ${s.adj}: con ESTA aprobada no necesitaba visa. Perdió el vuelo y reclamó.` },
    };
  },
  // Validez Schengen
  (fl) => {
    const f = pick(fl.filter((x) => x.country === 'ES'));
    if (!f) return null;
    const s = subj(pick(['AR', 'BR', 'US']));
    const m = pick([1, 2, 5, 6]);
    const ok = m >= ENTRY_RULES.ES.validity.months;
    return {
      s, f, q: `${cap(s.un)} ${s.adj} a Madrid. El pasaporte vence ${m} ${m === 1 ? 'mes' : 'meses'} después de la fecha de regreso. ¿${cap(s.lo)} acepto?`,
      opts: [{ t: 'Sí, le alcanza la validez', ok, dec: 'accept' }, { t: `No: necesita ${ENTRY_RULES.ES.validity.months} meses de validez después de salir de Schengen`, ok: !ok, dec: 'reject' }],
      why: ENTRY_RULES.ES.notes[0],
      bad: { accept: `Migraciones Ezeiza no dejó salir a ${s.name}: el pasaporte no cubría los ${ENTRY_RULES.ES.validity.months} meses que pide Schengen. Valija bajada del ${f.no}.`, reject: `${s.name} tenía validez de sobra (${m} meses después del regreso) y se quedó en tierra. Reclamo y reprogramación.` },
    };
  },
  // Pasaje de regreso / residencia
  (fl) => {
    const f = pick(fl.filter((x) => ENTRY_RULES[x.country]?.returnTicket));
    if (!f) return null;
    const R = ENTRY_RULES[f.country];
    const s = subj('AR');
    const res = chance(0.5);
    return {
      s, f, q: res
        ? `${cap(s.un)} argentin${s.sex === 'F' ? 'a' : 'o'} a ${f.city} con boleto sólo de ida. Me muestra su ${R.residence}. ¿Va?`
        : `${cap(s.un)} argentin${s.sex === 'F' ? 'a' : 'o'} a ${f.city} con boleto sólo de ida. Dice que va de turista "a ver qué onda". ${f.country === 'US' ? 'Visa vigente tiene. ' : ''}¿Va?`,
      opts: [{ t: 'Sí, puede viajar así', ok: res, dec: 'accept' }, { t: 'No: un visitante necesita pasaje de regreso o de continuación', ok: !res, dec: 'reject' }],
      why: R.notes.find((n) => n.includes('NO residentes')),
      bad: { accept: `Migraciones de ${f.city} rechazó a ${s.name} (INAD): turista sin pasaje de regreso. Vuelve a cargo de Aeroplata, con multa.`, reject: `${s.name} es residente (tenía su ${R.residence}) y no le dejaron viajar. Reclamo formal.` },
      fine: !res,
    };
  },
  // Menor con un solo progenitor
  (fl) => {
    const f = pick(fl.filter((x) => x.country !== STATION.country));
    if (!f) return null;
    const auth = chance(0.5);
    const s = subj('AR', 'F');
    const kid = pick(['un nene', 'una nena']);
    return {
      s, f, q: `Una mamá con ${kid} de 11 años a ${f.city}. El papá no viaja ${auth ? 'y ella trae la autorización de viaje firmada ante escribano, vigente, para "todos los países"' : 'y no hay ninguna autorización: "está de acuerdo, me lo dijo por WhatsApp"'}. ¿Los acepto?`,
      opts: [{ t: 'Sí, pueden viajar', ok: auth, dec: 'accept' }, { t: 'No: falta la autorización del progenitor que no viaja', ok: !auth, dec: 'reject' }],
      why: EXIT_RULES_AR[0],
      bad: { accept: `Migraciones no dejó salir a la familia de ${s.name}: el menor no tenía autorización del papá. Volvieron a casa con un reclamo para Aeroplata.`, reject: `La autorización de la familia de ${s.name} estaba perfecta y se quedaron sin viajar. Reclamo y abogado en camino.` },
    };
  },
  // Gestante
  (fl) => {
    const f = pick(fl);
    const s = subj(pick(['AR', 'AR', 'BR', 'UY']), 'F');
    const k = pick(['early', 'nocert', 'cert']);
    const w = k === 'early' ? rnd(20, PREGNANCY.freeUntil) : rnd(PREGNANCY.freeUntil + 2, PREGNANCY.certUntil - 2);
    const ok = k !== 'nocert';
    return {
      s, f, q: `Una pasajera ${s.adj} a ${f.city}, embarazada de ${w} semanas, ${k === 'cert' ? `con certificado de su gineco-obstetra de hace ${rnd(2, PREGNANCY.certMaxDays - 1)} días` : 'sin ningún certificado médico'}. ¿La acepto?`,
      opts: [{ t: 'Sí, puede viajar', ok, dec: 'accept' }, { t: 'No, así no puede viajar', ok: !ok, dec: 'reject' }],
      why: `Hasta la semana ${PREGNANCY.freeUntil} viaja sin certificado. De la ${PREGNANCY.freeUntil + 1} a la ${PREGNANCY.certUntil}, con certificado médico de gineco-obstetra de no más de ${PREGNANCY.certMaxDays} días. Desde la ${PREGNANCY.certUntil + 1}, no viaja.`,
      bad: { accept: `La tripulación del ${f.no} detectó a ${s.name} (semana ${w}, sin certificado) y hubo que bajarla antes de cerrar puertas. Demora y reclamo.`, reject: `${s.name} (semana ${w}) cumplía todo y se quedó en tierra. Reclamo y un posteo furioso en redes.` },
    };
  },
  // Valija de más de 32 kg
  (fl) => {
    const f = pick(fl);
    const s = subj(pick(['AR', 'BR', 'US']));
    const kg = rnd(33, 36);
    return {
      s, f, q: `${cap(s.un)} a ${f.city} con una valija de ${kg} kg. Dice que paga lo que haya que pagar. ¿Le cobro el exceso y la despacho?`,
      opts: [{ t: 'Sí, cobrás el exceso y la despachás', ok: false, dec: 'accept' }, { t: `No: ninguna pieza puede superar los ${BAG_FEES.maxKg} kg; que reparta el peso`, ok: true, dec: 'accept' }],
      why: `Ninguna pieza despachada puede superar los ${BAG_FEES.maxKg} kg (salud de los maleteros): se reparte en otra pieza o se envía como carga.`,
      bad: { accept: `Rampa devolvió la valija de ${kg} kg de ${s.name}: "¿quién despachó esta heladera?". Un maletero terminó con la espalda resentida y hubo informe de seguridad.` },
    };
  },
  // Power bank en bodega
  (fl) => {
    const f = pick(fl);
    const s = subj(pick(['AR', 'ES', 'CL']));
    return {
      s, f, q: `${cap(s.un)} a ${f.city} me dice, cuando le muestro la cartilla, que tiene un power bank en la valija que despacha. ¿Qué hago?`,
      opts: [
        { t: 'Nada: si está apagado, viaja en bodega', ok: false, dec: 'accept' },
        { t: 'Que lo saque y lo lleve en el equipaje de mano', ok: true, dec: 'accept' },
        { t: 'No puede viajar con eso: no lo acepto', ok: false, dec: 'reject' },
      ],
      why: 'Power banks, baterías de litio de repuesto y cigarrillos electrónicos no pueden ir en bodega: viajan sólo en cabina.',
      bad: { accept: `Los rayos X de bodega detectaron un power bank en la valija de ${s.name}. Hubo que buscar la valija y abrirla con el pasajero: 15 minutos de demora del ${f.no}.`, reject: `${s.name} se quedó sin viajar por un power bank que podía ir en cabina. Reclamo, y con razón.` },
    };
  },
  // Cabotaje: licencia de conducir
  (fl) => {
    const f = pick(fl.filter((x) => x.country === STATION.country));
    if (!f) return null;
    const s = subj('AR');
    const vig = chance(0.6);
    return {
      s, f, q: `${cap(s.un)} a ${f.city} perdió el DNI. Me da la licencia de conducir, que está ${vig ? 'vigente' : 'vencida hace tres meses'}. ¿Va?`,
      opts: [{ t: 'Sí, puede viajar con eso', ok: vig, dec: 'accept' }, { t: 'No, así no puede viajar', ok: !vig, dec: 'reject' }],
      why: ENTRY_RULES.AR.notes[1],
      bad: { accept: `PSA frenó a ${s.name} en el control: la licencia estaba vencida. Hubo que bajarle la valija del ${f.no}.`, reject: `En cabotaje, la licencia de conducir vigente sirve si se perdió el DNI. ${s.name} se quedó en tierra sin motivo y reclamó.` },
    };
  },
  // Constancia de DNI en trámite a Brasil
  (fl) => {
    const f = pick(fl.filter((x) => x.country === 'BR'));
    if (!f) return null;
    const s = subj('AR');
    return {
      s, f, q: `${cap(s.un)} argentin${s.sex === 'F' ? 'a' : 'o'} a ${f.city} sólo tiene la constancia de DNI en trámite. "En cabotaje me dejaron viajar", dice. ¿Va?`,
      opts: [{ t: 'Sí, la constancia sirve', ok: false, dec: 'accept' }, { t: 'No: a Brasil se necesita el DNI tarjeta o el pasaporte', ok: true, dec: 'reject' }],
      why: ENTRY_RULES.BR.notes[0],
      bad: { accept: `Migraciones Ezeiza frenó a ${s.name}: con constancia de DNI en trámite no se sale a Brasil. Valija bajada del ${f.no}.` },
    };
  },
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------
// Estado
// ------------------------------------------------------------------
const T = { on: false, consults: false, waiting: 0, arriveIn: 0, desks: [], log: [], ask: null, lastAsk: -1e9, asks: 0, served: 0, phId: 0, look: null };

export function initTeam(g, sc) {
  G = g; scene = sc;
  $('#view3d').insertAdjacentHTML('beforeend', '<div id="team" class="team hidden"><div class="tmRow" id="tmRow"></div><div id="tmQuick" class="tmQuick hidden"></div><div id="tmAsk" class="tmAsk hidden"></div></div>');
}

export const teamOn = () => T.on;
export const teamWaiting = () => (T.on ? T.waiting : 0);
export const teamCrew = () => T.desks.map((d) => ({ no: d.no, ...d.p }));

// Empieza el turno: elige compañeros para el 21 (veterano/a) y el 23 (nuevo/a o charlatana)
//   online (opcional): { mySeat, players: [{ seat, name, gender }], bots: { seat: crewKey }, host, emit }
//   En una sala, los puestos de los compañeros conectados son "remote" (los mueve la red) y los
//   vacíos son bots: los corre el anfitrión y los demás los ven como "remote".
export function teamStart({ on = true, consults = true, online = null } = {}) {
  T.on = on; T.consults = consults; T.paused = false;
  T.log = []; T.ask = null; T.askBy = null; T.asks = 0; T.lastAsk = performance.now(); T.waiting = on ? 3 : 0; T.arriveIn = rnd(14, 24); T.served = 0;
  T.look = null;
  T.online = online; T.mySeat = online?.mySeat || 22; T.emit = online?.emit || null;
  scene.lookAtCounter?.(null);
  $('#view3d').classList.remove('peek');
  if (!on) { T.desks = []; $('#team').classList.add('hidden'); scene.numberCounters?.(22, 21, 23); return; }
  const me = (G.student || '').toLowerCase();
  const notMe = (keys) => keys.filter((k) => !me.startsWith(CREW[k].name.toLowerCase()));
  const desk = (no, slot, kind, key, p) => ({ no, slot, kind, key, p, state: 'rest', t: rnd(2, 5), count: 0, cur: null, status: '', steps: [], si: 0 });
  if (!online) {
    const a = pick(notMe(['lucia', 'martin'])) || 'martin', b = pick(notMe(['tomas', 'rocio'])) || 'tomas';
    T.desks = [desk(21, 21, 'bot', a, CREW[a]), desk(23, 23, 'bot', b, CREW[b])];
  } else {
    const others = [21, 22, 23].filter((n) => n !== online.mySeat);
    T.desks = others.map((no, i) => {
      const slot = i === 0 ? 21 : 23;
      const pl = online.players.find((x) => x.seat === no);
      if (pl) return desk(no, slot, 'remote', null, humanPersona(pl));
      const k = online.bots[no];
      return desk(no, slot, online.host ? 'bot' : 'remote', k, CREW[k]);
    });
  }
  scene.numberCounters?.(T.mySeat, T.desks[0].no, T.desks[1].no);
  // Mensajes rápidos (sólo en sala online)
  $('#tmQuick').classList.toggle('hidden', !online);
  $('#tmQuick').innerHTML = online ? `<span>📻</span>${QUICK.map((q, i) => `<button class="btn sm ghost" data-q="${i}">${esc(q)}</button>`).join('')}` : '';
  $('#tmQuick').querySelectorAll('button').forEach((b) => { b.onclick = () => sendQuick(QUICK[+b.dataset.q]); });
  T.desks.forEach((d) => { scene.setSideAgent?.(d.slot, d.p.face); setStatus(d, d.p.idle ? pick(d.p.idle) : '🟢 Conectado'); });
  $('#team').classList.remove('hidden');
  renderTeam();
}

// Elige bots para los mostradores vacíos de una sala (lo hace el anfitrión)
export function pickBots(seats, name = '') {
  const me = name.toLowerCase();
  const pool = shuffle(Object.keys(CREW).filter((k) => !me.startsWith(CREW[k].name.toLowerCase())));
  const out = {};
  seats.forEach((s, i) => { out[s] = pool[i]; });
  return out;
}

const humanPersona = (pl) => ({
  name: pl.name, g: pl.gender, role: 'compañero/a en línea', human: true,
  desc: `${pl.name} está conectado/a en la sala`, face: playerFace(pl.gender), speed: [40, 60],
});

// ------------------------------------------------------------------
// Sala online: eventos de los puestos
// ------------------------------------------------------------------
const deskOf = (seat) => T.desks.find((d) => d.no === seat);
const send = (d, ev, data = {}) => { if (T.emit && d.kind === 'bot') T.emit({ t: 'desk', seat: d.no, ev, ...data }); };

// Lo que hace el jugador en su propio mostrador, para que lo vean los demás
export function teamLocal(ev, data = {}) {
  if (T.on && T.emit) T.emit({ t: 'desk', seat: T.mySeat, ev, ...data });
}

// Evento recibido de la red para el puesto de un compañero (o de un bot del anfitrión)
export function teamRemote(m) {
  if (!T.on) return;
  const d = deskOf(m.seat);
  if (!d || d.kind !== 'remote') return;
  if (m.ev === 'status') setStatus(d, m.text);
  if (m.ev === 'call') {
    if (d.cur) scene.sideDismiss(d.slot, d.cur.q, 'other');
    const q = scene.takeFront();
    T.waiting = Math.max(0, T.waiting - 1);
    teamSyncQueue();
    d.cur = q ? { q, pax: { name: m.name, sex: m.sex } } : null;
    setStatus(d, `🚶 Llama a ${m.name}`);
    if (q) scene.sideServe(d.slot, q);
  }
  if (m.ev === 'bag' && d.cur) scene.sideBag(d.slot, d.cur.q);
  if (m.ev === 'done') {
    d.count++;
    if (m.dec === 'accept' && m.flight && G.ovbk?.flightNo !== m.flight) {
      if (m.seatNo) G.seatMaps[m.flight]?.add(m.seatNo);
      if (G.checkedCount[m.flight] != null) G.checkedCount[m.flight]++;
    }
    const a = m.sex === 'F' ? 'a' : 'o';
    setStatus(d, m.dec === 'accept' ? `✔ ${m.name} aceptad${a}${m.seatNo ? ` · ${m.seatNo}` : ''}` : `✖ ${m.name}: no aceptad${a}${m.problem ? ` (${m.problem})` : ''}`);
    if (d.cur) scene.sideDismiss(d.slot, d.cur.q, m.dec === 'accept' ? 'accept' : 'other');
    d.cur = null;
    renderTeam();
  }
  if (m.ev === 'end') {
    d.final = { score: m.score, ok: m.ok, total: m.total };
    setStatus(d, `🏁 Terminó su turno · ${m.ok}/${m.total} bien · ${m.score} pts`);
  }
  if (m.ev === 'chat') chat(d, m.text);
}

// Un compañero se desconectó: su mostrador lo toma un bot (lo corre el anfitrión)
export function teamBotify(seat, key) {
  const d = deskOf(seat);
  if (!d) return;
  if (d.cur) { scene.sideDismiss(d.slot, d.cur.q, 'other'); d.cur = null; }
  d.p = CREW[key]; d.key = key;
  d.kind = T.online?.host ? 'bot' : 'remote';
  d.state = 'rest'; d.t = rnd(3, 6);
  scene.setSideAgent?.(d.slot, d.p.face);
  setStatus(d, `🔌 Se desconectó: ahora atiende ${d.p.name}`);
  renderTeam();
}

// Se cayó la conexión con el anfitrión: los mostradores siguen con bots locales
export function teamOffline() {
  if (!T.on) return;
  T.emit = null;
  T.online = null;
  $('#tmQuick').classList.add('hidden');
  T.desks.forEach((d) => {
    if (d.kind !== 'remote') return;
    if (d.cur) { scene.sideDismiss(d.slot, d.cur.q, 'other'); d.cur = null; }
    const k = d.key || pick(Object.keys(CREW));
    d.p = CREW[k]; d.key = k; d.kind = 'bot'; d.state = 'rest'; d.t = rnd(3, 6);
    scene.setSideAgent?.(d.slot, d.p.face);
    setStatus(d, '🔌 Sin conexión: sigue un bot');
  });
  renderTeam();
}

// Mensajes rápidos entre compañeros (sin chat libre)
export const QUICK = ['👋 ¡Hola!', '🙏 ¡Gracias!', '🆘 ¿Me das una mano?', '⏳ Fila larga, ¡vamos!', '☕ Ya vuelvo', '😂', '👏 ¡Bien ahí!'];
function chat(d, text) {
  const el = document.querySelector(`.tm[data-no="${d.no}"]`);
  if (!el) return;
  el.querySelector('.bub')?.remove();
  el.insertAdjacentHTML('beforeend', `<span class="bub">${esc(text)}</span>`);
  setTimeout(() => el.querySelector('.bub')?.remove(), 5000);
  scene.setSideLabel?.(d.slot, `${d.p.name} · ${d.no}`, text);
  setTimeout(() => scene.setSideLabel?.(d.slot, `${d.p.name} · ${d.no}`, d.status), 5000);
}
export function sendQuick(text) {
  teamLocal('chat', { text });
  const me = document.querySelector('#tmRow .tm.me');
  if (me) { me.querySelector('.bub')?.remove(); me.insertAdjacentHTML('beforeend', `<span class="bub">${esc(text)}</span>`); setTimeout(() => me.querySelector('.bub')?.remove(), 4000); }
}

export function teamStop() {
  if (!T.on) return null;
  T.on = false;
  closeAsk(true);
  T.look = null; scene.lookAtCounter?.(null);
  $('#view3d').classList.remove('peek');
  $('#team').classList.add('hidden');
  return { type: 'team', desks: T.desks.map((d) => ({ no: d.no, name: d.p.name, role: d.p.role, human: !!d.p.human, count: d.count, final: d.final || null })), log: T.log.slice() };
}

// Fila única: completa las figuras de la fila (tus pasajeros + los que esperan a cualquier mostrador)
export function teamSyncQueue() {
  const mine = Math.max(0, G.pax.length - G.idx - 1);
  scene.fillQueue(mine + T.waiting, placeholder);
}
function placeholder() {
  const nat = pick(['AR', 'AR', 'AR', 'BR', 'UY', 'CL', 'ES', 'US']);
  const sex = pick(['M', 'F']);
  const age = rnd(19, 72);
  return { id: `ph${++T.phId}`, face: randomFace(sex, age, nat), isMinor: false };
}

const openFlights = () => G.flights.filter((f) => G.now >= f.openTime && (f.closeTime - G.now) / 60000 > 5);

// ------------------------------------------------------------------
// Bucle (cada 250 ms desde main.js, en segundos reales)
// ------------------------------------------------------------------
export function teamTick(dt) {
  if (!T.on || T.paused) return;
  // Llegan pasajeros a la fila única
  T.arriveIn -= dt;
  if (T.arriveIn <= 0) {
    T.arriveIn = rnd(16, 28);
    if (openFlights().length && T.waiting < 7) { T.waiting++; teamSyncQueue(); }
  }
  T.desks.forEach((d) => { if (d.kind === 'bot') deskTick(d, dt); });
  if (T.ask) tickAsk(dt);
}

function deskTick(d, dt) {
  // Si la ventana está minimizada las animaciones se frenan: el bot no espera la caminata para siempre
  if (d.state === 'walk' && (d.walkT = (d.walkT || 0) + dt) > 9 && d.cur) {
    const c = scene.side[d.slot];
    d.cur.q.fig.position.set(c.x + 0.15, 0, 0.85); d.cur.q.fig.rotation.y = 0;
    scene.walkers = scene.walkers.filter((w) => w.fig !== d.cur.q.fig);
    plan(d); d.state = 'serve'; d.t = 0;
  }
  if (d.state === 'walk' || d.state === 'ask') return;
  d.t -= dt;
  if (d.state === 'rest') {
    if (d.t > 0) return;
    if (T.waiting > 0 && scene.queue.length > 0 && openFlights().length) return take(d);
    d.t = rnd(4, 8);
    if (chance(0.3)) setStatus(d, pick(d.p.idle));
    else if (!d.status.startsWith('🟢')) setStatus(d, '🟢 Libre · llamando al siguiente');
    return;
  }
  if (d.state === 'serve' && d.t <= 0) {
    const st = d.steps[d.si++];
    if (!st) return done(d);
    d.t = st.dur;
    st.fn?.();
    if (st.text) setStatus(d, st.text);
  }
}

// El compañero llama al primero de la fila
function take(d) {
  const q = scene.takeFront();
  if (!q) return;
  T.waiting--;
  teamSyncQueue();
  const fl = openFlights();
  let consult = null;
  if (T.consults && !T.ask && !T.askBy && T.asks < 4 && performance.now() - T.lastAsk > 50000 && chance(d.p.consult)) {
    for (const mk of shuffle(CONSULTS.slice())) { consult = mk(fl); if (consult) break; }
    if (consult) T.askBy = d;
  }
  // Pasajero del compañero: datos verosímiles del turno (o el de la consulta)
  const base = createPassenger({ scenario: chance(0.1) ? 'expired' : 'ok', overlay: 'none' }, G.now, G.flights);
  const pax = consult
    ? { name: consult.s.name, first: consult.s.name.split(' ')[0], sex: consult.s.sex, flight: consult.f, problem: null }
    : { name: `${base.first} ${base.last}`, first: base.first, sex: base.sex, flight: base.flight, problem: base.scenario === 'expired' ? 'documento vencido' : base.scenario === 'late' ? 'check-in cerrado' : null };
  d.cur = { q, pax, consult, decision: null };
  d.state = 'walk'; d.walkT = 0;
  setStatus(d, `🚶 Llama a ${pax.name}`);
  send(d, 'call', { name: pax.name, sex: pax.sex });
  scene.sideServe(d.slot, q).then(() => { if (d.cur?.q !== q) return; plan(d); d.state = 'serve'; d.t = 0; });
}

// Pasos de la atención (lo que se ve en el cartel del mostrador)
function plan(d) {
  const { pax, consult } = d.cur;
  const S = rnd(...d.p.speed);
  const f = pax.flight;
  const step = (frac, text, fn) => ({ dur: S * frac, text, fn });
  const s = [step(0.14, `👋 Saluda a ${pax.first} y pide el documento`)];
  s.push(step(0.16, `🛂 Revisa el documento · ${f.no} ${f.city}`));
  if (consult) s.push({ dur: 0, text: '🙋 Hace una consulta al compañero', fn: () => openAsk(d) });
  if (pax.problem) {
    s.push(step(0.18, `⚠️ Detecta un problema: ${pax.problem}`));
    s.push({ dur: 0, fn: () => { d.cur.decision = 'reject'; } });
    d.steps = s; d.si = 0;
    return;
  }
  if (d.p.flavor && chance(0.7)) s.push(step(0.16, pick(d.p.flavor).replace('{city}', f.city)));
  s.push(step(0.12, '🔎 Busca la reserva y carga APIS'));
  s.push({ dur: 0, fn: () => { if (d.cur.consult && d.cur.decision === 'reject') { d.si = d.steps.length; } } });
  const kg = (16 + Math.random() * 7).toFixed(1);
  s.push(step(0.16, `⚖️ Pesa la valija · ${kg} kg`, () => { scene.sideBag(d.slot, d.cur.q); send(d, 'bag'); }));
  const seat = freeSeat(f);
  d.cur.seat = seat;
  s.push(step(0.12, `💺 Asigna el asiento ${seat || '—'}`));
  s.push(step(0.1, '🖨️ Imprime la tarjeta de embarque', () => { if (!d.cur.decision) d.cur.decision = 'accept'; }));
  d.steps = s; d.si = 0;
}

function freeSeat(f) {
  const occ = G.seatMaps[f.no];
  if (!occ) return null;
  for (let i = 0; i < 40; i++) {
    const r = rnd(SEATMAP.businessRows.at(-1) + 1, SEATMAP.economyRows[1] - 1);
    const c = pick(SEATMAP.economyCols);
    if (!occ.has(`${r}${c}`)) return `${r}${c}`;
  }
  return null;
}

function done(d) {
  const { q, pax, seat } = d.cur;
  const dec = d.cur.decision || 'accept';
  d.count++; T.served++;
  if (dec === 'accept') {
    // El vuelo es de todos: el asiento y el contador se ocupan para todo el equipo
    if (G.ovbk?.flightNo !== pax.flight.no) {
      if (seat) G.seatMaps[pax.flight.no]?.add(seat);
      if (G.checkedCount[pax.flight.no] != null) G.checkedCount[pax.flight.no]++;
    }
    setStatus(d, `✔ ${pax.name} aceptad${pax.sex === 'F' ? 'a' : 'o'}${seat ? ` · ${seat}` : ''}`);
  } else setStatus(d, `✖ ${pax.name}: no aceptad${pax.sex === 'F' ? 'a' : 'o'}${pax.problem ? ` (${pax.problem})` : ''}`);
  send(d, 'done', { dec, name: pax.name, sex: pax.sex, seatNo: dec === 'accept' ? seat : null, flight: pax.flight.no, problem: pax.problem });
  scene.sideDismiss(d.slot, q, dec);
  d.cur = null;
  d.state = 'rest';
  d.t = rnd(3, 6);
  renderTeam();
}

// ------------------------------------------------------------------
// Consultas
// ------------------------------------------------------------------
function openAsk(d) {
  const c = d.cur.consult;
  d.state = 'ask';
  T.asks++;
  const limit = G.mode === 'challenge' ? 35 : 70;
  T.ask = { d, c, left: limit, limit, opts: shuffle(c.opts.slice()) };
  const card = $('#tmAsk');
  card.className = 'tmAsk';
  card.innerHTML = `
    <div class="tmAskHead">${faceSVG(d.p.face, { w: 34, h: 42, bg: '#dce7f0' })}<div><b>${esc(d.p.name)} · mostrador ${d.no}</b><small>${d.p.g === 'F' ? 'Tu compañera' : 'Tu compañero'} te pide una mano</small></div><button class="btn sm ghost" id="tmLook" title="Mirar su mostrador">👁</button></div>
    <p>"${esc(c.q)}"</p>
    <div class="tmOpts">${T.ask.opts.map((o, i) => `<button class="btn sm" data-i="${i}">${esc(o.t)}</button>`).join('')}</div>
    <div class="tmBar"><i id="tmBar"></i></div>`;
  card.querySelectorAll('.tmOpts button').forEach((b) => { b.onclick = () => answer(T.ask.opts[+b.dataset.i]); });
  $('#tmLook').onclick = () => toggleLook(d.no);
  renderTeam();
}

function tickAsk(dt) {
  if (G.paused || document.querySelector('#modal:not(.hidden)')) return;
  T.ask.left -= dt;
  const bar = $('#tmBar');
  if (bar) bar.style.width = `${Math.max(0, (T.ask.left / T.ask.limit) * 100)}%`;
  if (T.ask.left <= 0) {
    // Nadie le contestó: resuelve solo/a, con su nivel de acierto
    const { d, c } = T.ask;
    const good = c.opts.find((o) => o.ok);
    const o = chance(d.p.acc) ? good : pick(c.opts.filter((x) => !x.ok)) || good;
    resolve(o, 'alone');
  }
}

function answer(o) { if (T.ask) resolve(o, 'you'); }

function resolve(o, by) {
  const { d, c } = T.ask;
  const good = c.opts.find((x) => x.ok);
  const pts = by === 'you' ? (o.ok ? 10 : -10) : 0;
  G.score += pts;
  const bad = !o.ok ? (c.bad[o.dec] || c.bad.accept || c.bad.reject) : null;
  T.log.push({ type: 'consult', by, ok: o.ok, bot: d.p.name, no: d.no, name: c.s.name, flight: c.f.no, q: c.q, answer: o.t, right: good.t, why: c.why, bad, fine: !o.ok && o.dec === 'accept' && c.fine, pts });
  if (G.queueLog) G.queueLog.push({ type: 'pts', n: pts, why: 'Consulta de un compañero' });
  if (d.cur) d.cur.decision = o.dec;
  const card = $('#tmAsk');
  const head = by === 'you'
    ? (o.ok ? `<b class="ok">✔ Buen consejo</b> <span class="pts">+10</span>` : `<b class="bad">✖ Mal consejo</b> <span class="pts">−10</span>`)
    : (o.ok ? `<b>⏱ No le contestaste: ${esc(d.p.name)} lo resolvió bien</b>` : `<b class="bad">⏱ No le contestaste y ${esc(d.p.name)} se equivocó</b>`);
  card.innerHTML = `<div class="tmAskHead">${faceSVG(d.p.face, { w: 34, h: 42, bg: '#dce7f0' })}<div>${head}<small>${esc(by === 'you' ? (o.ok ? pick(['¡Gracias! Me salvaste.', '¡Genial, gracias!', 'Te debo un café ☕']) : 'Le hizo caso a tu consejo...') : `Respuesta: ${o.t}`)}</small></div></div>
    <p class="why">${o.ok ? '' : `Correcto: <b>${esc(good.t)}</b>. `}${esc(c.why)}</p>
    <div class="row end"><button class="btn sm ghost" id="tmClose">Cerrar</button></div>`;
  $('#tmClose').onclick = () => closeAsk();
  clearTimeout(T.closeT);
  T.closeT = setTimeout(() => closeAsk(), 14000);
  T.ask = null; T.askBy = null;
  T.lastAsk = performance.now();
  d.state = 'serve'; d.t = 1.5;
  setStatus(d, o.dec === 'reject' ? '💬 Le explica al pasajero que no puede viajar' : '💬 Sigue con la atención');
  if (o.dec === 'reject') d.si = d.steps.length;
}

function closeAsk(force) {
  if (force) { T.ask = null; T.askBy = null; }
  clearTimeout(T.closeT);
  $('#tmAsk')?.classList.add('hidden');
}

// ------------------------------------------------------------------
// Panel del equipo
// ------------------------------------------------------------------
function setStatus(d, text) {
  d.status = text;
  send(d, 'status', { text });
  scene.setSideLabel?.(d.slot, `${d.p.name} · ${d.no}`, text);
  const el = document.querySelector(`.tm[data-no="${d.no}"] small`);
  if (el) el.textContent = text; else renderTeam();
}

function toggleLook(no) {
  T.look = T.look === no ? null : no;
  scene.lookAtCounter?.(T.look ? T.desks.find((x) => x.no === T.look)?.slot : null);
  $('#view3d').classList.toggle('peek', !!T.look);
  renderTeam();
}

function renderTeam() {
  if (!T.on) return;
  const card = (d) => `<div class="tm ${T.look === d.no ? 'on' : ''} ${T.ask?.d === d ? 'asking' : ''}" data-no="${d.no}" title="${esc(d.p.desc)} · Tocá para mirar su mostrador">
    ${faceSVG(d.p.face, { w: 28, h: 35, bg: '#dce7f0' })}<div><b>${esc(d.p.name)} <em>${d.no}</em></b><small>${esc(d.status)}</small></div><span class="cnt" title="Pasajeros atendidos">${d.count}</span></div>`;
  // Mismo orden que en pantalla: el mostrador de la izquierda es el que está en x positiva (slot 23)
  const a = T.desks.find((d) => d.slot === 23), b = T.desks.find((d) => d.slot === 21);
  $('#tmRow').innerHTML = `${card(a)}<div class="tm me ${T.look ? 'back' : ''}" title="${T.look ? 'Volver a tu mostrador' : 'Tu mostrador'}">${faceSVG(playerFace(),{ w: 28, h: 35, bg: '#dce7f0' })}<div><b>Vos <em>${T.mySeat || 22}</em></b><small>${T.look ? '↩ Volver a tu mostrador' : `${Math.max(0, G.idx)} atendidos`}</small></div></div>${card(b)}`;
  document.querySelectorAll('#tmRow .tm[data-no]').forEach((el) => { el.onclick = () => toggleLook(+el.dataset.no); });
  document.querySelector('#tmRow .tm.me').onclick = () => { if (T.look) toggleLook(T.look); };
}

// Resumen para el informe del turno
export function teamSummaryHTML(sum) {
  if (!sum) return '';
  const c = sum.log.filter((x) => x.type === 'consult');
  const you = c.filter((x) => x.by === 'you');
  return `<div class="teamSum"><h3>👥 Equipo de mostradores</h3>
    <p>${sum.desks.map((d) => `<b>${esc(d.name)}</b> (mostrador ${d.no}, ${d.human ? 'en línea' : d.role}): ${d.count} pasajeros${d.final ? ` · ${d.final.ok}/${d.final.total} bien, ${d.final.score} pts` : d.human ? ' · sigue atendiendo' : ''}`).join(' · ')}</p>
    ${c.length ? `<p>Consultas de tus compañeros: ${c.length} · respondiste ${you.length}, ${you.filter((x) => x.ok).length} bien.</p>
    <ul class="fb">${c.map((x) => `<li class="${x.ok ? 'ok' : 'bad'}"><div><b>${esc(x.bot)}: "${esc(x.q)}"</b><p>${x.by === 'you' ? 'Tu respuesta' : 'Resolvió solo/a'}: ${esc(x.answer)}${x.ok ? '' : ` · Correcto: ${esc(x.right)}`}</p></div>${x.pts ? `<span class="pts">${x.pts > 0 ? '+' : ''}${x.pts}</span>` : ''}</li>`).join('')}</ul>` : ''}
  </div>`;
}

// Imprevistos: el equipo se detiene (evacuación) y después retoma donde estaba
export function teamPause(on) {
  T.paused = on;
  if (on && T.look) { T.look = null; scene.lookAtCounter?.(null); $('#view3d').classList.remove('peek'); renderTeam(); }
}
export const teamFigs = () => (T.on ? T.desks.filter((d) => d.cur).map((d) => d.cur.q.fig) : []);
export function teamAfterEvac() {
  if (!T.on) return;
  T.desks.forEach((d) => {
    if (!d.cur) return;
    const c = scene.side[d.slot];
    d.cur.q.fig.position.set(c.x + 0.15, 0, 0.85);
    d.cur.q.fig.rotation.y = 0;
    if (d.state === 'walk') { plan(d); d.state = 'serve'; d.t = 0; }
  });
}
