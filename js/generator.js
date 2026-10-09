// Generación de pasajeros y escenarios.
import { NAMES, COUNTRIES, ENTRY_RULES, FARES, AIRLINE, STATION, PREGNANCY, UM_POLICY } from './data.js';
import { HAIR } from './docs.js';
import { checkinLines, paxLang } from './dialogues.js';
import { FIREARMS, AVIH, firearmDocs, avihDocs } from './restricted.js';
import {
  rnd, rndf, pick, chance, shuffle, addDays, addMonths, addYears, dayOnly, ageOn, fmtDate,
  randomLetters, randomDigits, norm,
} from './util.js';

// Escenarios: aceptables (accept) y con problemas.
export const SCENARIOS = {
  ok: 'Pasajero sin novedades',
  dni_ok: 'Viaja con documento de identidad (Mercosur)',
  visa_oldpp: 'Visa vigente en pasaporte anterior',
  minor_ok: 'Menor con autorización',
  expired: 'Documento vencido',
  validity_stay: 'Documento vence durante la estadía',
  validity_es: 'Validez insuficiente para Schengen',
  dni_wrong: 'DNI no válido para el destino',
  no_visa: 'Sin visa',
  no_return: 'Solo ida, visitante sin pasaje de regreso',
  vip_angry: 'Pasajero VIP prepotente (CAT 1)',
  dom_license: 'Cabotaje: perdió el DNI, viaja con la licencia de conducir',
  dom_license_expired: 'Cabotaje: perdió el DNI, licencia de conducir vencida',
  dom_police: 'Cabotaje: le robaron el DNI, presenta la denuncia policial',
  dom_tramite: 'Cabotaje: presenta la constancia de DNI en trámite',
  dom_nodoc: 'Cabotaje: sin documento (sólo una foto en el celular)',
  depa_ok: 'Detenido / extraditado (DEPA) con escoltas, en regla',
  depa_late: 'DEPA reservado con menos de 24 horas',
  depa_one_escort: 'DEPA con un solo escolta',
  depa_female: 'Detenida mujer con dos escoltas varones',
  depa_second: 'Segundo detenido en el mismo vuelo',
  depa_private: 'DEPA con escoltas de seguridad privada',
  depo_ok: 'Deportado con escolta, en regla',
  depo_wrong_sex: 'Deportado con un escolta de otro sexo',
  depu_ok: 'Deportado sin escolta (DEPU)',
  angry_cat2: 'Pasajero furioso que no acata (CAT 2)',
  bomb_joke: 'Chiste de bomba en el check-in (CAT 3)',
  return_resident: 'Solo ida, residente en el destino',
  visa_expired: 'Visa vencida',
  no_esta: 'Sin ESTA',
  us_br_noevisa: 'Sin e-Visa para Brasil',
  impostor: 'Impostor (foto no coincide)',
  name_typo: 'Nombre no coincide con la reserva',
  no_ticket: 'Reserva sin boleto emitido',
  wrong_date: 'Reserva para otra fecha',
  late: 'Check-in cerrado',
  minor_noauth: 'Menor sin autorización válida',
  um_missing: 'Menor sin servicio UM',
  pregnant_ok: 'Pasajera gestante (hasta semana 28)',
  pregnant_cert: 'Pasajera gestante con certificado médico válido',
  pregnant_nocert: 'Pasajera gestante sin certificado válido',
  pregnant_39: 'Pasajera gestante de 39 semanas o más',
  drunk: 'Pasajero bajo efectos del alcohol',
  family_ok: 'Familia con ambos padres (partida de nacimiento)',
  family_nobirth: 'Familia con ambos padres, sin partida de nacimiento',
  one_parent_ok: 'Menor con un solo padre y permiso del otro',
  one_parent_noauth: 'Menor con un solo padre, sin permiso válido',
  infant_nodoc: 'Infante sin documento propio',
  infant_nobooking: 'Infante no incluido en la reserva',
  relative_ok: 'Menor con su abuelo/a y permiso de ambos padres',
  relative_noauth: 'Menor con su abuelo/a, permiso firmado por un solo padre',
  deceased_ok: 'Menor con un padre; el otro falleció (con certificado de defunción)',
  deceased_nocert: 'Menor con un padre; el otro falleció, sin certificado de defunción',
  court_ok: 'Menor con un padre; el otro ausente, con autorización del tribunal de familia',
  court_wrong: 'Menor con un padre; autorización judicial para otro destino',
  consul_ok: 'Menor con un padre; el otro en el exterior, autorización por consulado',
  consul_letter: 'Menor con un padre; el otro en el exterior, solo una carta firmada',
  tutor_ok: 'Menor con su tutor/a, con certificado judicial de tutela',
  tutor_nocert: 'Menor con su tutor/a, sin certificado de tutela',
};
// Familias: relación del menor con el adulto con quien viaja
export const FAMILY = {
  family_ok: 'both', family_nobirth: 'both', infant_nodoc: 'both',
  one_parent_ok: 'one', one_parent_noauth: 'one', infant_nobooking: 'one',
  relative_ok: 'relative', relative_noauth: 'relative',
  deceased_ok: 'one', deceased_nocert: 'one', court_ok: 'one', court_wrong: 'one', consul_ok: 'one', consul_letter: 'one',
  tutor_ok: 'guardian', tutor_nocert: 'guardian',
};
// Motivo por el que el otro progenitor no viaja (casos especiales de la guía)
// Pasajeros con condiciones legales (Guía U4 · Parte IV)
export const LEGAL = {
  depa_ok: { type: 'DEPA' }, depa_late: { type: 'DEPA', late: true }, depa_one_escort: { type: 'DEPA', escorts: 1 },
  depa_female: { type: 'DEPA', female: true, maleEscorts: true }, depa_second: { type: 'DEPA', second: true }, depa_private: { type: 'DEPA', priv: true },
  depo_ok: { type: 'DEPO' }, depo_wrong_sex: { type: 'DEPO', wrongSex: true }, depu_ok: { type: 'DEPU' },
};
export const ABSENT = {
  deceased_ok: 'deceased', deceased_nocert: 'deceased', court_ok: 'court', court_wrong: 'court', consul_ok: 'abroad', consul_letter: 'abroad',
};

export const ACCEPT_SCENARIOS = ['ok', 'dni_ok', 'visa_oldpp', 'minor_ok', 'pregnant_ok', 'pregnant_cert', 'family_ok', 'one_parent_ok', 'relative_ok', 'deceased_ok', 'court_ok', 'consul_ok', 'tutor_ok', 'return_resident', 'vip_angry', 'depa_ok', 'depo_ok', 'depu_ok', 'dom_license', 'dom_police', 'dom_tramite'];

const DECKS = {
  basico: ['ok', 'ok', 'dni_ok', 'expired', 'no_visa', 'pregnant_ok', 'no_ticket', 'late', 'drunk', 'impostor'],
  intermedio: ['ok', 'dni_ok', 'expired', 'no_visa', 'validity_es', 'impostor', 'name_typo', 'late', 'minor_ok', 'minor_noauth', 'dni_wrong', 'ok', 'no_esta', 'pregnant_cert', 'drunk', 'family_ok', 'one_parent_noauth', 'no_return', 'vip_angry', 'depu_ok', 'depa_ok', 'dom_license', 'dom_nodoc'],
  avanzado: ['ok', 'visa_oldpp', 'validity_es', 'validity_stay', 'visa_expired', 'no_esta', 'us_br_noevisa', 'impostor', 'name_typo', 'wrong_date', 'minor_ok', 'um_missing', 'minor_noauth', 'dni_ok', 'late', 'pregnant_cert', 'pregnant_nocert', 'pregnant_39', 'drunk', 'one_parent_ok', 'infant_nobooking', 'family_nobirth', 'relative_noauth', 'infant_nodoc', 'deceased_nocert', 'court_ok', 'consul_letter', 'tutor_ok', 'no_return', 'return_resident', 'angry_cat2', 'bomb_joke', 'depa_ok', 'depa_late', 'depa_one_escort', 'depa_female', 'depa_second', 'depa_private', 'depo_ok', 'depo_wrong_sex', 'depu_ok', 'dom_police', 'dom_tramite', 'dom_license_expired'],
};
const OVERLAY_POOL = {
  basico: ['overweight', 'dg', 'limited_release', 'valuables', 'none'],
  intermedio: ['overweight', 'heavy', 'extra_bag', 'dg', 'limited_release', 'valuables', 'exit_restricted', 'face_change', 'avih', 'none'],
  avanzado: ['overweight', 'heavy', 'extra_bag', 'light_bag', 'dg', 'limited_release', 'valuables', 'exit_restricted', 'face_change', 'firearm', 'avih'],
};

// ------------------------------------------------------------------
// Mazos variados (Práctica y Carrera): se sortean casos de todo el catálogo del nivel,
// con una mezcla equilibrada (≈ un tercio en regla) y un peso por caso que decide quien llama
// (p. ej. más peso a lo que el alumno falla, menos a lo que vio en los últimos turnos).
// ------------------------------------------------------------------
const uniq = (a) => [...new Set(a)];
const POOLS = (() => {
  const basico = uniq([...DECKS.basico, 'dni_wrong', 'name_typo', 'minor_ok', 'wrong_date', 'dom_license', 'validity_stay', 'no_esta']);
  const intermedio = uniq([...basico, ...DECKS.intermedio, 'visa_oldpp', 'pregnant_nocert', 'um_missing', 'return_resident', 'dom_police', 'one_parent_ok', 'relative_ok']);
  const avanzado = uniq([...intermedio, ...DECKS.avanzado, 'deceased_ok', 'consul_ok', 'court_wrong', 'tutor_nocert', 'dom_tramite']);
  return { basico, intermedio, avanzado };
})();
export const scenarioPool = (level) => (POOLS[level] || POOLS.basico).filter((k) => SCENARIOS[k]);

export function buildSmartDeck(level, n, weightOf = () => 1) {
  const pool = scenarioPool(level);
  const okPool = pool.filter((k) => ACCEPT_SCENARIOS.includes(k));
  const badPool = pool.filter((k) => !ACCEPT_SCENARIOS.includes(k));
  const nOk = Math.max(2, Math.round(n * 0.35));
  const draw = (list, count) => {
    const out = [];
    const avail = list.map((k) => ({ k, w: Math.max(0.05, weightOf(k)) }));
    while (out.length < count && avail.length) {
      const tot = avail.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * tot, i = 0;
      while ((r -= avail[i].w) > 0 && i < avail.length - 1) i++;
      out.push(avail[i].k);
      // 'ok' puede repetirse (es lo más común en la vida real); el resto, una vez por turno
      if (avail[i].k !== 'ok') avail.splice(i, 1); else avail[i].w *= 0.5;
    }
    return out;
  };
  const picks = shuffle([...draw(okPool, nOk), ...draw(badPool, n - nOk)]);
  const overlays = shuffle(OVERLAY_POOL[level].concat(OVERLAY_POOL[level]));
  let oi = 0;
  return picks.map((s) => ({ scenario: s, overlay: ACCEPT_SCENARIOS.includes(s) ? overlays[oi++ % overlays.length] : 'none' }));
}

export function buildDeck(level) {
  const base = DECKS[level];
  const [first, ...rest] = base;
  const overlays = shuffle(OVERLAY_POOL[level].concat(OVERLAY_POOL[level]));
  let oi = 0;
  return [first, ...shuffle(rest)].map((s, i) => ({
    scenario: s,
    overlay: ACCEPT_SCENARIOS.includes(s) && i > 0 ? overlays[oi++ % overlays.length] : 'none',
  }));
}

// ------------------------------------------------------------------
const NAT_WEIGHTS = [['AR', 48], ['BR', 16], ['UY', 7], ['CL', 6], ['ES', 9], ['US', 14]];
function weightedNat() {
  const t = NAT_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * t;
  for (const [n, w] of NAT_WEIGHTS) { if ((r -= w) < 0) return n; }
  return 'AR';
}
const BIRTHPLACES = {
  AR: ['BUENOS AIRES', 'CÓRDOBA', 'ROSARIO', 'MENDOZA', 'LA PLATA', 'SALTA', 'MAR DEL PLATA', 'TUCUMÁN', 'NEUQUÉN'],
  BR: ['SÃO PAULO', 'RIO DE JANEIRO', 'PORTO ALEGRE', 'CURITIBA'],
  UY: ['MONTEVIDEO', 'SALTO', 'PAYSANDÚ'],
  CL: ['SANTIAGO', 'VALPARAÍSO', 'CONCEPCIÓN'],
  ES: ['MADRID', 'SEVILLA', 'VALENCIA', 'BILBAO'],
  US: ['FLORIDA, U.S.A.', 'NEW YORK, U.S.A.', 'TEXAS, U.S.A.'],
};

export function randomFace(sex, age, nat) {
  const skinPool = { AR: [0, 0, 1, 1, 2], UY: [0, 1, 1, 2], CL: [1, 1, 2, 2], ES: [0, 1, 1], BR: [0, 1, 2, 3, 4], US: [0, 1, 2, 3, 4] }[nat];
  let hairColor;
  if (age >= 62) hairColor = pick([HAIR.canoso, HAIR.blanco]);
  else if (age >= 48 && chance(0.4)) hairColor = HAIR.canoso;
  else hairColor = pick([HAIR.negro, HAIR.castano, HAIR.castano, HAIR.castanoClaro, HAIR.rubio, HAIR.pelirrojo]);
  const hairStyle = sex === 'M'
    ? (age > 40 && chance(0.25) ? 'bald' : pick(['short', 'short', 'curly']))
    : pick(['long', 'long', 'bun', 'short', 'curly']);
  return {
    sex, age,
    skin: pick(skinPool),
    hairColor, hairStyle,
    glasses: chance(age > 45 ? 0.45 : 0.2),
    beard: sex === 'M' && age >= 18 && chance(0.3),
    shape: pick(['round', 'oval', 'long']),
    nose: rnd(0, 2),
    brows: pick(['thin', 'thick']),
    eye: rnd(0, 4),
    smile: chance(0.5),
    shirt: pick(['#2f4b7c', '#7a2e2e', '#2e6b4f', '#6b5b95', '#444', '#b07a2a', '#1f7a8c', '#8c3b6b']),
    pants: pick(['#222a35', '#3b3b3b', '#4b5d73', '#5a4632']),
  };
}

// Rostro distinto (impostor): misma edad aproximada y sexo, rasgos diferentes.
export function differentFace(f, nat) {
  let g;
  do {
    g = randomFace(f.sex, f.age, nat);
    g.hairColor = f.hairColor; // el impostor imita el color de pelo
  } while ([g.shape !== f.shape, g.nose !== f.nose, g.eye !== f.eye, g.brows !== f.brows, g.skin !== f.skin].filter(Boolean).length < 3);
  return g;
}

function passportNumber(nat) {
  switch (nat) {
    case 'AR': return 'AA' + randomLetters(1) + randomDigits(6);
    case 'BR': return randomLetters(2) + randomDigits(6);
    case 'UY': return 'C' + randomDigits(6);
    case 'CL': return 'F' + randomDigits(8);
    case 'ES': return randomLetters(3) + randomDigits(6);
    default: return '5' + randomDigits(8);
  }
}
function idNumber(nat, dob) {
  if (nat === 'AR') return String(Math.max(6000000, (dob.getFullYear() - 1945) * 780000 + rnd(0, 700000)));
  if (nat === 'ES') return randomDigits(8) + randomLetters(1);
  if (nat === 'CL') return randomDigits(8);
  return randomDigits(8);
}
const pnrCode = () => randomLetters(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');

export function makePerson(nat, today, minAge = 19, maxAge = 76, forceSex = null) {
  const sex = forceSex || (chance(0.5) ? 'M' : 'F');
  const first = pick(NAMES[nat][sex]);
  let last = pick(NAMES[nat].last);
  if (nat === 'ES' || (nat === 'AR' && chance(0.2))) {
    let l2; do { l2 = pick(NAMES[nat].last); } while (l2 === last);
    last = `${last} ${l2}`;
  }
  const age = rnd(minAge, maxAge);
  const dob = addDays(addYears(today, -age), -rnd(1, 360));
  return { sex, first, last, dob, age: ageOn(dob, today), nationality: nat, face: randomFace(sex, ageOn(dob, today), nat) };
}

export function makePassport(p, today, { expiry, issue, old = false } = {}) {
  const years = p.age < 18 ? 5 : 10;
  if (!issue && !expiry) issue = addDays(today, -rnd(30, 365 * (years - 1)));
  if (!issue) issue = addYears(expiry, -years);
  if (!expiry) expiry = addDays(addYears(issue, years), -1);
  return {
    type: 'PASSPORT', country: p.nationality, nationality: p.nationality, number: passportNumber(p.nationality),
    first: p.first, last: p.last, sex: p.sex, dob: p.dob, issue, expiry, old,
    birthPlace: pick(BIRTHPLACES[p.nationality]),
    face: photoFace(p.face, issue, today),
  };
}
export function makeId(p, today, { expiry } = {}) {
  const years = 15;
  let issue = expiry ? addYears(expiry, -years) : addDays(today, -rnd(60, 365 * 12));
  if (issue < p.dob) issue = addDays(p.dob, 365 * 2);
  if (!expiry) expiry = addYears(issue, years);
  return {
    type: 'ID', country: p.nationality, nationality: p.nationality, number: idNumber(p.nationality, p.dob),
    first: p.first, last: p.last, sex: p.sex, dob: p.dob, issue, expiry,
    face: photoFace(p.face, issue, today),
  };
}
// La foto del documento refleja a la persona al momento de emisión.
function photoFace(face, issue, today) {
  const yearsAgo = (today - issue) / (365 * 864e5);
  const f = { ...face, smile: false, age: Math.round(face.age - yearsAgo) };
  if (yearsAgo > 6 && (face.hairColor === HAIR.blanco || face.hairColor === HAIR.canoso)) f.hairColor = pick([HAIR.castano, HAIR.canoso]);
  return f;
}

export function makeVisaUS(p, passport, today, { expired = false } = {}) {
  let issue, expiry;
  if (expired) {
    expiry = addDays(today, -rnd(15, 400));
    issue = addYears(expiry, -10);
  } else {
    issue = addDays(today, -rnd(200, 365 * 8));
    if (issue < passport.issue) issue = addDays(passport.issue, rnd(20, 200));
    expiry = addYears(issue, 10);
  }
  return {
    type: 'VISA_US', control: String(issue.getFullYear()) + randomDigits(10), first: p.first, last: p.last, sex: p.sex, dob: p.dob,
    nationality: p.nationality, linkedPassport: passport.number, issue, expiry, face: photoFace(p.face, issue, today),
  };
}
function makeEvisaBR(p, passport, today) {
  const issue = addDays(today, -rnd(10, 120));
  return { type: 'EVISA_BR', control: 'BR' + randomDigits(9), first: p.first, last: p.last, nationality: p.nationality, linkedPassport: passport.number, issue, expiry: addYears(issue, 2) };
}
function makeAuth(p, idDoc, today, flight, { expired = false } = {}) {
  const issue = expired ? addDays(today, -rnd(400, 700)) : addDays(today, -rnd(5, 200));
  const expiry = expired ? addDays(today, -rnd(10, 300)) : addYears(issue, 1);
  const motherLast = pick(NAMES.AR.last);
  return {
    type: 'AUTH_MINOR', first: p.first, last: p.last, minorDoc: idDoc.number,
    parent1: `${pick(NAMES.AR.M)} ${p.last}`, parent1Doc: String(rnd(18, 34)) + randomDigits(6),
    parent2: `${pick(NAMES.AR.F)} ${motherLast}`, parent2Doc: String(rnd(18, 34)) + randomDigits(6),
    destination: chance(0.5) ? 'TODOS LOS PAÍSES' : COUNTRIES[flight.country].name.toUpperCase(),
    notary: rnd(100, 2400), issue, expiry,
  };
}

function typoName(b) {
  const opts = [];
  const l = b.last;
  if (/z/i.test(l)) opts.push(() => { b.last = l.replace(/z/i, 's'); });
  if (/s/.test(l)) opts.push(() => { b.last = l.replace(/s(?!.*s)/, 'z'); });
  if (l.length > 5) opts.push(() => { const i = rnd(2, l.length - 2); b.last = l.slice(0, i) + l.slice(i + 1); });
  opts.push(() => { const alt = { 'María Laura': 'María', Lucas: 'Lucas Martín', Martín: 'Martina' }; b.first = alt[b.first] || (b.first + 'a'); });
  const before = norm(b.first + b.last);
  pick(opts)();
  if (norm(b.first + b.last) === before) b.first = b.first + ' José';
}

// ------------------------------------------------------------------
export function flightState(f, now) {
  if (now >= f.closeTime) return 'closed';
  return 'open';
}

export function createPassenger(entry, now, flights) {
  let { scenario, overlay } = entry;
  const today = dayOnly(now);
  // Solo vuelos con el check-in ya abierto y con margen antes del cierre
  const open = flights.filter((f) => now >= f.openTime && (f.closeTime - now) / 60000 > 14);
  const closed = flights.filter((f) => f.closeTime <= now);
  const by = (codes) => open.filter((f) => codes.includes(f.dest));

  // Restricciones por escenario (si no hay vuelo posible, se cambia de escenario)
  const need = {
    dni_ok: by(['GRU', 'SCL']), us_br_noevisa: by(['GRU']), validity_es: by(['MAD']),
    no_visa: by(['MIA']), visa_expired: by(['MIA']), visa_oldpp: by(['MIA']), no_esta: by(['MIA']), no_return: by(['MIA', 'MAD']), return_resident: by(['MIA', 'MAD']),
    dni_wrong: by(['MAD', 'MIA']), validity_stay: by(['GRU', 'SCL', 'MIA']), minor_ok: by(['GRU', 'SCL', 'MAD']), minor_noauth: by(['GRU', 'SCL', 'MAD']),
    um_missing: by(['GRU', 'SCL', 'MAD']), late: closed,
  };
  Object.keys(FAMILY).forEach((k) => { need[k] = by(['GRU', 'SCL', 'MAD']); });
  ['dom_license', 'dom_license_expired', 'dom_police', 'dom_tramite', 'dom_nodoc'].forEach((k) => { need[k] = by(['BRC', 'IGR']); });
  // Las armas de fuego se juegan sólo en cabotaje (sin permisos de importación del destino)
  if (overlay === 'firearm' && scenario === 'ok') need.ok = by(['BRC', 'IGR']);
  if (need[scenario] && !need[scenario].length) {
    // Si el vuelo necesario no está abierto, se reemplaza por un caso del mismo tipo (aceptable o con problema)
    scenario = ACCEPT_SCENARIOS.includes(scenario) ? 'ok' : pick(['expired', 'impostor', 'no_ticket', 'name_typo']);
  }
  if (!open.length) scenario = 'late';
  const pool = need[scenario] || (scenario === 'late' ? closed : open);
  let flight = pick(pool.length ? pool : flights);
  // Pasajero de un vuelo puntual (p. ej. el que se quiere colar en la fila)
  if (entry.flightNo) flight = flights.find((f) => f.no === entry.flightNo && now >= f.openTime && now < f.closeTime) || flight;

  // Nacionalidad
  let nat;
  switch (scenario) {
    case 'dni_ok': nat = pick(['AR', 'AR', 'AR', 'UY', 'CL', 'BR'].filter((n) => n !== flight.country)); break;
    case 'us_br_noevisa': nat = 'US'; break;
    case 'validity_es': nat = pick(['AR', 'AR', 'BR', 'UY']); break;
    case 'no_visa': case 'visa_expired': nat = pick(['AR', 'AR', 'AR', 'BR', 'UY']); break;
    case 'visa_oldpp': case 'validity_stay': nat = 'AR'; break;
    case 'no_esta': nat = pick(['ES', 'ES', 'CL']); break;
    case 'no_return': case 'return_resident': nat = pick(['AR', 'AR', 'AR', 'BR', 'UY']); break;
    case 'vip_angry': case 'angry_cat2': case 'bomb_joke': nat = 'AR'; break;
    case 'dni_wrong': case 'minor_ok': case 'minor_noauth': case 'um_missing': nat = 'AR'; break;
    default: nat = FAMILY[scenario] ? 'AR' : weightedNat();
  }

  // Condición legal: el detenido puede ser extraditado a su país; el deportado vuelve al suyo
  if (LEGAL[scenario]) nat = LEGAL[scenario].type === 'DEPA' ? (flight.country === 'US' ? 'US' : pick([flight.country, 'AR', 'AR'])) : flight.country;

  if (overlay === 'firearm' && scenario === 'ok') nat = 'AR';
  if (scenario.startsWith('dom_')) nat = 'AR';

  // Persona
  let minAge = 19, maxAge = 76;
  if (scenario === 'minor_ok') { minAge = chance(0.5) ? 8 : UM_POLICY.mandatoryTo + 1; maxAge = minAge === 8 ? UM_POLICY.mandatoryTo : 17; }
  if (scenario === 'minor_noauth') { minAge = UM_POLICY.mandatoryTo + 1; maxAge = 17; }
  if (scenario === 'um_missing') { minAge = 6; maxAge = 11; }
  if (FAMILY[scenario]) { overlay = 'none'; [minAge, maxAge] = FAMILY[scenario] === 'relative' ? [58, 72] : FAMILY[scenario] === 'guardian' ? [34, 68] : [28, 44]; }
  if (['vip_angry', 'angry_cat2', 'bomb_joke'].includes(scenario)) { minAge = 30; maxAge = 58; }
  if (LEGAL[scenario]) { overlay = 'none'; minAge = 22; maxAge = 55; }
  const pregnant = scenario.startsWith('pregnant');
  if (pregnant) { minAge = 23; maxAge = 41; }
  // Variante de salida de emergencia: pasajero no apto que la pide
  let exitVariant = null;
  if (overlay === 'exit_restricted') {
    exitVariant = scenario.startsWith('minor') || scenario === 'um_missing' ? 'minor' : pregnant ? 'pregnant' : pick(['WCHR', 'PETC', 'DEAF', 'lang', 'lang']);
    if (exitVariant === 'WCHR') { minAge = 68; maxAge = 84; }
    if (exitVariant === 'lang' && scenario !== 'ok') exitVariant = 'DEAF';
    if (exitVariant === 'lang') nat = 'BR';
  }
  const p = makePerson(nat, today, minAge, maxAge, pregnant || LEGAL[scenario]?.female ? 'F' : null);
  const isMinor = p.age < 18;

  // Reserva
  const fareKey = isMinor ? pick(['STANDARD', 'FLEX'])
    : pick(['LIGHT', 'STANDARD', 'STANDARD', 'STANDARD', 'FLEX', 'BUSINESS']);
  const returnDate = addDays(today, rnd(6, 28));
  const fare = FARES[fareKey];
  const booking = {
    pnr: pnrCode(),
    ticket: AIRLINE.ticketPrefix + randomDigits(10),
    first: p.first, last: p.last,
    title: isMinor && p.age < 12 ? (p.sex === 'M' ? 'MSTR' : 'MISS') : (p.sex === 'M' ? 'MR' : (chance(0.5) ? 'MRS' : 'MS')),
    flight, date: today, origin: STATION.code, returnDate: ['no_return', 'return_resident'].includes(scenario) ? null : returnDate,
    fare: fareKey, fareLabel: fare.label, cabin: fare.cabin,
    ssr: [],
  };
  if (chance(0.12)) booking.ssr.push('VGML');

  // Documentos
  const docs = [];
  const rule = ENTRY_RULES[flight.country];
  const idAllowed = (nat === flight.country || rule.idCardOk.includes(nat)) && !!COUNTRIES[nat].idName;
  let passport = null, idDoc = null;

  const validExpiry = () => addDays(returnDate, rnd(200, 3000));
  switch (scenario) {
    case 'dni_ok':
      idDoc = makeId(p, today);
      if (idDoc.expiry < addMonths(returnDate, 4)) idDoc.expiry = addYears(idDoc.issue, 15);
      docs.push(idDoc);
      break;
    case 'dni_wrong':
      idDoc = makeId(p, today); docs.push(idDoc);
      break;
    case 'expired': {
      const exp = addDays(today, -rnd(3, 240));
      if (idAllowed && chance(0.4)) { idDoc = makeId(p, today, { expiry: exp }); docs.push(idDoc); }
      else { passport = makePassport(p, today, { expiry: exp }); docs.push(passport); }
      break;
    }
    case 'validity_stay': {
      const span = Math.max(2, Math.floor((returnDate - today) / 864e5) - 2);
      passport = makePassport(p, today, { expiry: addDays(today, rnd(2, span)) });
      docs.push(passport);
      break;
    }
    case 'validity_es':
      passport = makePassport(p, today, { expiry: addDays(returnDate, rnd(6, 80)) });
      docs.push(passport);
      break;
    case 'dom_license': case 'dom_license_expired':
      docs.push({ type: 'DRIVER_LICENSE', country: 'AR', nationality: 'AR', first: p.first, last: p.last, sex: p.sex, dob: p.dob, face: { ...p.face }, number: dniFor(p.age), expiry: scenario === 'dom_license' ? addDays(today, rnd(120, 1500)) : addDays(today, -rnd(20, 400)) });
      break;
    case 'dom_police':
      docs.push({ type: 'POLICE_REPORT', country: 'AR', nationality: 'AR', first: p.first, last: p.last, sex: p.sex, dob: p.dob, number: `${rnd(10000, 99999)}/${today.getFullYear()}`, dni: dniFor(p.age), station: rnd(1, 15), robbery: chance(0.6), issue: addDays(today, -rnd(0, 3)), expiry: addDays(today, 30) });
      break;
    case 'dom_tramite': {
      const n = dniFor(p.age);
      docs.push({ type: 'DNI_TRAMITE', country: 'AR', nationality: 'AR', first: p.first, last: p.last, sex: p.sex, dob: p.dob, face: { ...p.face }, number: n, tramite: randomDigits(11), expiry: addDays(today, rnd(20, 80)) });
      break;
    }
    case 'dom_nodoc':
      break;
    case 'visa_oldpp': {
      const oldExp = addDays(today, -rnd(30, 900));
      const oldPass = makePassport(p, today, { expiry: oldExp, old: true });
      passport = makePassport(p, today, { issue: addDays(today, -rnd(20, 300)) });
      const visa = makeVisaUS(p, oldPass, today);
      visa.issue = addDays(oldPass.issue, rnd(300, 2500));
      visa.expiry = addYears(visa.issue, 10);
      if (visa.expiry < addDays(returnDate, 30)) { visa.issue = addDays(oldExp, -rnd(60, 400)); visa.expiry = addYears(visa.issue, 10); }
      docs.push(passport, oldPass, visa);
      break;
    }
    default: {
      passport = makePassport(p, today, { expiry: validExpiry() });
      if (passport.issue > today) passport.issue = addDays(today, -rnd(30, 300));
      // Muchos argentinos viajan con pasaporte y DNI
      if (nat === 'AR' && chance(0.45)) {
        idDoc = makeId(p, today);
        if (idDoc.expiry < addMonths(returnDate, 4)) idDoc.expiry = addYears(idDoc.issue, 15);
      }
      if (isMinor && idAllowed && chance(0.5)) { docs.push(idDoc || (idDoc = makeId(p, today))); if (idDoc.expiry < returnDate) idDoc.expiry = addYears(idDoc.issue, 15); }
      else { docs.push(passport); if (idDoc) docs.push(idDoc); }
    }
  }

  // Visas / autorizaciones
  let hasEsta = true;
  const visaType = rule.visa[nat];
  if (scenario === 'return_resident') {
    docs.push({ type: 'RESIDENCE', country: flight.country, first: p.first, last: p.last, nationality: nat, face: { ...p.face }, number: flight.country === 'US' ? `${pick(['SRC', 'IOE', 'MSC'])}${randomDigits(10)}` : `${pick(['X', 'Y', 'Z'])}${randomDigits(7)}${pick(['A', 'K', 'T', 'L'])}`, expiry: addYears(today, rnd(2, 9)) });
  }
  if (visaType === 'VISA_US' && scenario !== 'visa_oldpp' && scenario !== 'return_resident' && passport) {
    if (scenario === 'no_visa') { /* sin visa */ }
    else docs.push(makeVisaUS(p, passport, today, { expired: scenario === 'visa_expired' }));
  }
  if (visaType === 'EVISA_BR' && passport && scenario !== 'us_br_noevisa') docs.push(makeEvisaBR(p, passport, today));
  if (rule.esta.includes(nat) && scenario === 'no_esta') hasEsta = false;

  if (isMinor) {
    if (!idDoc) idDoc = makeId(p, today);
    if (scenario === 'minor_ok' || scenario === 'um_missing') docs.push(makeAuth(p, idDoc, today, flight));
    if (scenario === 'minor_noauth' && chance(0.5)) docs.push(makeAuth(p, idDoc, today, flight, { expired: true }));
    if (scenario === 'minor_ok' && p.age <= UM_POLICY.mandatoryTo) booking.ssr.push('UMNR');
    if (scenario === 'minor_ok' && p.age > UM_POLICY.mandatoryTo && chance(0.4)) booking.ssr.push('UMNR');
  }

  // Pasajera gestante
  let weeks = null;
  if (pregnant) {
    weeks = { pregnant_ok: rnd(14, PREGNANCY.freeUntil), pregnant_cert: rnd(PREGNANCY.freeUntil + 1, PREGNANCY.certUntil), pregnant_nocert: rnd(PREGNANCY.freeUntil + 2, PREGNANCY.certUntil), pregnant_39: rnd(39, 40) }[scenario];
    const certDoc = idDoc || passport;
    if (scenario === 'pregnant_cert') docs.push(makeMedCert(p, certDoc, flight, today, weeks));
    if (scenario === 'pregnant_39' && chance(0.6)) docs.push(makeMedCert(p, certDoc, flight, today, weeks));
    if (scenario === 'pregnant_nocert' && chance(0.75)) docs.push(makeMedCert(p, certDoc, flight, today, weeks, pick(['old', 'spec', 'nofit'])));
  }

  // Problemas de reserva / identidad
  if (scenario === 'impostor') {
    const fake = differentFace(p.face, nat);
    fake.age -= 3;
    docs.filter((d) => d.face).forEach((d) => { d.face = fake; });
  }
  if (scenario === 'name_typo') typoName(booking);
  if (scenario === 'no_ticket') booking.ticket = null;
  if (scenario === 'wrong_date') booking.date = chance(0.5) ? addDays(today, 1) : addDays(today, -1);

  // Equipaje
  const bags = [];
  let fareFinal = fareKey;
  const nBags = { LIGHT: 0, STANDARD: chance(0.8) ? 1 : 0, FLEX: rnd(1, 2), BUSINESS: rnd(1, 2) }[fareKey];
  for (let i = 0; i < nBags; i++) bags.push({ weight: rndf(9, fareKey === 'BUSINESS' ? 30 : 22.8), dg: null });
  let dgItem = null, valuables = null, pet = null, sword = false, dryIce = null, firearm = null, avih = null;
  const ensureYFare = (k = 'STANDARD') => {
    if (booking.cabin === 'J' || booking.fare === 'LIGHT') { fareFinal = k; Object.assign(booking, { fare: k, fareLabel: FARES[k].label, cabin: 'Y' }); }
  };
  switch (overlay) {
    case 'overweight':
      ensureYFare();
      if (!bags.length) bags.push({ weight: 0 });
      bags[0].weight = rndf(23.6, 31.4);
      break;
    case 'heavy':
      ensureYFare();
      if (!bags.length) bags.push({ weight: 0 });
      bags[0].weight = rndf(33.2, 38.5);
      break;
    case 'extra_bag':
      Object.assign(booking, { fare: 'STANDARD', fareLabel: 'Standard', cabin: 'Y' }); fareFinal = 'STANDARD';
      bags.length = 0; bags.push({ weight: rndf(14, 22.5) }, { weight: rndf(10, 21) });
      break;
    case 'light_bag':
      Object.assign(booking, { fare: 'LIGHT', fareLabel: 'Light', cabin: 'Y' }); fareFinal = 'LIGHT';
      bags.length = 0; bags.push({ weight: rndf(12, 22) });
      break;
    case 'dg':
      if (!bags.length) { ensureYFare(); bags.push({ weight: rndf(12, 21) }); }
      dgItem = pick(['un power bank (batería externa)', 'un cigarrillo electrónico', 'dos baterías de litio de repuesto de la cámara', 'un encendedor y un aerosol grande', 'una garrafita de gas butano para el camping']);
      break;
    case 'limited_release':
      if (!bags.length) { ensureYFare(); bags.push({ weight: rndf(12, 21) }); }
      bags[0].cond = pick([
        { kind: 'film', desc: 'Valija envuelta en film plástico' },
        { kind: 'box', desc: 'Caja de cartón cerrada con cinta (equipaje no convencional)' },
        { kind: 'damaged', desc: 'Valija con una rueda rota y la manija floja' },
        { kind: 'sport', desc: 'Bolso con tabla de snowboard, sin estuche rígido pero bien embalado' },
      ]);
      break;
    case 'valuables':
      if (!bags.length) { ensureYFare(); bags.push({ weight: rndf(12, 21) }); }
      valuables = pick(['una notebook', 'una cámara de fotos profesional', 'joyas y algo de efectivo']);
      break;
    case 'pet':
      // Mascota en cabina (Guía U4): perros, gatos, peces, tortugas y aves (no rapaces), máx. 8 kg con transportín
      pet = pick([
        { species: 'gata', name: 'Mishi', kg: 5.4, ok: true, why: 'Gata de 5,4 kg con transportín: dentro de los 8 kg permitidos.' },
        { species: 'caniche', name: 'Toto', kg: 6.8, ok: true, why: 'Perro de 6,8 kg con transportín: aceptable en cabina (máx. 8 kg).' },
        { species: 'perro labrador', name: 'Bruno', kg: 31, ok: false, why: 'Supera los 8 kg con transportín: no puede viajar en cabina (solo en bodega como AVIH, con canil reglamentario y reserva previa).' },
        { species: 'iguana', name: 'Ramón', kg: 2.1, ok: false, why: 'Solo se aceptan en cabina perros, gatos, peces, tortugas y aves (excepto rapaces). Una iguana no.' },
        { species: 'halcón', name: 'Thor', kg: 1.3, ok: false, why: 'Las aves de rapiña no se aceptan en cabina.' },
      ]);
      break;
    case 'samurai':
      if (!bags.length) { ensureYFare(); bags.push({ weight: rndf(12, 21) }); }
      sword = true;
      break;
    case 'firearm':
      if (nat !== 'AR' || scenario !== 'ok' || flight.country !== 'AR') break;
      if (!bags.length) { ensureYFare(); bags.push({ weight: rndf(12, 21) }); }
      firearm = FIREARMS.find((f) => f.id === entry.variant) || pick(FIREARMS);
      docs.push(...firearmDocs(p, firearm, today));
      break;
    case 'avih':
      if (!['ok', 'dni_ok', 'visa_oldpp'].includes(scenario)) break;
      avih = AVIH.find((x) => x.id === entry.variant) || pick(AVIH);
      docs.push(...avihDocs(p, avih, today));
      break;
    case 'dry_ice':
      if (!bags.length) { ensureYFare(); bags.push({ weight: rndf(14, 22) }); }
      dryIce = rndf(3.5, 6, 1);
      break;
  }
  bags.forEach((b) => { b.cond = b.cond || { kind: 'ok', desc: 'Sin daños, ruedas y manijas en buen estado' }; });
  booking.fare = fareFinal;
  const fareObj = FARES[booking.fare];
  booking.allowanceText = fareObj.pieces === 0 ? 'solo equipaje de mano (sin valija despachada)' : `${fareObj.pieces} pieza${fareObj.pieces > 1 ? 's' : ''} de hasta ${fareObj.kg} kg`;

  // Asiento
  let seatPref = pick([null, 'window', 'aisle', 'window', 'aisle']);
  if (overlay === 'exit_restricted') {
    seatPref = 'exit';
    if (['WCHR', 'PETC', 'DEAF'].includes(exitVariant)) booking.ssr.push(exitVariant);
  }
  // Idiomas que habla el pasajero (requisito de salida de emergencia: español o inglés)
  const LANGS = { AR: ['es'], UY: ['es'], CL: ['es'], ES: ['es'], US: ['en'], BR: ['pt', 'es'] };
  const speaks = LANGS[nat].slice();
  if (exitVariant === 'lang' || (nat === 'BR' && chance(0.3))) speaks.splice(1);
  if (chance(0.25) && !speaks.includes('en') && exitVariant !== 'lang') speaks.push('en');

  // Rostro en vivo (cambios de look legítimos)
  const live = { ...p.face };
  if (overlay === 'face_change') {
    live.glasses = !live.glasses;
    live.hairColor = pick(Object.values(HAIR).filter((h) => h !== live.hairColor));
  }

  const pax = {
    id: Math.random().toString(36).slice(2, 9),
    scenario, overlay, ...p, face: live, isMinor, flight, booking, docs, hasEsta, bags, dgItem, valuables, seatPref,
    weeks, drunk: scenario === 'drunk', speaks, exitVariant, pet, sword, dryIce, firearm, avih,
  };
  if (pax.drunk) pax.face.flushed = true;
  if (firearm) pax.face.accessory = 'guncase';
  if (avih) pax.face.accessory = 'kennel';
  if (pax.weeks >= 20) pax.face.pregnant = true;
  if (FAMILY[scenario]) buildParty(pax, scenario, today, flight, idAllowed);
  if (LEGAL[scenario]) buildLegal(pax, scenario, today, flight);
  pax.docs.forEach((d) => { if (!d.owner) { d.owner = 'lead'; if (pax.party) d.ownerName = pax.first; } });
  pax.docs.push({ type: 'BOOKING', booking });
  pax.docs.forEach((d, i) => { d.id = `${pax.id}-${i}`; });
  pax.lang = paxLang(pax);
  if (pax.legal && pax.legal.type !== 'DEPU') pax.lang = 'es'; // hablan los escoltas
  // ¿Aceptaría ser voluntario en una sobreventa? (adultos sin compromisos urgentes)
  pax.flexible = !isMinor && !pax.weeks && !pax.drunk && !pax.pet && !pax.party && !['vip_angry', 'angry_cat2', 'bomb_joke'].includes(scenario) && !pax.legal && chance(0.45);
  pax.lines = checkinLines(pax);
  return pax;
}

// ------------------------------------------------------------------
// Familias: padres, hijos, infantes y la abuela
// ------------------------------------------------------------------
const fullName = (p) => `${p.first} ${p.last}`;
const dniFor = (age) => String(Math.max(6000000, (new Date().getFullYear() - age - 1945) * 780000 + rnd(0, 700000)));

function makeKid(today, age, last, nat = 'AR') {
  const sex = chance(0.5) ? 'M' : 'F';
  const dob = age === 0 ? addDays(today, -rnd(70, 330)) : addDays(addYears(today, -age), -rnd(1, 360));
  const face = randomFace(sex, Math.max(age, 3), nat);
  // Chicos: rasgos suaves (sin anteojos ni barba, cejas finas); bebés con un mechoncito, nunca el cerquillo de calvo
  Object.assign(face, { age, glasses: false, beard: false, brows: 'thin' });
  if (face.hairStyle === 'bald') face.hairStyle = 'short';
  if (age < 2) Object.assign(face, { hairStyle: 'baby', shape: 'round', nose: 2, smile: true, shirt: pick(['#f4b6c2', '#a7d8f0', '#fff3b0']) });
  return { sex, first: pick(NAMES.AR[sex]).split(' ')[0], last, dob, age: ageOn(dob, today), nationality: nat, face };
}
function kidDoc(kid, today, passportNeeded) {
  if (passportNeeded) {
    const d = makePassport(kid, today);
    if (kid.age < 2) { d.issue = addDays(kid.dob, rnd(10, 40)); d.expiry = addYears(d.issue, 5); }
    return d;
  }
  const d = makeId(kid, today);
  d.number = dniFor(kid.age);
  if (kid.age < 8 || d.issue < kid.dob || d.issue > today) { d.issue = addDays(kid.dob, rnd(10, 40)); d.expiry = addYears(d.issue, 15); }
  return d;
}
function makeBirthCert(kid, father, mother) {
  return {
    type: 'BIRTH_CERT', first: kid.first, last: kid.last, dob: kid.dob, place: pick(['CIUDAD AUTÓNOMA DE BUENOS AIRES', 'LA PLATA', 'CÓRDOBA', 'ROSARIO']),
    father: fullName(father), fatherDoc: father.doc, mother: fullName(mother), motherDoc: mother.doc,
    acta: rnd(100, 2400), tomo: rnd(1, 30),
  };
}
function makePartyAuth(kid, kidDocNumber, today, flight, { mode, signers, companion, expired = false }) {
  const issue = expired ? addDays(today, -rnd(400, 700)) : addDays(today, -rnd(5, 200));
  return {
    type: 'AUTH_MINOR', mode, first: kid.first, last: kid.last, minorDoc: kidDocNumber,
    parent1: signers[0] ? fullName(signers[0]) : null, parent1Doc: signers[0]?.doc,
    parent2: signers[1] ? fullName(signers[1]) : null, parent2Doc: signers[1]?.doc,
    companion: companion ? fullName(companion) : null, companionDoc: companion?.doc,
    destination: chance(0.5) ? 'TODOS LOS PAÍSES' : COUNTRIES[flight.country].name.toUpperCase(),
    notary: rnd(100, 2400), issue, expiry: expired ? addDays(today, -rnd(10, 300)) : addYears(issue, 1),
  };
}

const OTHER_DEST = ['REPÚBLICA ORIENTAL DEL URUGUAY', 'REPÚBLICA DEL PARAGUAY', 'ESTADO PLURINACIONAL DE BOLIVIA', 'REPÚBLICA DEL PERÚ'];
const CONSULATES = ['MADRID', 'BARCELONA', 'MIAMI', 'NUEVA YORK', 'ROMA', 'SÃO PAULO', 'SANTIAGO DE CHILE'];
function makeDeathCert(parent, today) {
  return {
    type: 'DEATH_CERT', first: parent.first, last: parent.last, doc: parent.doc,
    dod: addDays(today, -rnd(200, 2600)), place: pick(['CIUDAD AUTÓNOMA DE BUENOS AIRES', 'LA PLATA', 'QUILMES', 'MORÓN', 'CÓRDOBA']),
    acta: rnd(100, 2400), tomo: rnd(1, 30),
  };
}
function makeCourtAuth(kid, kidDocNumber, today, flight, { absent, companion, wrongDest }) {
  const issue = addDays(today, -rnd(10, 120));
  return {
    type: 'COURT_AUTH', first: kid.first, last: kid.last, minorDoc: kidDocNumber,
    absent: fullName(absent), companion: fullName(companion), companionDoc: companion.doc,
    destination: wrongDest ? pick(OTHER_DEST.filter((d) => !d.includes(COUNTRIES[flight.country].name.toUpperCase()))) : COUNTRIES[flight.country].name.toUpperCase(),
    court: rnd(1, 110), expte: `${rnd(10000, 99999)}/${today.getFullYear() - 1}`, issue, expiry: addYears(issue, 1),
  };
}
function makeGuardianship(kids, tutor, today) {
  return {
    type: 'GUARDIANSHIP', kids: kids.map((k) => fullName(k)), tutor: fullName(tutor), tutorDoc: tutor.doc,
    court: rnd(1, 110), expte: `${rnd(10000, 99999)}/${today.getFullYear() - rnd(2, 6)}`, issue: addDays(today, -rnd(400, 2000)),
  };
}

function buildParty(pax, scenario, today, flight, idAllowed) {
  const relation = FAMILY[scenario];
  const passportNeeded = !idAllowed;
  const leadDoc = pax.docs.find((d) => d.type === 'ID')?.number || dniFor(pax.age);
  const lead = { first: pax.first, last: pax.last, sex: pax.sex, doc: leadDoc };
  let father, mother, other = null, grand = null;
  if (relation === 'relative' || relation === 'guardian') {
    grand = lead;
    const fLast = pick(NAMES.AR.last);
    father = { first: pick(NAMES.AR.M), last: fLast, sex: 'M', doc: dniFor(38) };
    mother = { first: pick(NAMES.AR.F), last: pax.last, sex: 'F', doc: dniFor(36) };
  } else if (pax.sex === 'M') {
    father = lead;
    mother = { first: pick(NAMES.AR.F), last: pick(NAMES.AR.last.filter((l) => l !== pax.last)), sex: 'F', doc: dniFor(pax.age - 2) };
  } else {
    mother = lead;
    father = { first: pick(NAMES.AR.M), last: pick(NAMES.AR.last.filter((l) => l !== pax.last)), sex: 'M', doc: dniFor(pax.age + 2) };
  }
  const kidLast = father.last;
  const members = [];
  // Otro padre que viaja (familia completa)
  if (relation === 'both') {
    const otherP = pax.sex === 'M' ? mother : father;
    const op = makePerson('AR', today, Math.max(26, pax.age - 4), pax.age + 4, otherP.sex);
    Object.assign(op, { first: otherP.first, last: otherP.last });
    const d = idAllowed && chance(0.6) ? makeId(op, today) : makePassport(op, today, { expiry: addDays(today, rnd(600, 3000)) });
    if (d.type === 'ID') { d.number = otherP.doc; if (d.expiry < addDays(today, 200)) d.expiry = addYears(today, 6); }
    other = { key: 'p2', role: 'parent', ...op, isMinor: false, isInfant: false, docs: [d] };
    members.push(other);
  }
  // Menores
  const kids = [];
  const wantsInfant = { infant_nodoc: true, infant_nobooking: true, family_ok: chance(0.5), one_parent_ok: chance(0.4) }[scenario];
  const wantsChild = !['infant_nodoc', 'infant_nobooking'].includes(scenario) || chance(0.4);
  if (wantsChild) kids.push(makeKid(today, relation === 'relative' || relation === 'guardian' ? rnd(6, 15) : rnd(4, 12), kidLast));
  if (relation === 'guardian' && chance(0.4)) kids.push(makeKid(today, rnd(4, 9), kidLast));
  if (wantsInfant) kids.push(makeKid(today, 0, kidLast));
  kids.forEach((k, i) => {
    const isInfant = k.age < 2;
    const m = { key: `k${i + 1}`, role: isInfant ? 'infant' : 'child', ...k, isMinor: true, isInfant, docs: [] };
    const noDoc = scenario === 'infant_nodoc' && isInfant;
    let doc = null;
    if (!noDoc) { doc = kidDoc(k, today, passportNeeded); m.docs.push(doc); }
    const docNumber = doc?.number || '—';
    if (relation === 'both' && !(scenario === 'family_nobirth' && !isInfant)) m.docs.push(makeBirthCert(k, father, mother));
    const reason = ABSENT[scenario];
    const absent = pax.sex === 'M' ? mother : father;
    if (reason === 'deceased' || (relation === 'guardian' && scenario === 'tutor_nocert' && chance(0.5))) m.docs.push(makeBirthCert(k, father, mother));
    if (reason === 'court') m.docs.push(makeCourtAuth(k, docNumber, today, flight, { absent, companion: lead, wrongDest: scenario === 'court_wrong' }));
    if (reason === 'abroad') {
      const a = makePartyAuth(k, docNumber, today, flight, { mode: scenario === 'consul_letter' ? 'letter' : 'consular', signers: [absent], companion: lead });
      a.consulate = pick(CONSULATES);
      m.docs.push(a);
    }
    if (relation === 'one' && !reason) {
      const bad = scenario === 'one_parent_noauth';
      if (!bad || chance(0.4)) m.docs.push(makePartyAuth(k, docNumber, today, flight, { mode: 'one', signers: [absent], companion: lead, expired: bad }));
    }
    if (relation === 'relative') {
      const signers = scenario === 'relative_noauth' ? [mother] : [father, mother];
      m.docs.push(makePartyAuth(k, docNumber, today, flight, { mode: 'relative', signers, companion: grand }));
    }
    members.push(m);
  });
  members.forEach((m) => m.docs.forEach((d) => { d.owner = m.key; d.ownerName = m.first; }));
  // Documentos del adulto a cargo (quedan con el titular)
  const absentP = pax.sex === 'M' ? mother : father;
  if (scenario === 'deceased_ok') pax.docs.push({ ...makeDeathCert(absentP, today), owner: 'lead', ownerName: fullName(absentP) });
  if (scenario === 'tutor_ok') pax.docs.push({ ...makeGuardianship(kids, lead, today), owner: 'lead', ownerName: pax.first });
  members.forEach((m) => { pax.docs.push(...m.docs); delete m.docs; });

  const infant = members.find((m) => m.isInfant);
  pax.party = {
    relation, absent: ABSENT[scenario] || null, members, father: { ...father, travels: relation === 'both' || father === lead }, mother: { ...mother, travels: relation === 'both' || mother === lead },
    companion: fullName(lead), hasInfant: !!infant, infantInBooking: !!infant && scenario !== 'infant_nobooking',
  };
  pax.party.seatHolders = 1 + members.filter((m) => !m.isInfant).length;
  // Reserva con todos los nombres
  const b = pax.booking;
  b.party = members.filter((m) => !m.isInfant || pax.party.infantInBooking).map((m) => ({
    first: m.first, last: m.last, title: m.isInfant ? 'INF' : m.isMinor && m.age < 12 ? (m.sex === 'M' ? 'MSTR' : 'MISS') : m.sex === 'M' ? 'MR' : 'MRS',
  }));
  if (pax.party.infantInBooking) b.ssr.push('INF');
  if (b.fare === 'LIGHT' || b.fare === 'BUSINESS') Object.assign(b, { fare: 'STANDARD', fareLabel: 'Standard', cabin: 'Y', allowanceText: '1 pieza de hasta 23 kg (por pasajero)' });
  // Equipaje de la familia y cochecito
  pax.bags = Array.from({ length: rnd(2, 3) }, () => ({ weight: rndf(11, 22.5), dg: null, cond: { kind: 'ok', desc: 'Sin daños, ruedas y manijas en buen estado' } }));
  if (infant) pax.face.accessory = 'stroller';
  pax.seatPref = 'together';
  pax.flexible = false;
}

// ------------------------------------------------------------------
// Detenidos y deportados: escoltas, credenciales y orden judicial / de expulsión
// ------------------------------------------------------------------
const AGENCY = {
  DEPA: ['POLICÍA FEDERAL ARGENTINA', 'INTERPOL · OCN BUENOS AIRES', 'GENDARMERÍA NACIONAL ARGENTINA'],
  DEPO: ['POLICÍA FEDERAL ARGENTINA · DEPARTAMENTO EXTRANJERÍA'],
  priv: 'SEGURIDAD PRIVADA "ESCUDO S.R.L."',
};
export function makeEscort(sex, agency, today, flight, key) {
  const p = makePerson('AR', today, 29, 54, sex);
  const passport = makePassport(p, today);
  const docs = [passport];
  if (ENTRY_RULES[flight.country].visa.AR === 'VISA_US') docs.push(makeVisaUS(p, passport, today));
  docs.push({ type: 'ESCORT_ID', first: p.first, last: p.last, agency, face: { ...p.face }, rank: pick(['Sargento', 'Cabo 1°', 'Subinspector', 'Inspector', 'Oficial Principal']), number: String(rnd(10000, 99999)), expiry: addYears(today, rnd(1, 4)) });
  return { key, role: 'escort', ...p, agency, isMinor: false, isInfant: false, docs };
}
function buildLegal(pax, scenario, today, flight) {
  const L = LEGAL[scenario];
  const b = pax.booking;
  const dep = flight.depTime || new Date(today.getTime() + 20 * 3600e3);
  // Reserva: el DEPA necesita 24 h; el deportado no tiene límite (reservado hace horas, a propósito)
  b.created = new Date(dep.getTime() - (L.type === 'DEPA' ? (L.late ? rnd(5, 16) : rnd(50, 140)) : rnd(4, 20)) * 3600e3);
  pax.legal = { type: L.type, cuffed: chance(0.6), otherDepa: L.second ? `PNR ${randomLetters(6)}` : null };
  if (L.type === 'DEPA') b.ssr.push('DEPA');
  if (L.type === 'DEPU') b.ssr.push('DEPU');
  const order = {
    type: 'LEGAL_ORDER', kind: L.type, first: pax.first, last: pax.last, nationality: pax.nationality, flightNo: flight.no, dest: flight.city,
    date: today, number: `${rnd(1000, 9999)}/${today.getFullYear()}`, court: rnd(1, 12), escorts: [],
  };
  if (L.type === 'DEPU') {
    pax.docs.push(order);
    pax.bags = [{ weight: rndf(12, 22), dg: null, cond: { kind: 'ok', desc: 'Sin daños, ruedas y manijas en buen estado' } }];
    return;
  }
  const n = L.escorts || (L.type === 'DEPA' ? 2 : 1);
  const opp = pax.sex === 'M' ? 'F' : 'M';
  let sexes;
  if (L.type === 'DEPA') sexes = L.maleEscorts ? ['M', 'M'] : pax.sex === 'F' ? ['F', pick(['M', 'F'])] : ['M', pick(['M', 'M', 'F'])];
  else sexes = [L.wrongSex ? opp : pax.sex];
  sexes = sexes.slice(0, n);
  const agency = L.priv ? AGENCY.priv : pick(AGENCY[L.type]);
  const members = sexes.map((sx, i) => makeEscort(sx, agency, today, flight, `e${i + 1}`));
  order.escorts = members.map((m) => `${m.first} ${m.last}`);
  order.agency = agency;
  pax.docs.push(order);
  members.forEach((m) => m.docs.forEach((d) => { d.owner = m.key; d.ownerName = m.first; }));
  members.forEach((m) => { pax.docs.push(...m.docs); delete m.docs; });
  pax.party = { relation: 'custody', members, companion: order.escorts.join(' y '), hasInfant: false, infantInBooking: false, seatHolders: 1 + members.length };
  b.party = members.map((m) => ({ first: m.first, last: m.last, title: m.sex === 'M' ? 'MR' : 'MRS' }));
  if (b.fare === 'LIGHT' || b.fare === 'BUSINESS') Object.assign(b, { fare: 'STANDARD', fareLabel: 'Standard', cabin: 'Y', allowanceText: '1 pieza de hasta 23 kg (por pasajero)' });
  pax.bags = members.map(() => ({ weight: rndf(9, 19), dg: null, cond: { kind: 'ok', desc: 'Sin daños, ruedas y manijas en buen estado' } }));
  pax.seatPref = null;
}

export function makeMedCert(p, doc, flight, today, weeks, defect = null) {
  const issue = addDays(today, defect === 'old' ? -rnd(14, 35) : -rnd(1, 8));
  return {
    type: 'MED_CERT', first: p.first, last: p.last, docNumber: doc?.number || '—',
    route: `${STATION.code} – ${flight.dest}`, flightNo: flight.no, travelDate: today, weeks, issue, expiry: addDays(issue, 10),
    doctor: `Dr${chance(0.5) ? 'a' : ''}. ${pick(NAMES.AR.last)}`, specialty: defect === 'spec' ? 'Medicina General' : PREGNANCY.specialty,
    license: `MN ${rnd(60000, 150000)}`, fit: defect !== 'nofit', defect,
  };
}
