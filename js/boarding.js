// Módulo de EMBARQUE (Guía U4 · Parte II): apertura de puerta, anuncios, embarque por zonas,
// control documental, búsqueda de equipaje (−15), des-chequeo y cierre del vuelo.
// En el Modo Historia, los pasajeros que el agente aceptó en el check-in vuelven a aparecer en la puerta.
import { GateScene } from './gate3d.js';
import { FLIGHTS, AIRLINE, STATION, ENTRY_RULES, EXIT_ROW, SEATMAP, COUNTRIES, exitControl, EXIT_CONTROL_REASON } from './data.js';
import { makePerson, makePassport, makeVisaUS, differentFace, makeEscort } from './generator.js';
import { isIdDoc } from './rules.js';
import { faceSVG, renderDoc, docTitle } from './docs.js';
import { esc, fmtTime, fmtDate, timeToday, dayOnly, norm, pick, rnd, chance, shuffle, addDays } from './util.js';
import { gateLines as gateDialog, gateGreeting, AGENT_EN, paxLang } from './dialogues.js';
import { OVBK_POLICY, compForm, gradeComp, compSummary, protectionsFor } from './overbooking.js';
import { conflictTrigger, runConflict } from './conflict.js';

const $ = (s) => document.querySelector(s);
// Ritmo del reloj según el modo:
//  Aprendizaje: el tiempo avanza con cada acción y solo corre solo cuando no hay nadie en el podio.
//  Desafío: el reloj corre en tiempo real todo el tiempo (también mientras se atiende).
const PACES = {
  learn: { drift: 4, pax: 0.5, zone: 2, task: 2, ann: 1, alwaysRun: false },
  challenge: { drift: 12, pax: 0, zone: 1, task: 1, ann: 0.5, alwaysRun: true },
};
let PACE = PACES.learn;
const ZONES = { 1: 'Prioritario · PMR · INF · mayores de 60', 2: 'Business y filas 4 a 12', 3: 'Filas 13 a 22', 4: 'Filas 23 a 30' };
const REGULAR = { 1: 14, 2: 46, 3: 58, 4: 52 };

const DENY = {
  DOC: 'Documentación / condiciones para volar',
  DATE: 'Tarjeta de otra fecha (no show): no embarca → Ventas',
  RETURN: 'Sin pasaje de regreso o continuación (visitante no residente)',
  IDENT: 'Identificación positiva fallida (la persona no coincide con el documento)',
  DISCREP: 'Discrepancia de tarjeta sin solución (no se puede reimprimir o no hay tiempo): queda abajo',
  ALCOHOL: 'Pasajero bajo efectos del alcohol',
  INSUB: 'Pasajero insubordinado (CAT 2 / CAT 3)',
};

// Zona en la que aparece cada tipo de pasajero y nivel mínimo en práctica libre
const KINDS = {
  wchr: { zone: 1 }, inf_stroller: { zone: 1 }, senior_zone4: { zone: 1, lv: 2 }, early: { zone: 1 }, influencer: { zone: 1 },
  ok: { zone: 2 }, wrong_flight: { zone: 2 }, vaper: { zone: 2 },
  exit_minor: { zone: 3 }, name_mismatch: { zone: 3, lv: 2 }, no_return: { zone: 3, ret: true, lv: 2 }, pet_exit: { zone: 3, lv: 3 }, dead_phone: { zone: 3, lv: 2 },
  drunk: { zone: 4 }, impostor: { zone: 4, lv: 2 }, dutyfree: { zone: 4 }, dup_bp: { zone: 4, lv: 2 }, web_yesterday: { zone: 2, lv: 2 }, gate_carryon: { zone: 4 }, gate_smoker: { zone: 3, lv: 2 }, gate_rage: { zone: 3, lv: 3 }, depa: { zone: 1, lv: 2 }, inop_seat: { zone: 3, lv: 3 },
};
const PRACTICE_CASES = ['inop_seat', 'wchr', 'inf_stroller', 'senior_zone4', 'early', 'influencer', 'ok', 'wrong_flight', 'vaper', 'exit_minor', 'name_mismatch', 'no_return', 'pet_exit', 'dead_phone', 'drunk', 'impostor', 'dutyfree', 'dup_bp', 'web_yesterday', 'gate_carryon', 'gate_smoker', 'gate_rage', 'depa', 'ok'];
export const KIND_LABEL = {
  wchr: 'Pasajero PMR (WCHR)', inf_stroller: 'Pasajera con infante y cochecito', senior_zone4: 'Mayor de 60 con zona 4', early: 'Se adelanta a su zona',
  influencer: 'Influencer que quiere pasar primero', ok: 'Pasajero sin novedades', wrong_flight: 'Tarjeta de otro vuelo', vaper: 'Vapeando en la fila',
  exit_minor: 'Menor de 15 en salida de emergencia', name_mismatch: 'Tarjetas cruzadas con su acompañante', partner: 'Tarjetas cruzadas (acompañante)',
  dup_bp: 'Tarjeta duplicada (misma que su acompañante)', dead_phone: 'Celular sin batería (sin tarjeta)', no_return: 'Solo ida sin pasaje de regreso', web_yesterday: 'Tarjeta del vuelo de ayer (no show)', gate_carryon: 'Se niega al Gate Dispatch (CAT 1)', gate_smoker: 'Fuma en el embarque y no desiste (CAT 2)', gate_rage: 'Arroja objetos por su asiento (CAT 3)', depa: 'Detenido con escoltas (DEPA)', carry_ret: 'Chequeado sin pasaje de regreso',
  pet_exit: 'Mascota en cabina en salida de emergencia', drunk: 'Pasajero alcoholizado', impostor: 'Foto no coincide', dutyfree: 'Cargado de free shop',
  standby: 'Voluntario en stand-by (embarque manual)', late_runner: 'Pasajero demorado (llamado por nombre)', no_seat: 'Pasajero sin asiento (sobreventa)', gate_volunteer: 'Voluntario en la puerta', inop_seat: 'Chequeado en asiento inoperativo', sleeper: 'Dormido en la sala', carry: 'Pasajero que chequeaste vos', carry_doc: 'Chequeado sin cumplir requisitos',
};
const ANN = {
  pre: (F) => `Buenas noches, ${AIRLINE.name} informa a los pasajeros del vuelo ${F.no}, con destino a la ciudad de ${F.city}, que su embarque comenzará en breves minutos.`,
  boarding: (F) => `Buenas noches, ${AIRLINE.name} les da la bienvenida a los pasajeros del vuelo ${F.no} con destino a ${F.city}. El embarque se realizará por la puerta ${F.gate}, de acuerdo con la zona de su tarjeta. Comenzamos con Zona 1: atenciones especiales y embarque prioritario. Mantengan visible su tarjeta de embarque y su identificación. ¡Muchas gracias!`,
  zone: (F, z) => `Invitamos a embarcar a los pasajeros del vuelo ${F.no} con Zona ${z}.`,
  final: (F) => `Su atención por favor: llamado final de embarque a pasajeros del vuelo ${F.no} con destino a ${F.city}. Les pedimos embarcar de inmediato por la puerta ${F.gate}.`,
  name: (F, n) => `Pasajero ${n}, le solicitamos embarcar de forma inmediata por la puerta ${F.gate}; de lo contrario su equipaje será removido por razones de seguridad.`,
};

let B, scene, ui, FLIGHT, OTHER_FLIGHT, onEvent;

// ------------------------------------------------------------------
export function startBoarding(opts) {
  ui = opts.ui;
  onEvent = opts.onEvent || (() => {});
  PACE = PACES[opts.mode] || PACES.learn;
  FLIGHT = FLIGHTS.find((f) => f.no === (opts.flightNo || 'AP1100'));
  OTHER_FLIGHT = FLIGHTS.find((f) => f.dest !== FLIGHT.dest && f.gate !== FLIGHT.gate && f.no !== FLIGHT.no);
  opts.oldScene?.dispose();
  if (scene) scene.dispose();
  scene = new GateScene($("#view3d"));
  usedSeats.clear();
  const today = dayOnly(new Date());
  const dep = timeToday(today, FLIGHT.dep);
  const lvl = { basico: 1, intermedio: 2, avanzado: 3 }[opts.level] || 1;
  const at = (min) => new Date(dep.getTime() + min * 60000);
  B = {
    student: opts.student, level: opts.level, lvl, today, dep, at, onDone: opts.onDone,
    now: at(-60), flight: { ...FLIGHT, depTime: dep },
    setup: { system: false, materials: null, layout: false, pmr: null },
    crewReadyAt: at(-44), crewAnnounced: false, asepsis: lvl >= 2,
    ann: { pre: null, boarding: null, final: null }, zoneAnnDone: false,
    zone: 0, boarded: 0, queue: [], waiting: [], cur: null, act: null,
    results: [], proc: [], score: 0, radio: [], tab: 'setup',
    pending: [], searched: new Set(), searchedAt: {}, dechecked: new Set(), called: new Set(), closed: false, closeTime: null,
    events: {}, paused: false, seq: 40, mode: opts.mode || 'learn', held: [],
  };
  const retRule = !!ENTRY_RULES[FLIGHT.country].returnTicket;

  // Pasajeros individuales por zona
  B.byZone = { 1: [], 2: [], 3: [], 4: [] };
  B.depa = [];
  const kinds = (opts.cases || PRACTICE_CASES.filter((k) => (KINDS[k].lv || 1) <= lvl))
    .filter((k) => !KINDS[k].ret || retRule);
  kinds.forEach((k) => {
    if (k === 'depa') { B.depa.push(makeGatePax('depa', { zone: 1 })); return; }
    if (k !== 'name_mismatch') { B.byZone[KINDS[k].zone].push(makeGatePax(k, { zone: KINDS[k].zone })); return; }
    // Pareja que se cruzó las tarjetas: uno se presenta en zona 3 y el otro en zona 4
    const row = rnd(16, 21);
    const a = makeGatePax('name_mismatch', { seat: `${row}D` });
    const b = makeGatePax('partner', { seat: `${row}E`, last: a.last, first: pick(a.sex === 'M' ? ['Laura', 'Silvia', 'Carolina'] : ['Martín', 'Diego', 'Ricardo']), sex: a.sex === 'M' ? 'F' : 'M', nat: a.nationality });
    a.partner = b; b.partner = a;
    a.bp = { ...b.ownBp }; b.bp = { ...a.ownBp };
    a.docs[0] = { ...a.bp, id: a.docs[0].id }; b.docs[0] = { ...b.bp, id: b.docs[0].id };
    B.byZone[3].push(a); B.byZone[4].unshift(b);
  });

  // Pasajeros que vienen del check-in (Modo Historia)
  B.noShows = [];
  const carry = (opts.carry || []).map(fromCheckin);
  if (carry.length) {
    // Uno de los que despacharon valija no aparece: se quedó dormido o se fue al free shop
    const cand = carry.filter((p) => p.kind === 'carry' && p.bags > 0);
    if (cand.length) {
      const ns = pick(cand);
      carry.splice(carry.indexOf(ns), 1);
      ns.kind = chance(0.5) ? 'sleeper' : 'late_runner';
      ns.lines.greet = gateGreeting(ns, ns.kind);
      B.noShows.push({ last: ns.last, first: ns.first, bags: ns.bags, seat: ns.bp.seat, pax: ns, sleeper: ns.kind === 'sleeper' });
    }
    carry.forEach((p) => {
      if (p.kind === 'depa') { B.depa.push(p); return; }
      const priority = p.age >= 60 || p.bp.ssr === 'WCHR';
      const z = priority ? 1 : p.bp.zone;
      B.byZone[z].push(p);
    });
    Object.values(B.byZone).forEach((list) => shuffleInPlace(list));
  }
  B.noShows.push({ last: 'González', first: 'Juan', bags: 0, seat: '19C' });
  if (!carry.length) {
    B.noShows.push({ last: 'Cabrera', first: 'María', bags: 2, seat: '24A' });
    const runner = makeGatePax('late_runner', { last: 'Pérez', first: 'Pablo', seat: '26F' });
    runner.bags = 1;
    runner.lines.greet = gateGreeting(runner, 'late_runner');
    B.noShows.push({ last: 'Pérez', first: 'Pablo', bags: 1, seat: '26F', pax: runner });
  }
  // Voluntarios del counter en stand-by: embarcan solo si se liberan asientos por no show
  B.standby = (opts.standby || []).map((c) => {
    const p = fromCheckin({ pax: c.pax, seat: 'STBY', bags: 0, blockers: [] });
    p.kind = 'standby';
    p.lines = gateLines(p);
    return { pax: p, form: c.form, status: 'waiting' };
  });
  if (!opts.standby && lvl >= 2 && !opts.cases) {
    // Práctica libre: un voluntario de ejemplo en stand-by
    const p = makeGatePax('standby', { seat: 'STBY' });
    const prot = protectionsFor(FLIGHT)[0];
    B.standby.push({ pax: p, form: { ssr: 'VDBC', prot, amount: prot.sameDay ? OVBK_POLICY.comp.intl.same : OVBK_POLICY.comp.intl.next, type: 'voucher', meal: false, hotel: false, transport: false, phone: true, standby: true }, status: 'waiting' });
  }

  // Sobreventa en el embarque: pasajeros sin asiento (no seat)
  const noSeat = opts.ovbk ? opts.ovbk.noSeat : (lvl >= 3 && !opts.cases ? 1 : 0);
  B.ovbk = noSeat ? { noSeat: Array.from({ length: noSeat }, () => makeGatePax('no_seat')), offer: OVBK_POLICY.comp.intl.same, authorized: null, searches: 0, poolBase: 1, poolRaised: 1, freed: 0, used: 0, volunteers: 0, called: false } : null;
  // Chequeados con problemas documentales: el control de salida (Migraciones / PSA) los frena antes de la puerta
  B.stopped = (opts.stopped || []).map((c, i) => ({ ...c, at: at(-rnd(50, 36) + i * 3), informed: false }));
  const individuals = Object.values(B.byZone).flat().filter((p) => p.kind !== 'wrong_flight').length + noSeat + B.depa.reduce((t, p) => t + (p.party?.seatHolders || 1), 0);
  B.checked = Object.values(REGULAR).reduce((a, b) => a + b, 0) + individuals + B.noShows.length + B.stopped.length;

  buildUI();
  radio(`Despacho: aeronave en posición en la puerta ${FLIGHT.gate}, tripulación a bordo preparando la cabina.`);
  if (B.standby.length) radio(`Counter: ${B.standby.length} voluntario(s) VDBC en stand-by para este vuelo. Embarque manual solo si se liberan asientos por no show.`);
  if (B.ovbk) radio(`Sistema: ${B.ovbk.noSeat.length} pasajero(s) chequeado(s) SIN ASIENTO (no seat) por un problema de sistema. Vuelo completo.`);
  if (B.asepsis) B.events.asepsis = at(-47);
  tick();
  B.lastReal = performance.now();
  B.timer = setInterval(drift, 250);
  onEvent('start', B);
}

function shuffleInPlace(a) { const s = shuffle(a); a.length = 0; a.push(...s); }

// ------------------------------------------------------------------
// Pasajeros de puerta
// ------------------------------------------------------------------
const usedSeats = new Set();
function seatFor(zone) {
  const rows = { 1: [4, 12], 2: [4, 12], 3: [16, 22], 4: [23, 30] }[zone];
  let seat;
  do { seat = `${rnd(rows[0], rows[1])}${pick(['A', 'B', 'C', 'D', 'E', 'F'])}`; } while (usedSeats.has(seat) || SEATMAP.exitRows.includes(parseInt(seat, 10)));
  usedSeats.add(seat);
  return seat;
}
export function zoneOfSeat(seat) {
  const r = parseInt(seat, 10);
  return r <= 12 ? 2 : r <= 22 ? 3 : 4;
}
function makeBp(p, flight, seat, zone, cls = 'Y', ssr = null) {
  const dep = timeToday(dayOnly(new Date()), flight.dep);
  return {
    type: 'BOARDING_PASS', last: p.last, first: p.first, title: p.sex === 'M' ? 'MR' : 'MRS', dest: flight.dest, flightNo: flight.no,
    date: dayOnly(new Date()), boarding: fmtTime(new Date(dep.getTime() - 45 * 60000)), gate: flight.gate, seat, zone, cls, seq: 0, ssr,
  };
}
function addVisaIfNeeded(p, passport, docs) {
  const vt = ENTRY_RULES[FLIGHT.country].visa[p.nationality];
  if (vt === 'VISA_US') docs.push(makeVisaUS(p, passport, dayOnly(new Date())));
}

function makeGatePax(kind, extra = {}) {
  const today = dayOnly(new Date());
  let nat = pick(FLIGHT.country === 'US' ? ['AR', 'AR', 'US', 'US', 'ES', 'BR', 'BR'] : ['AR', 'AR', 'BR', 'BR', 'BR', 'UY', 'CL']);
  let minAge = 22, maxAge = 58, sex = null;
  let seat = null, zone = null, ssr = null, accessory = null, bags = rnd(0, 2), cls = 'Y';
  switch (kind) {
    case 'wchr': minAge = 72; maxAge = 86; seat = `${rnd(4, 9)}C`; zone = 1; ssr = 'WCHR'; break;
    case 'inf_stroller': minAge = 26; maxAge = 38; sex = 'F'; seat = `${rnd(5, 10)}D`; zone = 1; ssr = 'INF'; accessory = 'stroller'; break;
    case 'senior_zone4': minAge = 66; maxAge = 79; seat = seatFor(4); zone = 4; break;
    case 'early': seat = seatFor(3); zone = 3; break;
    case 'influencer': minAge = 21; maxAge = 29; seat = seatFor(4); zone = 4; break;
    case 'wrong_flight': seat = `${rnd(4, 12)}A`; zone = 2; break;
    case 'exit_minor': nat = 'AR'; minAge = 13; maxAge = 14; seat = `${SEATMAP.exitRows[0]}C`; zone = 3; break;
    case 'pet_exit': seat = `${SEATMAP.exitRows[1]}A`; zone = 3; ssr = 'PETC'; accessory = 'pet'; break;
    case 'no_return': nat = pick(['AR', 'AR', 'BR', 'UY']); bags = 0; break;
    case 'web_yesterday': seat = seatFor(2); zone = 2; bags = 0; break;
    case 'drunk': nat = 'AR'; minAge = 24; maxAge = 45; bags = 1; break;
    case 'gate_carryon': nat = 'AR'; sex = 'F'; minAge = 28; maxAge = 55; accessory = 'bigbag'; seat = seatFor(4); zone = 4; break;
    case 'depa': nat = 'AR'; sex = chance(0.25) ? 'F' : 'M'; minAge = 24; maxAge = 50; seat = '30A'; zone = 1; bags = 0; break;
    case 'gate_smoker': case 'gate_rage': nat = 'AR'; sex = 'M'; minAge = 30; maxAge = 62; break;
    case 'dutyfree': accessory = 'bigbag'; break;
    case 'late_runner': nat = 'AR'; sex = 'M'; break;
    case 'inop_seat': seat = '20A'; zone = 3; break;
    case 'no_seat': seat = 'STBY'; zone = 4; bags = rnd(1, 2); break;
    case 'standby': seat = 'STBY'; zone = 4; bags = 0; break;
  }
  if (extra.sex) sex = extra.sex;
  if (extra.nat) nat = extra.nat;
  if (kind === 'ok' && extra.zone === 2 && chance(0.5)) { seat = `${rnd(1, 3)}${pick(['A', 'C', 'D', 'F'])}`; cls = 'J'; }
  const p = makePerson(nat, today, minAge, maxAge, sex);
  if (extra.last) { p.last = extra.last; p.first = extra.first; }
  if (!seat) seat = extra.seat || seatFor(extra.zone || pick([2, 3, 4]));
  if (!zone) zone = zoneOfSeat(seat);
  if (kind === 'gate_volunteer') bags = rnd(0, 1);
  if (accessory) p.face.accessory = accessory;
  if (kind === 'drunk') p.face.flushed = true;
  const passport = makePassport(p, today);
  const docs = [passport];
  addVisaIfNeeded(p, passport, docs);
  if (kind === 'impostor') { const fake = differentFace(p.face, nat); fake.age -= 3; docs.forEach((d) => { if (d.face) d.face = fake; }); }
  const bp = makeBp(p, kind === 'wrong_flight' ? OTHER_FLIGHT : FLIGHT, seat, zone, cls, ssr);
  const ownBp = { ...bp };
  let companion = null;
  if (kind === 'dup_bp') {
    // Imprimieron dos veces la tarjeta del acompañante, que ya embarcó
    companion = { first: pick(p.sex === 'M' ? ['Laura', 'Silvia', 'Carolina'] : ['Martín', 'Diego', 'Ricardo']), last: p.last, seq: rnd(150, 190), seat: `${parseInt(seat, 10)}${seat.slice(-1) === 'A' ? 'B' : 'A'}` };
    Object.assign(bp, { first: companion.first, title: p.sex === 'M' ? 'MRS' : 'MR', seat: companion.seat });
  }
  if (kind === 'web_yesterday') { bp.date = addDays(today, -1); ownBp.date = bp.date; }
  const WEB_ALWAYS = ['wrong_flight', 'no_return', 'web_yesterday', 'inop_seat', 'dup_bp', 'dead_phone'];
  const WEB_NEVER = ['standby', 'no_seat', 'gate_volunteer', 'late_runner', 'wchr', 'pet_exit'];
  const web = WEB_ALWAYS.includes(kind) || (!WEB_NEVER.includes(kind) && chance(0.45));
  if (web) { bp.web = true; ownBp.web = true; bags = 0; }
  let party = null, legal = null;
  if (kind === 'depa') {
    const escorts = [p.sex === 'F' ? 'F' : 'M', 'M'].map((sx, i) => makeEscort(sx, 'POLICÍA FEDERAL ARGENTINA', today, FLIGHT, `e${i + 1}`));
    escorts.forEach((e) => { delete e.docs; });
    party = { relation: 'custody', members: escorts, seatHolders: 3 };
    legal = { type: 'DEPA', cuffed: chance(0.5) };
  }
  const noBp = kind === 'dead_phone';
  const pax = { id: Math.random().toString(36).slice(2, 8), kind, ...p, docs: noBp ? docs : [bp, ...docs], bp, ownBp, companion, bags, accessory, drunk: kind === 'drunk', noBp, web, ...(party ? { party, legal } : {}), retDate: kind === 'no_return' ? null : addDays(today, rnd(7, 25)) };
  pax.docs.forEach((d, i) => { d.id = `${pax.id}-${i}`; });
  pax.lines = gateLines(pax);
  return pax;
}

// Convierte un pasajero aceptado en el check-in en pasajero de puerta
function fromCheckin(c) {
  const src = c.pax;
  const codes = c.blockers || [];
  let kind = 'carry';
  if (src.legal?.type === 'DEPA') kind = 'depa';
  else if (codes.includes('ALCOHOL')) kind = 'drunk';
  else if (codes.includes('IDENTITY')) kind = 'impostor';
  else if (codes.includes('PREGNANCY')) kind = 'carry_doc';
  else if (codes.includes('RETURN')) kind = 'carry_ret';
  const seat = c.seat || seatFor(pick([2, 3, 4]));
  usedSeats.add(seat);
  const ssr = src.booking.ssr.find((s) => ['WCHR', 'PETC', 'UMNR'].includes(s)) || null;
  const bp = makeBp({ ...src, last: src.booking.last, first: src.booking.first }, FLIGHT, seat, zoneOfSeat(seat), src.booking.cabin, ssr);
  bp.title = src.booking.title;
  const docs = src.docs.filter((d) => (isIdDoc(d) || d.type.startsWith('VISA') || d.type === 'EVISA_BR' || d.type === 'AUTH_MINOR' || d.type === 'MED_CERT' || d.type === 'RESIDENCE'));
  const face = { ...src.face };
  if (src.pet && c.petAccepted) face.accessory = 'pet';
  if (face.accessory === 'stroller' && !c.strollerGate) delete face.accessory;
  const pax = {
    ...src, id: `${src.id}g`, kind, face, docs: [bp, ...docs], bp, ownBp: { ...bp }, bags: c.bags, accessory: face.accessory, drunk: kind === 'drunk',
    fromCheckin: true, checkinIssue: kind !== 'carry' ? codes : null, needsGD: !!c.strollerGate,
  };
  pax.lines = gateLines(pax);
  pax.lines.greet = gateGreeting(pax, kind === 'drunk' ? 'drunk' : 'carry');
  return pax;
}

function gateLines(p) {
  return gateDialog(p, { city: FLIGHT.city, otherCity: OTHER_FLIGHT.city, country: FLIGHT.country });
}

// La reimpresión requiere sistema conectado y tiempo: hasta el minuto −10
export function canReprint() {
  return B.setup.system && !B.closed && B.now < B.at(-10);
}

// Qué corresponde con cada pasajero en el momento en que se presenta
function expected(p) {
  if (p.kind === 'wrong_flight') return { kind: 'redirect' };
  if (p.kind === 'depa') return { kind: 'board' };
  if (p.kind === 'gate_volunteer') return { kind: 'volunteer' };
  if (p.kind === 'standby') return { kind: 'board' };
  if (p.kind === 'no_seat') return B.ovbk.freed - B.ovbk.used > 0 || B.act?.reseated ? { kind: 'board', reseat: true } : { kind: 'dnbd' };
  if (p.kind === 'carry_doc') return { kind: 'deny', reason: 'DOC' };
  if (p.kind === 'no_return' || p.kind === 'carry_ret') return { kind: 'deny', reason: 'RETURN' };
  if (p.kind === 'web_yesterday') return { kind: 'deny', reason: 'DATE' };
  if (p.kind === 'impostor') return { kind: 'deny', reason: 'IDENT', notify: true };
  if (p.kind === 'drunk') return { kind: 'deny', reason: 'ALCOHOL', notify: true };
  if (p.kind === 'gate_smoker' || p.kind === 'gate_rage') return { kind: 'deny', reason: 'INSUB', notify: true };
  if (p.kind === 'name_mismatch' || p.kind === 'partner') {
    if (!p.returned) return { kind: 'hold' };
    if (p.resolved) return { kind: 'board' };
    return canReprint() || B.act?.reprinted ? { kind: 'board', reprint: true } : { kind: 'deny', reason: 'DISCREP' };
  }
  if (p.kind === 'dup_bp' || p.kind === 'dead_phone') return canReprint() || B.act?.reprinted ? { kind: 'board', reprint: true } : { kind: 'deny', reason: 'DISCREP' };
  const priority = p.age >= 60 || ['WCHR', 'INF'].includes(p.bp.ssr);
  if (!priority && p.bp.zone > B.zone) return { kind: 'wait' };
  return {
    kind: 'board',
    gateDispatch: p.kind === 'inf_stroller' || p.kind === 'gate_carryon' || p.needsGD || (p.kind === 'dutyfree' && B.binsFull),
    reseat: p.kind === 'exit_minor' || p.kind === 'pet_exit' || p.kind === 'inop_seat',
    vape: p.kind === 'vaper',
  };
}

// ------------------------------------------------------------------
// Interfaz
// ------------------------------------------------------------------
function buildUI() {
  const stats = document.querySelectorAll('#topbar .stat span');
  stats[2].textContent = 'Embarcados';
  stats[3].textContent = 'En fila';
  $('.brand span').textContent = `Embarque · Puerta ${FLIGHT.gate} · ${B.mode === 'challenge' ? '⏱ Desafío' : '📘 Aprendizaje'}`;
  $('#dcs').innerHTML = `
    <div class="dcsHead"><span>SISTEMA DE EMBARQUE · ${AIRLINE.code}</span><span>${FLIGHT.no} ${STATION.code}-${FLIGHT.dest} · STD ${FLIGHT.dep} · PTA ${FLIGHT.gate}</span></div>
    <div class="timeline" id="gTimeline"></div>
    <nav class="tabs" id="gTabs">
      <button data-tab="setup" class="on">1 · Apertura</button>
      <button data-tab="board">2 · Embarque</button>
      <button data-tab="pend">3 · Pendientes y cierre</button>
      <button data-tab="radio">4 · Radio</button>
    </nav>
    <div class="pane" id="gPane"></div>
    <div class="sysmsg" id="gSys">&gt; SISTEMA DE EMBARQUE</div>
    <div class="decide">
      <button class="btn ok" id="gBoard" disabled>✔ Embarcar</button>
      <button class="btn" id="gWait" disabled>⏸ Esperar zona</button>
      <button class="btn" id="gHold" disabled>⚠ Apartar</button>
      <button class="btn bad" id="gDeny" disabled>✖ No embarcar</button>
      <button class="btn warn" id="gRedirect" disabled>↪ Otra puerta</button>
    </div>`;
  $('#gTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    B.tab = b.dataset.tab; renderTabs(); renderPane();
  });
  $('#gBoard').onclick = () => decide({ kind: 'board' });
  $('#gWait').onclick = () => decide({ kind: 'wait' });
  $('#gHold').onclick = () => decide({ kind: 'hold' });
  $('#gRedirect').onclick = () => decide({ kind: 'redirect' });
  $('#gDeny').onclick = denyPicker;
  $('#docs').innerHTML = '<div class="empty">Pida la tarjeta de embarque y el documento.</div>';
  $('#dialog').classList.add('hidden');
  if (!$('#toast')) document.body.insertAdjacentHTML('beforeend', '<div id="toast" class="toast hidden"></div>');
  if (!$('#annBanner')) $('#view3d').insertAdjacentHTML('beforeend', '<div id="annBanner" class="annBanner hidden"></div>');
  $('#btnPause').onclick = () => {
    B.paused = true;
    ui.openModal('<div class="pause"><h1>⏸ Pausa</h1><p>El reloj está detenido.</p><button class="btn ok big" id="resume">Continuar</button></div>');
    $('#resume').onclick = () => { ui.closeModal(); B.paused = false; };
  };
  $('#btnManual').onclick = showGateManual;
  renderTabs(); renderPane(); updateTop();
}

function renderTabs() { $('#gTabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === B.tab)); }
function renderPane() {
  ({ setup: paneSetup, board: paneBoard, pend: panePend, radio: paneRadio })[B.tab]($('#gPane'));
  renderTimeline();
}
function sys(msg, kind = '') { const el = $('#gSys'); el.className = `sysmsg ${kind}`; el.textContent = `> ${msg}`; }
function toast(ok, text) {
  const t = $('#toast');
  t.className = `toast ${ok ? 'ok' : 'bad'}`;
  t.innerHTML = text;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 6500);
}
function radio(msg) {
  B.radio.unshift({ t: fmtTime(B.now), msg });
  sys(`📻 ${msg}`, 'warn');
  if (B.tab === 'radio') renderPane();
}
function announceBanner(text) {
  const el = $('#annBanner');
  el.innerHTML = `<b>📢</b> ${esc(text)}`;
  el.classList.remove('hidden');
  clearTimeout(announceBanner.t);
  announceBanner.t = setTimeout(() => el.classList.add('hidden'), 7000);
}
function updateTop() {
  $('#tClock').textContent = fmtTime(B.now);
  $('#tPax').textContent = `${B.boarded}/${B.checked}`;
  $('#tQueue').textContent = B.queue.length + (B.cur ? 1 : 0);
  $('#tScore').textContent = B.score;
  $('#tAgent').textContent = B.student;
}
function status() {
  if (B.closed) return 'CERRADO';
  if (B.ann.final) return 'ÚLTIMO LLAMADO';
  if (B.zone) return `EMBARQUE ZONA ${B.zone}`;
  if (B.ann.pre) return 'PREEMBARQUE';
  return 'EN HORARIO';
}

// Línea de tiempo del embarque: muestra la fase actual
function phaseIndex() {
  if (B.closed) return 9;
  if (B.ann.final) return B.now >= B.at(-15) ? 8 : 7;
  if (B.zone) return 2 + B.zone;
  if (B.ann.boarding || B.ann.pre) return 1;
  return 0;
}
function renderTimeline() {
  const steps = ['Apertura', 'Preembarque', '', 'Zona 1', 'Zona 2', 'Zona 3', 'Zona 4', 'Llamado final', '−15 · Equipajes', 'Cierre'];
  const cur = phaseIndex();
  $('#gTimeline').innerHTML = steps.map((t, i) => (t ? `<span class="${i < cur ? 'done' : i === cur ? 'now' : ''}">${t}</span>` : '')).join('');
}

// Reloj: avanza solo y con cada acción
function advance(min) { B.now = new Date(B.now.getTime() + min * 60000); tick(); }
function drift() {
  const t = performance.now();
  const dt = (t - B.lastReal) / 1000; B.lastReal = t;
  if (B.closed || B.paused || ui.modalOpen()) return;
  if (!PACE.alwaysRun && (B.cur || B.queue.length)) return;
  const before = B.now.getMinutes();
  B.now = new Date(B.now.getTime() + (dt * 60000) / PACE.drift);
  if (B.now.getMinutes() !== before) tick();
}
function informStopped(x) {
  x.informed = true;
  const p = x.pax, ctl = exitControl(FLIGHT);
  const who = p.party ? `la familia ${p.last.toUpperCase()} (${p.party.seatHolders} pasajeros)` : `${p.first.toUpperCase()} ${p.last.toUpperCase()}`;
  const why = EXIT_CONTROL_REASON[x.codes.find((c) => EXIT_CONTROL_REASON[c])] || 'documentación';
  radio(`${ctl}: ${who}, asiento ${x.seat}, no fue autorizado a salir del país (${why}). No embarca: retirarlo del vuelo${x.bags ? ` y bajar su equipaje (${x.bags} pza)` : ''}.`);
  toast(false, esc(`📻 ${ctl} frenó a ${who} en el control. Revisá la pestaña Pendientes.`));
  B.pending.push({ last: p.last, first: p.first, bags: x.bags, seat: x.seat, denied: true, stopped: ctl });
}
function tick() {
  B.stopped.forEach((x) => { if (!x.informed && B.now >= x.at) informStopped(x); });
  if (B.events.asepsis && B.now >= B.events.asepsis) {
    delete B.events.asepsis;
    B.crewReadyAt = new Date(B.crewReadyAt.getTime() + 5 * 60000);
    radio(pick([
      'TCP: demora por aseo de cabina. Alguien dejó un yogur abierto en el 23C. Aguarden autorización.',
      'TCP: demora por aseo de cabina, encontramos papas fritas hasta en el baño. Aguarden autorización.',
    ]));
  }
  if (!B.crewAnnounced && B.now >= B.crewReadyAt) {
    B.crewAnnounced = true;
    radio('TCP: cabina lista. Autorizado el inicio del embarque.');
    onEvent('crew', B);
  }
  if (!B.events.m15 && B.now >= B.at(-15)) {
    B.events.m15 = true;
    radio('Recordatorio: minuto −15. Activar búsqueda de equipaje de pasajeros no presentados.');
    onEvent('m15', B);
  }
  scene.updateGate(B.flight, B.now, status(), B.zone && !B.ann.final ? B.zone : 0);
  updateTop();
  if (B.tab === 'pend' || B.tab === 'board') renderPane(); else renderTimeline();
}

// --- 1. Apertura ---------------------------------------------------
function paneSetup(pane) {
  const s = B.setup;
  const item = (done, id, label, help) => `<div class="task ${done ? 'done' : ''}"><div><b>${done ? '✔' : '○'} ${label}</b><small>${help}</small></div>${done ? '' : `<button class="btn sm" id="${id}">Hacer</button>`}</div>`;
  pane.innerHTML = `
    <h3>Apertura de puerta · Agente 1 (minuto −60)</h3>
    ${item(s.system, 'tSys', 'Conectar el sistema y las pantallas de la puerta', 'Sin sistema no se puede escanear ni reimprimir.')}
    ${item(s.materials !== null, 'tMat', 'Verificar materiales de embarque', 'Qué llevar a la sala.')}
    ${item(s.layout, 'tLay', 'Armar el layout de zonas (tensabarrier)', 'Para que los pasajeros se ubiquen por zona.')}
    ${item(s.pmr !== null, 'tPmr', 'Revisar requerimientos especiales (PMR)', 'Quiénes embarcan primero.')}
    <p class="hint">Después: esperar la autorización de la tripulación por radio y pasar a la pestaña 2.</p>
    <div class="kv"><span>Aeronave</span><b>${FLIGHT.aircraft}</b><span>Chequeados</span><b>${B.checked}</b><span>Embarque</span><b>Puente (zona inmóvil: 30 pax)</b></div>`;
  const on = (id, fn) => { const el = $(`#${id}`); if (el) el.onclick = fn; };
  on('tSys', () => { s.system = true; advance(PACE.task); sys('SISTEMA CONECTADO · DISPLAY DE PUERTA ACTUALIZADO', 'ok'); renderPane(); });
  on('tLay', () => { s.layout = true; scene.showStanchions(); advance(PACE.task); sys('LAYOUT DE ZONAS ARMADO · TENSABARRIERS POR ZONA', 'ok'); renderPane(); });
  on('tMat', materialsQuiz);
  on('tPmr', pmrQuiz);
}

function checklistModal(title, hint, items, onOk) {
  ui.openModal(`<h2>${title}</h2><p class="hint">${hint}</p>
    <div class="checks">${items.map(([t], i) => `<label><input type="checkbox" value="${i}"> ${esc(t)}</label>`).join('')}</div>
    <div class="row end"><button class="btn ok" id="mOk">Confirmar</button></div>`);
  $('#mOk').onclick = () => {
    const sel = new Set([...document.querySelectorAll('#modalBox input:checked')].map((i) => +i.value));
    const wrong = items.filter(([, ok], i) => ok !== sel.has(i)).length;
    ui.closeModal();
    onOk(wrong);
    advance(PACE.task); renderPane();
  };
}
function materialsQuiz() {
  const items = shuffle([
    ['POSNet / boletas', true], ['Formulario NOTOC', true], ['Etiquetas Gate Dispatch', true], ['Formularios de embarque manual ("bingo")', true],
    ['Boarding pass manual', true], ['Radio', true], ['Chaleco reflectante', true], ['Tapones auditivos', true], ['Carpeta de anuncios', true],
    ['Sello de Migraciones', false], ['Balanza portátil', false], ['Mate y termo', false],
  ]);
  checklistModal('🎒 Mochila de embarque', 'Marcá lo que tiene que ir a la sala.', items, (wrong) => {
    B.setup.materials = wrong;
    procItem(wrong === 0, 'Materiales de embarque', wrong ? `${wrong} elemento(s) mal elegidos. Van: POSNet, NOTOC, etiquetas Gate Dispatch, formularios de embarque manual, BP manual, radio, chaleco, tapones y carpeta de anuncios. (El mate, en el break.)` : 'Mochila completa.', wrong ? -3 * wrong : 5);
  });
}
function pmrQuiz() {
  const items = shuffle([
    ['Movilidad reducida (PMR)', true], ['Pasajeros con infantes (INF)', true], ['Mayores de 60 años', true], ['Priority boarding', true],
    ['Salida de emergencia', false], ['Pasajeros con conexión', false], ['Influencers', false],
  ]);
  checklistModal('♿ ¿Quién embarca en Zona 1?', 'En el sistema figuran 1 WCHR y 1 INF.', items, (wrong) => {
    B.setup.pmr = wrong === 0;
    procItem(wrong === 0, 'Zona 1: requerimientos especiales', 'Zona 1: priority boarding, PMR, infantes y mayores de 60.', wrong === 0 ? 10 : -10);
  });
}

// --- 2. Embarque ---------------------------------------------------
function nextAnnouncement() {
  if (!B.ann.pre) return 'pre';
  if (!B.ann.boarding) return 'boarding';
  if (B.zone < 4) return `z${B.zone + 1}`;
  if (!B.ann.final && !B.cur && !B.queue.length) return 'final';
  return null;
}
function paneBoard(pane) {
  const a = B.act, p = B.cur;
  const sug = B.mode === 'learn' && B.crewAnnounced ? nextAnnouncement() : null;
  const mic = (id, label, disabled) => `<button class="btn mic ${sug === id ? 'suggest' : ''}" data-ann="${id}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  const o = B.ovbk;
  const ovbkDone = o && o.called && !o.noSeat.length && B.cur?.kind !== 'no_seat' && !B.queue.some((x) => x.kind === 'no_seat');
  const ovbkBox = ovbkDone ? `<p class="okline">✔ Sobreventa resuelta · voluntarios: ${o.volunteers}</p>` : o ? `<div class="ovbkBox">
      <b>⚠ Sobreventa en el embarque</b> · Sin asiento: <b>${o.noSeat.length}</b> · Voluntarios: <b>${o.volunteers}</b> · Asientos liberados: <b>${o.freed - o.used}</b> · Oferta: <b>USD ${o.offer}</b>${o.authorized ? ' (autorizada por el gerente)' : ''}
      <div class="row gap wrap" style="margin-top:6px">
        <button class="btn" id="oSearch">📢 Buscar voluntarios</button>
        <button class="btn" id="oRaise" ${o.authorized || !o.searches ? 'disabled' : ''}>📞 Pedir aumento al gerente</button>
        <button class="btn warn" id="oNoSeat" ${o.called ? 'disabled' : ''}>🎫 Atender pasajeros sin asiento</button>
      </div>
      <small>Guía U4: con pasajeros sin asiento, se buscan voluntarios ANTES de empezar a embarcar. Si no alcanza, el gerente de aeropuertos puede autorizar un aumento.</small></div>` : '';
  pane.innerHTML = `
    ${ovbkBox}
    <h3>📢 Micrófono</h3>`;
  pane.innerHTML += `
    <div class="row gap wrap">
      ${mic('pre', 'Preembarque', B.ann.pre)}
      ${mic('boarding', 'Embarque', B.ann.boarding)}
      ${[1, 2, 3, 4].map((z) => mic(`z${z}`, `Zona ${z}`, B.zone >= z || B.ann.final)).join('')}
      ${mic('final', 'Llamado final', B.ann.final || B.zone < 4)}
      <button class="btn ghost" id="aWait">⏩ +1 min</button>
    </div>
    <p class="hint">${[1, 2, 3, 4].map((z) => `Z${z}: ${ZONES[z]}`).join(' · ')}</p>
    <h3>Podio</h3>
    ${!p ? `<div class="blank small">${B.queue.length ? 'Llamando al siguiente...' : B.held.length && B.zone === 4 ? 'Quedan pasajeros apartados.' : 'Nadie en el podio.'}</div>` : `
      <div class="row gap wrap">
        <button class="btn" id="bScan" ${a.scanned ? 'disabled' : ''}>⎙ Escanear (BGR)</button>
        <button class="btn" id="bDocs" ${a.docsChecked ? 'disabled' : ''}>🛂 Verificar documentos</button>
        ${p.kind === 'depa' ? `<button class="btn warn" id="bCuffs" ${a.cuffChecked ? 'disabled' : ''}>🔗 Verificar esposas</button>` : ''}
        <button class="btn" id="bGD" ${a.gateDispatch ? 'disabled' : ''}>🏷 Gate Dispatch</button>
        <button class="btn" id="bSeat" ${a.reseated || !a.scanned ? 'disabled' : ''}>💺 Reasignar asiento</button>
        ${B.ovbk ? '<button class="btn ok" id="bVol">🙋 Voluntario (VDBC)</button><button class="btn bad" id="bDnbd">⛔ DNBD</button>' : ''}
        <button class="btn" id="bReprint" ${a.reprinted || (!a.scanned && !p.noBp) ? 'disabled' : ''}>🖨 Reimprimir tarjeta</button>
      </div>
      ${a.scan ? `<pre class="pnr scan ${a.scan.ok ? '' : 'bad'}">${a.scan.lines.map(esc).join('\n')}</pre>` : '<p class="hint">Escaneá la tarjeta: el embarque se hace siempre por sistema.</p>'}
      ${a.docs ? `<pre class="pnr scan ${a.docs.ok ? '' : 'bad'}">${a.docs.lines.map(esc).join('\n')}</pre>` : ''}
      ${a.gateDispatch ? '<p class="okline">Etiqueta GATE DISPATCH: se entrega en la puerta del avión al llegar.</p>' : ''}
      ${a.reseated ? `<p class="okline">Asiento reasignado: ${esc(a.newSeat)}.</p>` : ''}
      ${a.reprinted ? '<p class="okline">Tarjeta reimpresa a nombre del pasajero. Volvé a escanearla.</p>' : ''}`}
    ${B.held.length ? `<h3>Apartados (discrepancias)</h3><p class="hint">${B.held.map((h) => `${esc(norm(h.last))}/${esc(norm(h.first))}`).join(' · ')}</p><button class="btn warn" id="bHeld" ${B.zone < 4 || B.cur || B.queue.length ? 'disabled' : ''}>Llamar a los apartados</button>` : ''}
    <div class="kv" style="margin-top:12px"><span>Embarcados</span><b>${B.boarded} / ${B.checked}</b><span>En fila</span><b>${B.queue.length}</b><span>Esperando su zona</span><b>${B.waiting.length}</b></div>`;
  const on = (id, fn) => { const el = $(`#${id}`); if (el) el.onclick = fn; };
  pane.querySelectorAll('[data-ann]').forEach((b) => { b.onclick = () => microphone(b.dataset.ann); });
  on('aWait', () => advance(1));
  on('bScan', scan);
  on('bCuffs', () => {
    a.cuffChecked = true;
    if (!p.legal.cuffed) { a.cuffFixed = true; p.legal.cuffed = true; say('El detenido tiene que estar esposado desde la puerta de embarque hasta que baja del avión. Por favor, colóquenle las esposas antes de embarcar.', 'Tiene razón, se las sacamos para el control. Ya está.'); sys('DETENIDO ESPOSADO POR LOS ESCOLTAS', 'ok'); }
    else { say('Verifico: el detenido está esposado.', 'Correcto, como corresponde.'); sys('VERIFICADO: DETENIDO ESPOSADO', 'ok'); }
    renderPane();
  });
  on('bDocs', verifyDocs);
  on('bReprint', reprint);
  on('bHeld', callHeld);
  on('oSearch', searchVolunteers);
  on('oRaise', () => {
    o.authorized = OVBK_POLICY.managerRaise; o.offer = o.authorized;
    radio(`Gerente de aeropuertos: autorizado aumentar la compensación a USD ${o.authorized} para voluntarios.`);
    renderPane();
  });
  on('oNoSeat', () => { o.called = true; enqueue(o.noSeat.slice()); });
  on('bVol', () => ovbkForm('VDBC'));
  on('bDnbd', () => ovbkForm('DNBD'));
  on('bGD', () => { a.gateDispatch = true; say(agentSays('Le coloco una etiqueta Gate Dispatch: lo dejamos en la puerta del avión y se lo entregan al bajar.', "I'll tag this Gate Dispatch: we'll leave it at the aircraft door and you'll get it back when you deplane."), B.cur.lines.gd); renderPane(); });
  on('bSeat', () => {
    if (B.cur.kind === 'no_seat') {
      if (B.ovbk.freed - B.ovbk.used <= 0) { sys('NO HAY ASIENTOS LIBERADOS · Buscá voluntarios o gestioná DNBD', 'err'); return; }
      B.ovbk.used++;
    }
    a.reseated = true;
    a.newSeat = `${rnd(24, 29)}${pick(['B', 'C', 'D', 'E'])}`;
    B.cur.bp.seat = a.newSeat;
    B.cur.docs[0] = { ...B.cur.bp, id: B.cur.docs[0].id };
    say(agentSays('Por seguridad, ese asiento de salida de emergencia no le corresponde. Le asigno otro asiento.', "For safety reasons you can't sit in the exit row. I'm assigning you another seat."), B.cur.lines.reseat);
    sys(`ASIENTO REASIGNADO ${a.newSeat}`, 'ok');
    renderDesk(); renderPane();
  });
}

// Anuncios: lo que importa es el orden y el momento, no memorizar el texto
function microphone(id) {
  const first = (key, ok, title, detail, pts) => { if (!B.events[key]) { B.events[key] = true; procItem(ok, title, detail, pts); } };
  if (id === 'pre' || id === 'boarding') {
    if (B.now < B.crewReadyAt) first('annNoCrew', false, 'Anunció el embarque sin autorización de la tripulación', 'El TCP informa por radio cuándo la cabina está lista (seguridad, mantenimiento, aseo, meteorología, MEL). Recién ahí se anuncia.', -15);
    if (id === 'boarding' && !B.ann.pre) first('annNoPre', false, 'Faltó el anuncio de preembarque', 'Primero se avisa que el embarque comenzará en breves minutos.', -5);
    B.ann[id] = true;
    announceBanner(ANN[id](FLIGHT));
    if (id === 'boarding' && B.ann.pre && B.now >= B.crewReadyAt) procItem(true, 'Anuncios de preembarque y embarque en orden', '', 10);
    if (id === 'boarding' && B.depa.length) { radio('Escoltas: traslado de detenido listo en la puerta para embarcar primero.'); enqueue(B.depa.splice(0)); }
    advance(PACE.ann);
    renderPane();
    return;
  }
  if (id === 'final') {
    B.ann.final = true;
    announceBanner(ANN.final(FLIGHT));
    procItem(true, 'Llamado final', 'Ahora: llamar por nombre a los no presentados con equipaje en bodega (pestaña 3).', 5);
    onEvent('final', B);
    advance(PACE.ann);
    renderPane();
    return;
  }
  callZone(+id.slice(1));
}

function callZone(z) {
  if (B.depa.length) { radio('Escoltas: ¡todavía no embarcamos al detenido!'); enqueue(B.depa.splice(0)); }
  if (B.zone === 0) {
    const s = B.setup;
    const missing = [!s.system && 'conectar sistema', s.materials === null && 'materiales', !s.layout && 'layout de zonas', s.pmr === null && 'requerimientos especiales'].filter(Boolean);
    if (missing.length) procItem(false, 'Apertura de puerta incompleta', `Faltó: ${missing.join(', ')}.`, -5 * missing.length);
    if (B.now < B.crewReadyAt) procItem(false, 'Embarcó sin autorización de la tripulación', 'Sin la autorización del TCP no se embarca.', -30);
    if (!B.ann.boarding) procItem(false, 'Llamó zonas sin el anuncio de embarque', 'El anuncio de embarque da la bienvenida, indica la puerta y el orden de zonas.', -10);
  }
  if (B.ovbk && !B.events.ovbkLate && (B.ovbk.noSeat.length || (B.ovbk.called && B.queue.some((p) => p.kind === 'no_seat')))) { B.events.ovbkLate = true; procItem(false, 'Empezó a embarcar con pasajeros sin asiento sin resolver', 'Con sobreventa en el embarque, los voluntarios se buscan ANTES de empezar a embarcar.', -15); }
  if (z !== B.zone + 1) procItem(false, `Llamó la Zona ${z} fuera de orden`, 'Zona 1 (prioridades) y luego 2, 3 y 4.', -10);
  B.zone = Math.max(B.zone, z);
  announceBanner(ANN.zone(FLIGHT, z));
  scene.boardFlow(5);
  B.boarded += REGULAR[z];
  if (z === 4) { B.binsFull = true; setTimeout(() => radio('TCP: compartimientos superiores completos. Despachar en puerta (Gate Dispatch) el equipaje de mano adicional.'), 600); }
  const ready = B.waiting.filter((p) => p.bp.zone <= B.zone);
  B.waiting = B.waiting.filter((p) => p.bp.zone > B.zone);
  enqueue([...B.byZone[z].splice(0), ...ready]);
  onEvent('zone', B);
  advance(PACE.zone);
  renderPane();
}

function searchVolunteers() {
  const o = B.ovbk;
  o.searches++;
  announceBanner(`Su atención por favor: el vuelo ${FLIGHT.no} a ${FLIGHT.city} se encuentra completo. Buscamos pasajeros voluntarios para viajar en el próximo vuelo, con una compensación de USD ${o.offer} en voucher de servicios. Acérquense al podio.`);
  advance(PACE.ann);
  let n = 0;
  if (o.authorized && o.poolRaised > 0) { n = o.poolRaised; o.poolRaised = 0; }
  else if (!o.authorized && o.poolBase > 0) { n = o.poolBase; o.poolBase = 0; }
  if (!n) { setTimeout(() => sys('NADIE MÁS SE OFRECE CON ESA COMPENSACIÓN · Podés pedir al gerente un aumento', 'warn'), 1200); renderPane(); return; }
  const vols = Array.from({ length: n }, () => { const v = makeGatePax('gate_volunteer'); v.offerAmount = o.offer; return v; });
  B.checked += 0;
  setTimeout(() => enqueue(vols), 1500);
  renderPane();
}

function ovbkForm(ssr) {
  const p = B.cur;
  if (!p) return;
  compForm(ui, {
    pax: p, flight: FLIGHT, title: ssr === 'VDBC' ? '🙋 Registro de voluntario (puerta)' : '⛔ Embarque denegado involuntario (puerta)',
    onSubmit: (form) => decide({ kind: ssr === 'VDBC' ? 'volunteer' : 'dnbd', form, comp: gradeComp(p, form, FLIGHT, { ssr, authorized: p.offerAmount > OVBK_POLICY.comp.intl.same ? p.offerAmount : null }) }),
  });
}

function enqueue(list) {
  B.queue.push(...list);
  scene.syncQueue(B.queue);
  if (!B.cur) nextPax();
  updateTop();
}

function nextPax() {
  if (B.cur || !B.queue.length) { renderPane(); return; }
  const p = B.queue[0];
  scene.replaceFront(p);
  B.queue.shift();
  B.cur = p;
  B.act = { asked: {}, scanned: false, scan: null, gateDispatch: false, reseated: false, start: performance.now() };
  $('#docs').innerHTML = '<div class="empty">Pida la tarjeta de embarque y el documento.</div>';
  lock(true);
  scene.callNext().then(() => {
    if (B.cur !== p) return;
    $('#dialog').classList.remove('hidden');
    $('#portrait').innerHTML = faceSVG(p.face, { w: 92, h: 115, bg: '#cfdbe6' });
    $('#portrait').classList.toggle('wobble', !!p.drunk);
    scene.setSway(!!p.drunk);
    say(null, p.lines.greet);
    renderChips();
    lock(false);
    onEvent('pax', B);
    if (p.web) onEvent('web', B);
  });
  B.tab = 'board'; renderTabs(); renderPane();
}
function lock(v) { ['#gBoard', '#gWait', '#gHold', '#gDeny', '#gRedirect'].forEach((s) => { $(s).disabled = v; }); }

function questions() {
  const q = [
    { k: 'docs', label: '🎫 Tarjeta y documento', q: 'Buenas noches, ¿me permite su tarjeta de embarque y su documento?' },
    { k: 'companion', label: '👥 ¿Viaja con alguien?', q: '¿Viaja con alguien?' },
    { k: 'carry', label: '🎒 Equipaje de mano', q: '¿Qué lleva como equipaje de mano?' },
    { k: 'vape', label: '🚭 Normas', q: 'Le recuerdo que en la sala y a bordo no se puede fumar ni vapear.' },
  ];
  if (ENTRY_RULES[FLIGHT.country].returnTicket) q.splice(3, 0, { k: 'ret', label: '🧾 ¿Pasaje de regreso?', q: '¿Tiene pasaje de regreso o de continuación de viaje?' });
  return q;
}
// Con pasajeros angloparlantes el agente habla en inglés
function agentSays(es, en) { return B.cur && paxLang(B.cur) === 'en' ? en : es; }

function renderChips() {
  $('#chips').innerHTML = questions().map((q) => `<button class="chip ${B.act.asked[q.k] ? 'done' : ''}" data-q="${q.k}">${q.label}</button>`).join('');
  $('#chips').querySelectorAll('.chip').forEach((b) => { b.onclick = () => ask(b.dataset.q); });
}
function ask(k) {
  const q = questions().find((x) => x.k === k);
  B.act.asked[k] = true;
  const en = paxLang(B.cur) === 'en' ? AGENT_EN[{ docs: 'gdocs', visa: 'gvisa', ret: 'gret' }[k] || k] : null;
  say(en || q.q, B.cur.lines[k]);
  if (k === 'docs') renderDesk();
  renderChips();
  const p = B.cur, a = B.act;
  if (!a.conflictStarted && !p.fromCheckin && conflictTrigger(p.kind, k)) {
    a.conflictStarted = true;
    $('#portrait').classList.add('angry');
    setTimeout(() => runConflict(p, p.kind, ui, (res) => {
      if (B.cur !== p) return;
      a.conflict = res;
      $('#portrait').classList.remove('angry');
      if (p.kind !== 'gate_carryon') sys('INCIDENTE REGISTRADO · PASAJERO INSUBORDINADO', 'err');
      renderPane();
    }), 1400);
  }
}
function say(agent, text) {
  $('#agentLine').textContent = agent ? `Vos: ${agent}` : '';
  const b = $('#bubble');
  b.textContent = '';
  let i = 0;
  clearInterval(say.timer);
  say.timer = setInterval(() => { b.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(say.timer); }, 14);
}
function renderDesk() {
  const docs = B.cur.docs;
  $('#docs').innerHTML = docs.map((d) => `<div class="docThumb" data-id="${d.id}"><div class="dtitle">${esc(docTitle(d))}</div><div class="mini">${renderDoc(d)}</div></div>`).join('');
  $('#docs').querySelectorAll('.docThumb').forEach((el) => {
    el.onclick = () => {
      const d = docs.find((x) => x.id === el.dataset.id);
      ui.openModal(`<div class="docView">${renderDoc(d)}</div>
        ${d.face ? `<div class="compare"><div><small>Pasajero frente a usted</small>${faceSVG(B.cur.face, { w: 120, h: 150, bg: '#cfdbe6' })}</div><div><small>Foto del documento</small>${faceSVG(d.face, { w: 120, h: 150 })}</div></div>` : ''}
        <div class="row end"><button class="btn" id="mClose">Cerrar</button></div>`, 'dismissable doc');
      $('#mClose').onclick = ui.closeModal;
    };
  });
}

function scan() {
  const p = B.cur, a = B.act;
  if (!B.setup.system) { sys('SISTEMA DE EMBARQUE NO CONECTADO · Completá la apertura (pestaña 1)', 'err'); return; }
  if (!a.asked.docs) { sys('Pedile primero la tarjeta de embarque al pasajero', 'err'); return; }
  if (p.noBp && !a.reprinted) { sys('EL PASAJERO NO TIENE TARJETA PARA ESCANEAR · Buscalo por documento y reimprimí', 'err'); return; }
  a.scanned = true;
  const bp = p.bp;
  if (p.companion && bp.first === p.companion.first) {
    a.scan = { ok: false, lines: ['✖ RECHAZADO: TARJETA YA UTILIZADA', `   PAX ${norm(bp.last)}/${norm(bp.first)} EMBARCADO · SEQ ${String(p.companion.seq).padStart(3, '0')} · ASIENTO ${p.companion.seat}`, '   Verificá el documento del pasajero que se presenta.'] };
  } else if (bp.date.getTime() !== B.today.getTime()) {
    a.scan = { ok: false, lines: [`✖ RECHAZADO: TARJETA DEL ${fmtDate(bp.date)} · NO CORRESPONDE A LA FECHA DE HOY`, `   PAX ${norm(bp.last)}/${norm(bp.first)} · VUELO ${bp.flightNo} · FIGURA COMO NO PRESENTADO (NO SHOW)`, '   La tarjeta ya no es válida: derivar a Ventas.'] };
  } else if (bp.flightNo !== FLIGHT.no) {
    a.scan = { ok: false, lines: [`✖ RECHAZADO: LA TARJETA NO CORRESPONDE AL VUELO ${FLIGHT.no}`, `   PAX ${norm(bp.last)}/${norm(bp.first)} · VUELO ${bp.flightNo} ${STATION.code}-${bp.dest}`, `   PUERTA ${bp.gate} · EMBARQUE ${bp.boarding}`] };
  } else {
    B.seq++;
    bp.seq = B.seq;
    const lines = [`✔ ACEPTADO · SEQ ${String(B.seq).padStart(3, '0')}`, `   ${norm(bp.last)}/${norm(bp.first)} ${bp.title}`, `   ASIENTO ${bp.seat} · ZONA ${bp.zone} · CLASE ${bp.cls}${bp.ssr ? ` · SSR ${bp.ssr}` : ''}`];
    if (bp.seat === 'STBY') lines.push('⚠ PASAJERO SIN ASIENTO (NO SEAT) · VUELO EN SOBREVENTA');
    if (bp.seat === '20A' && p.kind === 'inop_seat' && !B.act.reseated) lines.push('⚠ ASIENTO 20A INOPERATIVO · BLOQUEADO POR MANTENIMIENTO');
    if (bp.zone > B.zone && bp.seat !== 'STBY') lines.push(`⚠ ZONA ${bp.zone} AÚN NO LLAMADA`);
    if (SEATMAP.exitRows.includes(parseInt(bp.seat, 10))) lines.push('⚠ ASIENTO DE SALIDA DE EMERGENCIA · VERIFICAR REQUISITOS');
    if (p.web) lines.push('ℹ WEB CHECK-IN · SIN CONTROL DOCUMENTAL EN COUNTER · VERIFICAR DOCUMENTOS');
    a.scan = { ok: true, lines };
  }
  scene.flashBgr(a.scan.ok);
  sys(a.scan.lines[0], a.scan.ok ? 'ok' : 'err');
  renderPane();
}

// Control documental en la puerta (pasajeros que no pasaron por un counter)
function verifyDocs() {
  const p = B.cur, a = B.act;
  if (!a.asked.docs) { sys('Pedile primero la tarjeta de embarque y el documento', 'err'); return; }
  a.docsChecked = true;
  const R = ENTRY_RULES[FLIGHT.country];
  const id = p.docs.find((d) => d.type === 'PASSPORT' && !d.old) || p.docs.find((d) => d.type === 'ID');
  const lines = [`DOCS CHECK · ${norm(p.last)}/${norm(p.first)} · ${COUNTRIES[p.nationality].iso3}`];
  let ok = true;
  if (id) lines.push(`   ${docTitle(id).toUpperCase()} N° ${id.number} · VENCE ${fmtDate(id.expiry)} ✔`);
  const visa = p.docs.find((d) => d.type === 'VISA_US');
  if (visa) lines.push(`   VISA EE.UU. B1/B2 · VENCE ${fmtDate(visa.expiry)} ✔`);
  if (R.esta.includes(p.nationality)) lines.push('   ESTA · APROBADA (iAPI OK TO BOARD) ✔');
  if (R.returnTicket && p.nationality !== FLIGHT.country) {
    const ret = p.booking ? p.booking.returnDate : p.retDate;
    if (p.docs.some((d) => d.type === 'RESIDENCE')) lines.push(`   RESIDENTE EN DESTINO · ${R.residence} ✔`);
    else if (ret) lines.push(`   PASAJE DE REGRESO · ${fmtDate(ret)} ✔`);
    else { ok = false; lines.push(`⚠ RESERVA SOLO IDA · ${R.name.toUpperCase()} EXIGE PASAJE DE REGRESO O CONTINUACIÓN (NO RESIDENTE)`); }
  }
  if (!p.web) lines.push('ℹ Documentación ya verificada en el counter.');
  a.docs = { ok, lines };
  sys(ok ? 'DOCUMENTACIÓN VERIFICADA · DOCS OK' : 'DOCUMENTACIÓN CON OBSERVACIONES', ok ? 'ok' : 'err');
  renderPane();
}

function reprint() {
  const p = B.cur, a = B.act;
  if (!canReprint()) {
    sys(B.now >= B.at(-10) ? 'REIMPRESIÓN NO DISPONIBLE: VUELO EN CIERRE (MINUTO −10)' : 'REIMPRESIÓN NO DISPONIBLE', 'err');
    renderPane();
    return;
  }
  a.reprinted = true;
  a.scanned = false;
  a.scan = null;
  if ((p.kind === 'name_mismatch' || p.kind === 'partner') && !p.returned) a.reprintEarly = true;
  p.bp = { ...p.ownBp };
  if (p.noBp) p.docs.unshift({ ...p.bp, id: `${p.id}-bp` });
  else p.docs[0] = { ...p.bp, id: p.docs[0].id };
  sys(`TARJETA REIMPRESA: ${norm(p.last)}/${norm(p.first)} · ASIENTO ${p.bp.seat}`, 'ok');
  renderDesk(); renderPane();
}

function callHeld() {
  const list = B.held.splice(0);
  list.forEach((p) => {
    p.returned = true;
    p.resolved = !!(p.partner && list.includes(p.partner));
    if (p.resolved) { p.bp = { ...p.ownBp }; p.docs[0] = { ...p.bp, id: p.docs[0].id }; }
    p.lines.greet = p.resolved ? p.lines.returnOk : p.lines.returnBad;
  });
  B.pending = B.pending.filter((x) => !x.held);
  announceBanner('Pasajeros apartados, por favor acérquense al podio.');
  enqueue(list);
  renderPane();
}

function denyPicker() {
  ui.openModal(`<h2>✖ No embarcar</h2><p class="hint">Indicá el motivo.</p>
    <div class="reasons">${Object.entries(DENY).map(([k, t]) => `<label><input type="radio" name="dn" value="${k}"> ${esc(t)}</label>`).join('')}</div>
    <label class="chk"><input type="checkbox" id="dnNotify"> Dar aviso al supervisor / Seguridad (PSA)</label>
    <div class="row end gap"><button class="btn ghost" id="dnNo">Cancelar</button><button class="btn bad" id="dnOk" disabled>Confirmar</button></div>`);
  document.querySelectorAll('#modalBox input[name=dn]').forEach((i) => { i.onchange = () => { $('#dnOk').disabled = false; }; });
  $('#dnNo').onclick = ui.closeModal;
  $('#dnOk').onclick = () => {
    const reason = document.querySelector('#modalBox input[name=dn]:checked').value;
    const notify = $('#dnNotify').checked;
    ui.closeModal();
    decide({ kind: 'deny', reason, notify });
  };
}

// ------------------------------------------------------------------
// Evaluación por pasajero
// ------------------------------------------------------------------
function crossWhy(p) {
  if (!p.returned) return 'Tarjetas cruzadas con su acompañante: el nombre de la tarjeta no coincide con el documento. Se le pide que aguarde y se embarcan juntos al final, cuando aparece el acompañante.';
  if (p.resolved) return 'Discrepancia resuelta: cada uno con su tarjeta. Embarcan al final.';
  return 'El acompañante no estaba para resolver: si el sistema lo permite y hay tiempo se reimprime la tarjeta; si no, queda abajo.';
}

function decide(d) {
  const p = B.cur, a = B.act;
  if (!p) return;
  const exp = expected(p);
  const notes = [];
  let pts = 0;
  const add = (ok, t, v) => { notes.push({ ok, t }); pts += v; };
  const LBL = { board: 'Embarcar', wait: 'Esperar su zona', hold: 'Apartar hasta el final', deny: 'No embarcar', redirect: 'Indicar otra puerta', volunteer: 'Voluntario (VDBC)', dnbd: 'Embarque denegado involuntario (DNBD)' };
  const correct = d.kind === exp.kind;
  if (correct) add(true, `Correcto: ${LBL[d.kind]}`, 20);
  else if (d.kind === 'board' && exp.kind === 'deny') add(false, `Embarcó a un pasajero que no debía viajar (${DENY[exp.reason]})`, -50);
  else add(false, `Correspondía: ${LBL[exp.kind]} (eligió: ${LBL[d.kind]})`, -25);

  const why = {
    senior_zone4: 'Mayores de 60 embarcan en la Zona 1 aunque su tarjeta indique otra zona.',
    early: B.zone < p.bp.zone ? 'Su zona aún no fue llamada: debe esperar.' : 'Su zona ya fue llamada: embarca.',
    influencer: B.zone < p.bp.zone ? 'Los seguidores no dan prioridad de embarque 😉: espera su zona como todos.' : 'Su zona ya fue llamada: embarca (con o sin story).',
    wrong_flight: `La tarjeta es del vuelo ${OTHER_FLIGHT.no} a ${OTHER_FLIGHT.city} (puerta ${OTHER_FLIGHT.gate}). Embarcar por sistema evita subir pasajeros de otros vuelos.`,
    name_mismatch: crossWhy(p), partner: crossWhy(p),
    dup_bp: 'Ambos tenían la misma tarjeta. Si el sistema lo permite y hay tiempo, se reimprime la del pasajero; si no, queda abajo.',
    dead_phone: 'Sin tarjeta: se busca al pasajero por documento y se reimprime si el sistema lo permite y hay tiempo.',
    impostor: 'Los rasgos de la persona no coinciden con la foto del pasaporte. Se avisa a Seguridad.',
    no_return: 'Visitante no residente con pasaje solo ida: el destino exige pasaje de regreso o de continuación. Migraciones de Argentina no lo controla: si viaja, lo rechazan al llegar (INAD). No embarca.',
    carry_ret: 'Se te pasó en el check-in: solo ida, sin pasaje de regreso y sin residencia. Migraciones de Argentina no lo controla, así que la puerta es la última barrera: no embarca y su equipaje se baja.',
    carry_doc: 'Se te pasó en el check-in: la pasajera gestante no cumplía las condiciones para volar (semanas o certificado médico). La puerta es la última barrera: no embarca y su equipaje se baja.',
    drunk: p.fromCheckin ? 'En el check-in ya mostraba señales de ebriedad... y pasó por el bar. CAT 2: no embarca, con supervisor o seguridad.' : 'Varias señales de ebriedad: habla trabada, rostro congestionado, inestabilidad, agresividad. CAT 2: requiere supervisor o seguridad.',
    vaper: 'Vapear en la sala es CAT 1: se le pide que desista y, si acata, embarca normalmente. No hace falta supervisor ni denegar.',
    exit_minor: `Salida de emergencia: solo mayores de ${EXIT_ROW.minAge} años.`,
    pet_exit: 'Pasajero con mascota en cabina (PETC) no puede ocupar una salida de emergencia.',
    inf_stroller: 'Coche del infante: se entrega en la puerta con etiqueta Gate Dispatch.',
    dutyfree: 'Con los compartimientos llenos, el equipaje de mano adicional se despacha en la puerta (Gate Dispatch).',
    sleeper: '¡Lo encontraste! Recorrer la sala después del llamado por nombre evita bajar un equipaje.',
    standby: 'Stand-by: se liberó un asiento por un no show y el voluntario embarca con boarding manual. Ya no corresponde la compensación.',
    gate_volunteer: 'Voluntario: SSR VDBC, protección en el vuelo acordado y compensación/servicios según la matriz. Su equipaje debe bajarse del vuelo.',
    no_seat: 'Pasajero sin asiento: si hay voluntarios, se le asigna el asiento liberado; si no, DNBD con protección en el vuelo más próximo.',
    gate_carryon: 'Compartimientos llenos: la valija adicional va con Gate Dispatch. Se resuelve con empatía y explicación (objetos de valor y remedios en mano). CAT 1: lo resuelve el agente.',
    gate_smoker: 'Fumador que no desiste en el embarque: CAT 2. Supervisor o seguridad, no embarca y se da aviso.',
    gate_rage: 'Arrojó un objeto y dañó elementos de la compañía: CAT 3. Se resguarda a los pasajeros, interviene la PSA y no embarca.',
    depa: 'Detenido (DEPA): embarca PRIMERO con sus escoltas, antes que el resto del pasaje, y permanece esposado desde la puerta de embarque hasta que desciende (nunca esposado a partes fijas del avión). Si no es posible, se embarca por la puerta trasera coordinando con la autoridad aeronáutica.',
    web_yesterday: 'Tarjeta del vuelo de ayer: el pasajero no se presentó (no show) y esa tarjeta ya no vale, aunque sea el mismo número de vuelo. No embarca: Ventas evalúa la reprogramación según su tarifa.',
    inop_seat: 'Asiento inoperativo: se remueve al pasajero, se bloquea el asiento y se le asigna uno de igual o superior categoría con nueva tarjeta.',
  }[p.kind];
  if (why) notes.push({ ok: null, t: why });

  (d.comp || []).forEach((x) => add(x.ok, x.title + (x.ok ? '' : ` — ${x.detail}`), x.pts));
  (a.conflict?.items || []).forEach((x) => add(x.ok, x.title + (x.ok ? '' : ` — ${x.detail}`), x.pts));
  if (d.kind === 'deny' && exp.kind === 'deny') {
    if (d.reason !== exp.reason) add(false, `Motivo: correspondía "${DENY[exp.reason]}"`, -5);
    if (exp.notify && !d.notify) add(false, 'Faltó dar aviso al supervisor / Seguridad (PSA)', -10);
  }
  const intl = FLIGHT.country !== STATION.country;
  if (p.web && intl && d.kind === 'board' && !a.docsChecked) add(false, 'Embarcó a un pasajero con web check-in sin verificar su documentación', -10);
  else if (p.web && intl && a.docsChecked && correct) add(true, 'Verificó la documentación (web check-in: no pasó por el counter)', 5);
  if ((d.kind === 'board' || d.kind === 'deny') && !a.scanned && !p.noBp && !(a.conflict && exp.reason === 'INSUB')) add(false, 'No escaneó la tarjeta: el embarque se hace siempre por sistema', -10);
  if (exp.reprint && d.kind === 'board' && !a.reprinted) add(false, 'Embarcó sin una tarjeta válida a su nombre: debía reimprimirla', -20);
  if (a.reprintEarly) add(false, 'Reimprimió con las tarjetas cruzadas: se generan duplicados. Se aparta y se resuelve al final', -10);
  if (d.kind === 'deny' && exp.kind === 'board' && exp.reprint) notes.push({ ok: null, t: 'El sistema permitía reimprimir y había tiempo: el pasajero podía viajar.' });
  if (d.kind === 'board' && exp.kind === 'board') {
    if (exp.gateDispatch && !a.gateDispatch) add(false, 'Faltó la etiqueta Gate Dispatch', -10);
    if (!exp.gateDispatch && a.gateDispatch) add(false, 'Gate Dispatch innecesario', -3);
    if (exp.reseat && !a.reseated) add(false, 'Dejó al pasajero en la salida de emergencia sin cumplir los requisitos', -20);
    if (!exp.reseat && a.reseated) add(false, 'Reasignó asiento sin motivo', -3);
    if (exp.vape && !a.asked.vape) add(false, 'Embarcó vapeando: había que pedirle que lo apague (CAT 1)', -10);
  }
  if (p.kind === 'depa' && d.kind === 'board') {
    if (!a.cuffChecked) add(false, a.cuffFixed === undefined && !p.legal.cuffed ? 'El detenido embarcó sin esposas' : 'No verificó que el detenido estuviera esposado', 'El detenido permanece esposado durante todo el proceso, desde la puerta de embarque hasta que desciende de la aeronave.', p.legal.cuffed ? -5 : -25);
    else if (a.cuffFixed) add(true, 'Hizo esposar al detenido antes de embarcar', '', 10);
    if (B.zone > 0) add(false, 'El detenido no embarcó primero', 'El detenido y sus escoltas embarcan PRIMERO, antes de llamar a la Zona 1.', -10);
    else add(true, 'Detenido y escoltas embarcaron primero', '', 10);
  }
  const secs = (performance.now() - a.start) / 1000;
  if (correct && B.mode === 'challenge' && secs < 20) add(true, `Atención ágil (${Math.round(secs)} s)`, 10);

  B.score += pts;
  B.results.push({ pax: p, decision: d, expected: exp, notes, pts, time: fmtTime(B.now), conflict: a.conflict || null });
  if (d.kind === 'board') B.boarded++;
  const sb = B.standby.find((x) => x.pax === p);
  if (sb) sb.status = d.kind === 'board' ? 'boarded' : 'waiting';
  if (d.kind === 'wait') B.waiting.push(p);
  if (d.kind === 'hold') { B.held.push(p); B.pending.push({ last: p.last, first: p.first, bags: p.bags, seat: p.ownBp.seat, held: true }); }
  if (d.kind === 'deny' || d.kind === 'dnbd') B.pending.push({ last: p.last, first: p.first, bags: p.bags, seat: p.bp.seat, denied: true });
  if (d.kind === 'volunteer') { B.ovbk.volunteers++; B.ovbk.freed++; B.checked++; B.pending.push({ last: p.last, first: p.first, bags: p.bags, seat: p.bp.seat, volunteer: true }); }
  if (B.ovbk && p.kind === 'no_seat') B.ovbk.noSeat = B.ovbk.noSeat.filter((x) => x !== p);

  say(null, p.lines[d.kind] || (d.kind === 'volunteer' ? p.lines.volunteer : null) || p.lines.wait);
  scene.setSway(false);
  scene.dismiss(d.kind === 'board' ? 'accept' : 'other');
  if (d.kind === 'volunteer' && B.ovbk.freed - B.ovbk.used > 0 && B.ovbk.noSeat.length) sys(`ASIENTO LIBERADO · Quedan ${B.ovbk.noSeat.length} pasajero(s) sin asiento`, 'ok');
  const good = notes.every((n) => n.ok !== false);
  toast(good, `<b>${good ? '✔' : '✖'} ${esc(KIND_LABEL[p.kind])}</b> <span class="pts">${pts > 0 ? '+' : ''}${pts}</span><ul>${notes.map((n) => `<li class="${n.ok === true ? 'ok' : n.ok === false ? 'bad' : 'info'}">${esc(n.t)}</li>`).join('')}</ul>`);
  B.cur = null;
  lock(true);
  $('#chips').innerHTML = '';
  $('#docs').innerHTML = '<div class="empty">—</div>';
  advance(PACE.pax);
  setTimeout(nextPax, 1200);
  renderPane();
}

// --- 3. Pendientes y cierre ----------------------------------------
function pendingList() {
  const noSeat = B.ovbk && B.ovbk.called === false ? B.ovbk.noSeat.map((p) => ({ last: p.last, first: p.first, bags: p.bags, seat: 'STBY', denied: true })) : [];
  return [...B.noShows.map((n) => ({ ...n, noShow: true })), ...noSeat, ...B.pending, ...B.waiting.map((p) => ({ last: p.last, first: p.first, bags: p.bags, seat: p.bp.seat, waiting: true }))];
}
const keyOf = (r) => `${r.last}/${r.first}`;

function panePend(pane) {
  const list = pendingList();
  const m15 = B.now >= B.at(-15);
  pane.innerHTML = `
    <h3>Chequeados no embarcados</h3>
    <p class="hint">Después del llamado final: llamar por nombre a los no presentados con equipaje. En el −15: búsqueda de equipaje y des-chequeo. ${m15 ? '' : `<b>Faltan ${Math.ceil((B.at(-15) - B.now) / 60000)} min para el −15.</b>`}</p>
    ${list.length ? `<table class="grid"><tr><th>Pasajero</th><th>Bodega</th><th>Estado</th><th></th></tr>${list.map((r) => {
      const k = keyOf(r);
      const called = B.called.has(k);
      const btns = [];
      if (r.noShow && r.bags && !called) btns.push(`<button class="btn sm" data-call="${esc(k)}" ${B.ann.final ? '' : 'disabled'}>📢 Llamar</button>`);
      if (r.noShow && called && r.sleeper && !r.found) btns.push(`<button class="btn sm" data-walk="${esc(k)}">🔎 Recorrer la sala</button>`);
      if (r.bags) btns.push(B.searched.has(k) ? '<span class="tag green">BÚSQUEDA</span>' : `<button class="btn sm warn" data-search="${esc(k)}">🔎 Equipaje</button>`);
      btns.push(B.dechecked.has(k) ? '<span class="tag green">DES-CHEQ.</span>' : `<button class="btn sm" data-decheck="${esc(k)}">Des-chequear</button>`);
      return `<tr><td>${esc(norm(r.last))}/${esc(norm(r.first))}<br><small>${r.seat}</small></td><td>${r.bags} pza</td>
        <td>${r.volunteer ? '<span class="tag amber">VOLUNTARIO</span>' : r.held ? '<span class="tag amber">APARTADO</span>' : r.stopped ? `<span class="tag red">${r.stopped.toUpperCase()}</span>` : r.denied ? '<span class="tag red">DENEGADO</span>' : r.waiting ? '<span class="tag amber">ESPERA ZONA</span>' : `<span class="tag">NO SHOW${called ? ' · LLAMADO' : ''}</span>`}</td>
        <td class="acts">${btns.join('')}</td></tr>`;
    }).join('')}</table>` : '<p class="hint">Sin pendientes.</p>'}
    ${B.standby.length ? `<h3>Stand-by · voluntarios VDBC del counter</h3>
      <p class="hint">Cada pasajero des-chequeado libera un asiento. Asientos liberados disponibles: <b>${standbyFree()}</b>. Con lugar: embarque manual. Sin lugar al cierre: entregar la compensación y los servicios acordados.</p>
      <table class="grid"><tr><th>Pasajero</th><th>Acordado</th><th>Estado</th><th></th></tr>${B.standby.map((x, i) => `<tr><td>${esc(norm(x.pax.last))}/${esc(norm(x.pax.first))}</td><td><small>${esc(compSummary(x.form))}</small></td>
        <td>${{ waiting: '<span class="tag amber">STAND-BY</span>', called: '<span class="tag">LLAMADO</span>', boarded: '<span class="tag green">EMBARCADO</span>', compensated: '<span class="tag green">COMPENSADO</span>' }[x.status]}</td>
        <td class="acts">${x.status === 'waiting' ? `<button class="btn sm ok" data-sbboard="${i}" ${standbyFree() > 0 && !B.closed ? '' : 'disabled'}>✈ Embarque manual</button><button class="btn sm warn" data-sbcomp="${i}">💵 Entregar compensación</button>` : ''}</td></tr>`).join('')}</table>` : ''}
    <h3>Cierre del vuelo</h3>
    <div class="kv"><span>Embarcados</span><b>${B.boarded} / ${B.checked}</b><span>Hora</span><b>${fmtTime(B.now)} (STD ${FLIGHT.dep})</b></div>
    <div class="row gap"><button class="btn ok" id="cClose" ${B.closed ? 'disabled' : ''}>🔒 Cerrar vuelo por sistema</button><button class="btn ghost" id="cWait">⏩ +1 min</button></div>`;
  pane.querySelectorAll('[data-call]').forEach((b) => { b.onclick = () => callByName(b.dataset.call); });
  pane.querySelectorAll('[data-walk]').forEach((b) => { b.onclick = () => walkRoom(b.dataset.walk); });
  pane.querySelectorAll('[data-search]').forEach((b) => {
    b.onclick = () => { const k = b.dataset.search; B.searched.add(k); B.searchedAt[k] = new Date(B.now); sys(`BÚSQUEDA DE EQUIPAJE ACTIVADA: ${k.toUpperCase()}`, 'ok'); renderPane(); };
  });
  pane.querySelectorAll('[data-decheck]').forEach((b) => {
    b.onclick = () => { B.dechecked.add(b.dataset.decheck); sys(`PASAJERO DES-CHEQUEADO: ${b.dataset.decheck.toUpperCase()}`, 'ok'); renderPane(); };
  });
  pane.querySelectorAll('[data-sbboard]').forEach((b) => { b.onclick = () => standbyBoard(+b.dataset.sbboard); });
  pane.querySelectorAll('[data-sbcomp]').forEach((b) => { b.onclick = () => standbyComp(+b.dataset.sbcomp); });
  $('#cClose').onclick = closeFlight;
  $('#cWait').onclick = () => advance(1);
}

// Asientos liberados por pasajeros des-chequeados que todavía no ocupó un stand-by
function standbyFree() {
  return B.dechecked.size - B.standby.filter((x) => x.status === 'called' || x.status === 'boarded').length;
}
function standbyBoard(i) {
  const x = B.standby[i];
  if (standbyFree() <= 0) return;
  x.status = 'called';
  x.pax.bp.seat = `${rnd(23, 30)}${pick(['A', 'C', 'D', 'F'])}`;
  x.pax.bp.zone = 4;
  x.pax.docs[0] = { ...x.pax.bp, id: x.pax.docs[0].id };
  x.compWhenFree = standbyFree() + 1;
  announceBanner(`Pasajero ${x.pax.first.toUpperCase()} ${x.pax.last.toUpperCase()}, en stand-by para el vuelo ${FLIGHT.no}: acérquese a la puerta ${FLIGHT.gate} para su embarque.`);
  sys(`BOARDING MANUAL · TARJETA IMPRESA ASIENTO ${x.pax.bp.seat}`, 'ok');
  enqueue([x.pax]);
  renderPane();
}
function standbyComp(i) {
  const x = B.standby[i];
  ui.openModal(`<h2>💵 Entrega de compensación · stand-by</h2>
    <p>${esc(norm(x.pax.last))}/${esc(norm(x.pax.first))} · SSR VDBC</p>
    <p class="hint">Acordado en el counter: ${esc(compSummary(x.form))}</p>
    <p class="hint">Asientos liberados disponibles ahora: <b>${standbyFree()}</b>. Si hay lugar, corresponde el embarque manual, no la compensación.</p>
    <div class="row end gap"><button class="btn ghost" id="sbNo">Cancelar</button><button class="btn ok" id="sbOk">Confirmar entrega</button></div>`);
  $('#sbNo').onclick = ui.closeModal;
  $('#sbOk').onclick = () => {
    ui.closeModal();
    x.status = 'compensated';
    x.freeAtComp = standbyFree();
    say(null, x.pax.lines.comp);
    sys('COMPENSACIÓN Y SERVICIOS ENTREGADOS', 'ok');
    renderPane();
  };
}

function callByName(k) {
  const ns = B.noShows.find((n) => keyOf(n) === k);
  B.called.add(k);
  announceBanner(ANN.name(FLIGHT, `${ns.first.toUpperCase()} ${ns.last.toUpperCase()}`));
  advance(PACE.ann);
  if (ns.pax && !ns.sleeper) {
    setTimeout(() => { B.noShows = B.noShows.filter((n) => n !== ns); enqueue([ns.pax]); }, 2500);
  } else if (ns.sleeper) {
    setTimeout(() => sys(`NADIE SE ACERCA... ¿${ns.first.toUpperCase()} ${ns.last.toUpperCase()} estará en la sala?`, 'warn'), 1500);
  }
  renderPane();
}
function walkRoom(k) {
  const ns = B.noShows.find((n) => keyOf(n) === k);
  ns.found = true;
  advance(2);
  announceBanner(`Encontraste a ${ns.first} ${ns.last} dormido en la fila 3 de asientos, abrazado a su mochila. 😴`);
  setTimeout(() => { B.noShows = B.noShows.filter((n) => n !== ns); enqueue([ns.pax]); }, 1800);
  renderPane();
}

function paneRadio(pane) {
  pane.innerHTML = `<h3>Radio / mensajes operativos</h3>${B.radio.map((r) => `<div class="radioMsg"><span>${r.t}</span>${esc(r.msg)}</div>`).join('') || '<p class="hint">Sin mensajes.</p>'}`;
}

function procItem(ok, title, detail, pts) {
  B.proc.push({ ok, title, detail, pts });
  B.score += pts;
  updateTop();
}

function closeFlight() {
  if (B.cur || B.queue.length) { sys('HAY PASAJEROS EN EL PODIO O EN FILA', 'err'); return; }
  if (B.standby.some((x) => x.status === 'called')) { sys('HAY UN STAND-BY LLAMADO QUE TODAVÍA NO EMBARCÓ', 'err'); return; }
  if (!window.confirm('¿Cerrar el vuelo por sistema? Después no se puede embarcar a nadie más.')) return;
  B.closed = true; B.closeTime = new Date(B.now);
  clearInterval(B.timer);
  B.stopped.forEach((x) => { if (!x.informed) informStopped(x); });
  if (!B.ann.final) procItem(false, 'No hizo el llamado final', '', -10);
  pendingList().forEach((r) => {
    const k = keyOf(r), nm = `${norm(r.last)}/${norm(r.first)}`;
    if (r.noShow && r.bags && !B.called.has(k)) procItem(false, `No llamó por nombre a ${nm}`, 'Antes de bajar un equipaje se llama al pasajero por nombre.', -5);
    if (r.bags && !B.searched.has(k)) { procItem(false, `Equipaje de ${nm} quedó en bodega sin su pasajero`, 'Se debe activar la búsqueda de equipaje y bajarlo antes de la salida (seguridad).', -40); B.critical = (B.critical || 0) + 1; }
    else if (r.bags && r.noShow && B.searchedAt[k] < B.at(-15)) procItem(false, `Búsqueda de equipaje de ${nm} antes del −15`, 'Para no presentados la búsqueda se activa en el −15: antes, todavía puede aparecer.', -5);
    else if (r.bags) procItem(true, `Búsqueda de equipaje: ${nm}`, '', 5);
    if (!B.dechecked.has(k)) procItem(false, `No des-chequeó a ${nm}`, 'Los pasajeros que no embarcan se des-chequean antes del cierre.', -10);
  });
  B.standby.forEach((x) => {
    const nm = `${norm(x.pax.last)}/${norm(x.pax.first)}`;
    if (x.status === 'boarded') procItem(true, `Stand-by embarcado: ${nm}`, 'Asiento liberado por un no show, boarding manual.', 10);
    else if (x.status === 'compensated' && x.freeAtComp > 0) procItem(false, `Compensó a ${nm} habiendo un asiento liberado`, 'Con un lugar libre por no show, el voluntario en stand-by embarca; la compensación es solo si no se libera lugar.', -15);
    else if (x.status === 'compensated' && standbyFree() > 0) procItem(false, `Quedó un asiento libre y ${nm} no viajó`, 'Antes de compensar, des-chequeá a los no show: cada uno libera un asiento para el stand-by.', -10);
    else if (x.status === 'compensated') procItem(true, `Compensación entregada a ${nm}`, 'No se liberaron lugares: corresponde la compensación y los servicios acordados en el counter.', 10);
    else procItem(false, `Stand-by sin resolver: ${nm}`, 'El voluntario en stand-by debe embarcar (si hay lugar) o recibir su compensación antes del cierre.', -20);
  });
  const late = Math.round((B.closeTime - B.at(-5)) / 60000);
  if (late > 0) procItem(false, `Cierre tardío: ${late} min después del −5`, 'Una demora en el cierre puede retrasar la salida del vuelo.', -Math.min(50, late * 5));
  else procItem(true, `Vuelo cerrado a tiempo (${fmtTime(B.closeTime)})`, '', 15);
  B.critical = (B.critical || 0) + B.results.filter((r) => r.decision.kind === 'board' && r.expected.kind === 'deny').length;
  scene.updateGate(B.flight, B.now, 'CERRADO', 0);
  onEvent('closed', B);
  report();
}

function summary() {
  const okPax = B.results.filter((r) => r.decision.kind === r.expected.kind).length;
  return { score: B.score, ok: okPax, total: B.results.length, critical: B.critical || 0, boarded: B.boarded, checked: B.checked, closeTime: B.closeTime, results: B.results, proc: B.proc };
}

function report() {
  const s = summary();
  const bad = B.proc.filter((x) => x.ok === false);
  ui.openModal(`
    <div class="report" id="report">
      <h1>Informe de embarque · ${FLIGHT.no} ${STATION.code}-${FLIGHT.dest}</h1>
      <p>Agente: <b>${esc(B.student)}</b> · Modo: <b>${B.mode === 'challenge' ? 'Desafío' : 'Aprendizaje'}</b> · Puerta ${FLIGHT.gate} · ${fmtDate(new Date())}</p>
      <div class="kpis">
        <div><span>Puntaje</span><b>${s.score}</b></div>
        <div><span>Decisiones en podio</span><b>${s.ok}/${s.total}</b></div>
        <div><span>Embarcados / chequeados</span><b>${s.boarded}/${s.checked}</b></div>
        <div><span>Errores de proceso</span><b class="${bad.length ? 'err' : ''}">${bad.length}</b></div>
        <div><span>Errores críticos</span><b class="${s.critical ? 'err' : ''}">${s.critical}</b></div>
        <div><span>Cierre (STD ${FLIGHT.dep})</span><b>${fmtTime(B.closeTime)}</b></div>
      </div>
      <h3>Podio</h3>
      <table class="grid rep"><tr><th>Hora</th><th>Pasajero</th><th>Caso</th><th>Decisión</th><th>Observaciones</th><th>Pts</th></tr>
      ${B.results.map((r) => `<tr class="${r.notes.some((n) => n.ok === false) ? 'bad' : ''}"><td>${r.time}</td><td>${esc(norm(r.pax.last))}/${esc(norm(r.pax.first))}</td><td>${esc(KIND_LABEL[r.pax.kind])}</td><td>${{ board: 'Embarcó', wait: 'Esperar', hold: 'Apartado', deny: 'No embarcó', redirect: 'Otra puerta', volunteer: 'Voluntario', dnbd: 'DNBD' }[r.decision.kind]}</td><td>${r.notes.filter((n) => n.ok === false).map((n) => esc(n.t)).join('<br>') || '—'}</td><td class="num">${r.pts}</td></tr>`).join('')}</table>
      <h3>Proceso</h3>
      <ul class="fb">${B.proc.map((x) => `<li class="${x.ok ? 'ok' : 'bad'}"><div><b>${esc(x.title)}</b>${x.detail ? `<p>${esc(x.detail)}</p>` : ''}</div><span class="pts">${x.pts > 0 ? '+' : ''}${x.pts}</span></li>`).join('')}</ul>
    </div>
    <div class="row end gap noprint"><button class="btn ghost" id="rpPrint">🖨 Imprimir / PDF</button><button class="btn ok" id="rpNew">${B.onDone ? 'Continuar ▶' : 'Volver al inicio'}</button></div>`, 'wide report');
  $('#rpPrint').onclick = () => window.print();
  $('#rpNew').onclick = () => { ui.closeModal(); if (B.onDone) B.onDone(s); else location.reload(); };
}

function showGateManual() {
  const was = B.paused; B.paused = true;
  ui.openModal(`<div class="manual">
    <h1>📘 Manual de embarque</h1>
    <p class="hint">Basado en la Guía de Atención al Pasajero · Unidad 4 · Parte II (Embarque). Cada aerolínea define sus procedimientos.</p>
    <ol>
      <li><b>Apertura (−60):</b> sistema y pantallas, materiales, layout de zonas y requerimientos especiales (PMR).</li>
      <li><b>Esperá al TCP:</b> el embarque empieza cuando la tripulación autoriza (puede demorarse por aseo, mantenimiento, seguridad, meteorología o MEL).</li>
      <li><b>Micrófono, en orden:</b> preembarque → embarque (bienvenida) → Zona 1 (prioritario, PMR, infantes, mayores de 60) → zonas 2, 3 y 4 → llamado final.</li>
      <li><b>Podio:</b> escanear siempre (BGR), identificación positiva (tarjeta = documento), foto, visa si corresponde, salida de emergencia, Gate Dispatch.</li>
      <li><b>Discrepancias:</b> tarjetas cruzadas → apartar y embarcar juntos al final. Tarjeta duplicada o sin tarjeta → reimprimir si el sistema lo permite y hay tiempo (hasta el −10); si no, queda abajo.</li>
      <li><b>Sobreventa:</b> con pasajeros sin asiento, buscá voluntarios antes de embarcar (el gerente puede autorizar un aumento). Voluntario: VDBC. Sin voluntarios: DNBD y protección en el vuelo más próximo. Compensación y servicios según la matriz.</li>
      <li><b>Stand-by:</b> los voluntarios del counter en stand-by embarcan con boarding manual si se liberan lugares por no show (des-chequeo); si no, reciben la compensación acordada.</li>
      <li><b>Asiento inoperativo:</b> nuevo asiento de igual o superior categoría y nueva tarjeta.</li>
      <li><b>Conducta:</b> CAT 1 (vapear, protestar) lo resolvés vos; CAT 2/3 o alcohol: no embarca, con supervisor / PSA.</li>
      <li><b>Después del llamado final:</b> llamá por nombre a los no presentados con equipaje. Si no aparecen, recorré la sala.</li>
      <li><b>−15:</b> búsqueda de equipaje y des-chequeo de quienes no embarcan. El vuelo no lleva equipaje sin su pasajero.</li>
      <li><b>Cierre</b> del vuelo por sistema, idealmente antes del −5.</li>
    </ol>
    <div class="row end"><button class="btn ok" id="manClose">Entendido</button></div></div>`, 'wide');
  $('#manClose').onclick = () => { ui.closeModal(); B.paused = was; };
}
