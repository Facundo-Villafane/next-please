// Motor de reglas: determina qué corresponde con cada pasajero y evalúa la atención del agente.
import { ENTRY_RULES, FARES, BAG_FEES, UM_POLICY, SEATMAP, INAD_FINE, COUNTRIES, EXIT_ROW, PREGNANCY, STATION, DOMESTIC_DOCS } from './data.js';
import { dayOnly, sameDay, addMonths, addDays, fmtDate, fmtTime, norm } from './util.js';
import { docTitle } from './docs.js';
import { gradeRestricted } from './restricted.js';

export const REASONS = {
  DOC_EXPIRED: { kind: 'reject', label: 'Documento de viaje vencido' },
  DOC_VALIDITY: { kind: 'reject', label: 'Validez del documento insuficiente para el destino' },
  DOC_TYPE: { kind: 'reject', label: 'Tipo de documento no válido para el destino' },
  VISA: { kind: 'reject', label: 'Sin visa o visa no vigente' },
  ESTA: { kind: 'reject', label: 'Autorización electrónica (ESTA) no aprobada' },
  IDENTITY: { kind: 'reject', label: 'La persona no coincide con el documento (posible impostor)' },
  MINOR_AUTH: { kind: 'reject', label: 'Menor sin autorización de viaje válida (notarial, judicial o consular)' },
  PARENT_DEATH: { kind: 'reject', label: 'Progenitor fallecido sin certificado de defunción' },
  GUARDIAN: { kind: 'reject', label: 'Tutor/a sin certificado judicial de tutela' },
  PREGNANCY: { kind: 'reject', label: 'Pasajera gestante: fuera de semanas permitidas o sin certificado médico válido' },
  RETURN: { kind: 'reject', label: 'Sin pasaje de regreso o de continuación (visitante no residente)' },
  LEGAL: { kind: 'reject', label: 'Pasajero con condición legal: no cumple las condiciones de transporte' },
  INSUB: { kind: 'reject', label: 'Pasajero insubordinado (CAT 2 / CAT 3)' },
  ALCOHOL: { kind: 'reject', label: 'Pasajero bajo efectos del alcohol (riesgo para el vuelo)' },
  FILIATION: { kind: 'reject', label: 'Menor con ambos padres sin partida de nacimiento' },
  INF_BOOKING: { kind: 'derive', label: 'Infante no incluido en la reserva → Ventas' },
  NO_TICKET: { kind: 'derive', label: 'Reserva sin boleto emitido → Ventas' },
  NAME: { kind: 'derive', label: 'Nombre del boleto no coincide con el documento → Ventas' },
  DATE: { kind: 'derive', label: 'Reserva para otra fecha → Ventas' },
  CLOSED: { kind: 'derive', label: 'Check-in cerrado → Ventas / reprogramación' },
  UM: { kind: 'derive', label: 'Menor requiere servicio UM no contratado → Ventas' },
};

export const isIdDoc = (d) => d.type === 'PASSPORT' || d.type === 'ID' || DOMESTIC_DOCS.includes(d.type);

export function acceptableTypes(nat, destCountry) {
  if (destCountry === STATION.country) return ['PASSPORT', ...(ENTRY_RULES.AR.idCardOk.includes(nat) ? ['ID'] : []), ...DOMESTIC_DOCS];
  if (nat === destCountry) return ['PASSPORT', 'ID'];
  return ENTRY_RULES[destCountry].idCardOk.includes(nat) ? ['PASSPORT', 'ID'] : ['PASSPORT'];
}

export function requiredUntil(pax) {
  const rule = ENTRY_RULES[pax.flight.country];
  if (pax.nationality === pax.flight.country) return dayOnly(pax.booking.date);
  const ret = pax.booking.returnDate || pax.booking.date;
  if (rule.validity.kind === 'afterReturn') return addMonths(ret, rule.validity.months);
  return ret;
}

// Documentos con los que el pasajero PUEDE viajar (válidos para APIS)
export function validTravelDocs(pax, today) {
  const types = acceptableTypes(pax.nationality, pax.flight.country);
  const req = requiredUntil(pax);
  return pax.docs.filter((d) => isIdDoc(d) && !d.old && types.includes(d.type) && d.expiry >= today && d.expiry >= req);
}

export function analyze(pax, now, { inGroup = false } = {}) {
  const today = dayOnly(now);
  const b = pax.booking, f = pax.flight, nat = pax.nationality;
  const rule = ENTRY_RULES[f.country];
  const blockers = [];
  const add = (code, why) => blockers.push({ code, kind: REASONS[code].kind, label: REASONS[code].label, why });

  if (!sameDay(b.date, today)) add('DATE', `La reserva es para el ${fmtDate(b.date)}, no para hoy (${fmtDate(today)}). Hay que derivar a Ventas para cambio de fecha o reprogramación.`);
  if (!b.ticket) add('NO_TICKET', 'La reserva no tiene boleto emitido (sin TKT). Una reserva sin pagar/emitir no se puede chequear: se deriva a Ventas.');
  if (now >= f.closeTime) add('CLOSED', `El check-in del ${f.no} cerró a las ${fmtTime(f.closeTime)} (${f.close} min antes de la salida). Pasado el cierre no se acepta: se deriva a Ventas para reprogramar.`);

  const ids = pax.docs.filter(isIdDoc);
  const types = acceptableTypes(nat, f.country);
  const candidates = ids.filter((d) => types.includes(d.type) && !d.old);
  if (!candidates.length) {
    add('DOC_TYPE', f.country === STATION.country
      ? `Vuelo de cabotaje: se requiere el documento de viaje vigente (DNI o pasaporte) o, por extravío o robo, licencia de conducir vigente, denuncia policial o certificado de trámite. El pasajero presenta: ${ids.map(docTitle).join(', ') || 'ningún documento (una foto del DNI en el celular no sirve)'}. Sin documento no puede embarcar.`
      : `${COUNTRIES[nat].name} → ${rule.name}: se requiere PASAPORTE. El pasajero solo presenta ${ids.map(docTitle).join(', ') || 'ningún documento válido'}.`);
  } else {
    const notExpired = candidates.filter((d) => d.expiry >= today);
    if (!notExpired.length) {
      add('DOC_EXPIRED', `El documento (${docTitle(candidates[0])}) venció el ${fmtDate(candidates[0].expiry)}. Un documento vencido no es válido para viajar.`);
    } else {
      const req = requiredUntil(pax);
      if (!notExpired.some((d) => d.expiry >= req)) {
        const d = notExpired[0];
        const why = rule.validity.kind === 'afterReturn'
          ? `${rule.name} exige validez de ${rule.validity.months} meses posteriores a la salida prevista (regreso ${fmtDate(b.returnDate)} → mínimo ${fmtDate(req)}). El documento vence el ${fmtDate(d.expiry)}.`
          : `El documento debe estar vigente durante toda la estadía (regreso ${fmtDate(b.returnDate)}), pero vence el ${fmtDate(d.expiry)}.`;
        add('DOC_VALIDITY', why);
      }
    }
  }

  const primary = candidates[0] || ids[0];
  if (primary && norm(`${b.first} ${b.last}`) !== norm(`${primary.first} ${primary.last}`)) {
    add('NAME', `En el boleto figura ${b.last.toUpperCase()}/${b.first.toUpperCase()} y en el documento ${primary.last.toUpperCase()}/${primary.first.toUpperCase()}. El nombre del boleto debe coincidir con el documento: se deriva a Ventas para corrección/revalidación.`);
  }

  if (pax.scenario === 'impostor') {
    add('IDENTITY', 'Los rasgos faciales (forma de cara, nariz, cejas, ojos, tono de piel) NO coinciden con la foto del documento. Posible uso de documento ajeno: no aceptar y dar aviso a Seguridad / PSA.');
  }

  // Residencia en el destino: exime de pasaje de regreso (y de visa, en EE.UU.)
  const residence = pax.docs.find((d) => d.type === 'RESIDENCE' && d.country === f.country && d.expiry >= today);
  if (nat !== f.country && rule.returnTicket && !b.returnDate && !residence) {
    add('RETURN', `Viaja solo ida a ${rule.name} como visitante y no es residente: se exige pasaje de regreso o de continuación de viaje. Migraciones de Argentina no controla este requisito, así que el control es del agente: no se acepta hasta que presente (o compre en Ventas) un pasaje de salida.`);
  }
  if (nat !== f.country && !residence) {
    const vt = rule.visa[nat];
    if (vt) {
      const visas = pax.docs.filter((d) => d.type === vt);
      const ok = visas.filter((v) => v.expiry >= today && pax.docs.some((d) => d.type === 'PASSPORT' && d.number === v.linkedPassport));
      const vname = vt === 'VISA_US' ? 'visa estadounidense' : 'e-Visa de Brasil';
      if (!visas.length) add('VISA', `${COUNTRIES[nat].name} requiere ${vname} para ingresar a ${rule.name} y el pasajero no la presenta.`);
      else if (!ok.length) add('VISA', `La ${vname} venció el ${fmtDate(visas[0].expiry)}.`);
    }
    if (rule.esta.includes(nat) && !pax.hasEsta) {
      add('ESTA', `${COUNTRIES[nat].name} integra el Programa de Exención de Visas: requiere ESTA aprobado. La respuesta APIS/iAPI indica "DO NOT BOARD – ESTA NOT FOUND".`);
    }
  }

  if (pax.isMinor && !inGroup) {
    const auth = pax.docs.find((d) => d.type === 'AUTH_MINOR');
    if (!auth) add('MINOR_AUTH', `Menor de ${pax.age} años que viaja sin sus padres: necesita Autorización de Viaje de ambos progenitores (escribano / Registro Civil). No la presenta.`);
    else if (auth.expiry < today) add('MINOR_AUTH', `La autorización de viaje venció el ${fmtDate(auth.expiry)}.`);
    if (pax.age >= UM_POLICY.mandatoryFrom && pax.age <= UM_POLICY.mandatoryTo && !pax.booking.ssr.includes('UMNR')) {
      add('UM', `Menor de ${pax.age} años viajando solo/a: el servicio de Menor No Acompañado (UMNR) es OBLIGATORIO entre ${UM_POLICY.mandatoryFrom} y ${UM_POLICY.mandatoryTo} años y no figura en la reserva.`);
    }
  }

  if (pax.weeks) {
    const cert = pax.docs.find((d) => d.type === 'MED_CERT');
    if (pax.weeks >= PREGNANCY.certUntil + 1) {
      add('PREGNANCY', `La pasajera cursa la semana ${pax.weeks}. Desde la semana ${PREGNANCY.certUntil + 1} no puede viajar, aunque tenga certificado médico.`);
    } else if (pax.weeks > PREGNANCY.freeUntil) {
      const problems = [];
      if (!cert) problems.push('no presenta certificado médico');
      else {
        const days = Math.round((dayOnly(pax.booking.date) - dayOnly(cert.issue)) / 864e5);
        if (days > PREGNANCY.certMaxDays) problems.push(`el certificado tiene ${days} días (máximo ${PREGNANCY.certMaxDays} días antes del viaje)`);
        if (cert.specialty !== PREGNANCY.specialty) problems.push(`lo firma un médico de ${cert.specialty}; debe ser gineco-obstetra`);
        if (!cert.fit) problems.push('no declara expresamente que está en condiciones de viajar en avión');
      }
      if (problems.length) add('PREGNANCY', `Semana ${pax.weeks} (entre la ${PREGNANCY.freeUntil + 1} y la ${PREGNANCY.certUntil}): requiere certificado médico / MEDIF válido, pero ${problems.join('; ')}.`);
    }
  }
  // Conducta: solo cuenta si el conflicto llegó a ocurrir en la atención
  if (pax.conflictHappened && pax.scenario === 'angry_cat2') add('INSUB', 'CAT 2: no acató las instrucciones del agente, gritó, insultó y empujó elementos del counter. Requiere apoyo del supervisor o de seguridad y no se acepta: el problema no se traslada al avión.');
  if (pax.conflictHappened && pax.scenario === 'bomb_joke') add('INSUB', 'CAT 3: insinuó llevar una bomba. Aunque diga que es un chiste, es una amenaza contra la seguridad de la operación: se interrumpe la atención, se avisa a la PSA y el pasajero no viaja.');
  if (pax.drunk) {
    add('ALCOHOL', 'Se observan varias señales a la vez: habla trabada, rostro congestionado, inestabilidad al moverse, respuestas incoherentes, no sigue instrucciones y se pone agresivo. Con dos o más señales, el pasajero no debe ser embarcado: puede descompensarse o no seguir instrucciones de seguridad.');
  }

  const expected = blockers.some((x) => x.kind === 'reject') ? 'reject' : blockers.length ? 'derive' : 'accept';
  return { blockers, expected, validDocs: validTravelDocs(pax, today) };
}

// Integrantes del grupo como "pasajeros" individuales (para documentos, APIS y asientos)
export function partyMembers(pax) {
  if (!pax.party) return [{ key: 'lead', first: pax.first, last: pax.last, pax }];
  const lead = { key: 'lead', role: 'lead', first: pax.first, last: pax.last, sex: pax.sex, age: pax.age, isMinor: false, isInfant: false, face: pax.face };
  return [lead, ...pax.party.members].map((m) => ({
    ...m,
    pax: {
      ...pax, ...m, party: null, scenario: 'ok', weeks: null, drunk: false, nationality: m.nationality || pax.nationality,
      docs: pax.docs.filter((d) => d.owner === m.key),
      booking: { ...pax.booking, first: m.first, last: m.last },
    },
  }));
}

export function analyzeParty(pax, now) {
  const today = dayOnly(now);
  const blockers = [];
  const seen = new Set();
  const add = (code, why) => blockers.push({ code, kind: REASONS[code].kind, label: REASONS[code].label, why });
  const members = partyMembers(pax);
  const validDocs = [];
  members.forEach((m) => {
    const an = analyze(m.pax, now, { inGroup: true });
    validDocs.push(...an.validDocs);
    an.blockers.forEach((b) => {
      if (['DATE', 'NO_TICKET', 'CLOSED'].includes(b.code)) { if (seen.has(b.code)) return; seen.add(b.code); blockers.push(b); return; }
      if (b.code === 'NAME' && m.key !== 'lead') return;
      const why = b.code === 'DOC_TYPE' && m.isInfant ? `${m.first} (infante) no presenta documento propio. Los infantes viajan con su propio DNI o pasaporte: no "en el documento" de los padres ni solo con la partida.` : `${m.first}: ${b.why}`;
      blockers.push({ ...b, why });
    });
  });
  const P = pax.party;
  const destName = COUNTRIES[pax.flight.country].name.toUpperCase();
  const once = new Set();
  const addOnce = (code, why) => { if (once.has(code)) return; once.add(code); add(code, why); };
  P.members.filter((m) => m.isMinor).forEach((m) => {
    const docs = pax.docs.filter((d) => d.owner === m.key);
    const auth = docs.find((d) => d.type === 'AUTH_MINOR');
    if (P.relation === 'both') {
      if (!docs.some((d) => d.type === 'BIRTH_CERT')) add('FILIATION', `${m.first} viaja con ambos padres: no requiere permiso, pero se presenta la partida de nacimiento (que acredita el vínculo) más su documento. No la presentan.`);
    } else if (P.relation === 'one' && P.absent) {
      const absent = P.father.travels ? P.mother : P.father;
      const absentName = `${absent.first} ${absent.last}`;
      if (P.absent === 'deceased') {
        const dc = pax.docs.find((d) => d.type === 'DEATH_CERT');
        if (!dc) addOnce('PARENT_DEATH', `Dicen que ${absentName} falleció, pero no presentan el certificado de defunción. Sin él no se acredita que el otro progenitor no puede autorizar: el menor no puede salir del país.`);
      } else if (P.absent === 'court') {
        const ca = docs.find((d) => d.type === 'COURT_AUTH');
        if (!ca) add('MINOR_AUTH', `${absentName} está ausente: hace falta la autorización del tribunal de familia para ${m.first}.`);
        else if (ca.expiry < today) add('MINOR_AUTH', `La autorización judicial para ${m.first} venció el ${fmtDate(ca.expiry)}.`);
        else if (ca.destination !== destName && ca.destination !== 'TODOS LOS PAÍSES') add('MINOR_AUTH', `La autorización del tribunal para ${m.first} es para viajar a ${ca.destination}, no a ${destName}. La autorización judicial vale solo para el destino que indica.`);
      } else if (P.absent === 'abroad') {
        if (!auth) add('MINOR_AUTH', `${absentName} está en el exterior: la autorización para ${m.first} se tramita a través del consulado argentino. No la presentan.`);
        else if (auth.mode !== 'consular') add('MINOR_AUTH', `Lo que presentan para ${m.first} es una carta simple firmada por ${absentName}, sin intervención del consulado. Si el progenitor está fuera del país, la autorización se tramita a través del consulado argentino.`);
        else if (auth.expiry < today) add('MINOR_AUTH', `La autorización consular para ${m.first} venció el ${fmtDate(auth.expiry)}.`);
      }
    } else if (P.relation === 'guardian') {
      if (!pax.docs.some((d) => d.type === 'GUARDIANSHIP')) addOnce('GUARDIAN', `${P.companion} dice tener la tutela de los chicos, pero no presenta el certificado del tribunal que la acredite. La partida de nacimiento o la palabra del adulto no alcanzan.`);
    } else if (P.relation === 'one') {
      const absent = P.father.travels ? P.mother : P.father;
      const absentName = `${absent.first} ${absent.last}`;
      if (!auth) add('MINOR_AUTH', `${m.first} viaja con uno de sus padres: hace falta el permiso notarial de ${absentName}, que no viaja. No lo presentan.`);
      else if (auth.expiry < today) add('MINOR_AUTH', `El permiso de ${absentName} para ${m.first} venció el ${fmtDate(auth.expiry)}.`);
    } else if (P.relation === 'relative') {
      if (!auth) add('MINOR_AUTH', `${m.first} viaja con otro adulto: hace falta el permiso notarial de AMBOS padres que identifique a ${P.companion}.`);
      else if (!auth.parent1 || !auth.parent2) add('MINOR_AUTH', `El permiso para ${m.first} lo firma un solo progenitor. Cuando el menor viaja con otro adulto, deben autorizar AMBOS padres e identificar a ese adulto (${P.companion}).`);
      else if (auth.expiry < today) add('MINOR_AUTH', `El permiso para ${m.first} venció el ${fmtDate(auth.expiry)}.`);
    }
  });
  if (P.relation === 'custody') {
    const L = pax.legal, esc = P.members;
    const hours = Math.round((pax.flight.depTime - pax.booking.created) / 3.6e6);
    if (L.type === 'DEPA') {
      if (hours < 24) add('LEGAL', `La reserva del detenido y sus escoltas se hizo ${hours} horas antes de la salida: para un DEPA se requieren al menos 24 horas de anticipación.`);
      if (esc.length < 2) add('LEGAL', 'Un detenido o extraditado viaja acompañado por al menos DOS escoltas. Presenta uno solo.');
      if (pax.sex === 'F' && !esc.some((e) => e.sex === 'F')) add('LEGAL', 'La detenida es mujer: al menos uno de los escoltas debe ser del mismo sexo. Los dos escoltas son varones.');
      if (L.otherDepa) add('LEGAL', `En este vuelo ya hay un detenido aceptado (${L.otherDepa}): sólo se acepta un pasajero con escoltas por vuelo.`);
      if (esc.some((e) => /PRIVADA/.test(e.agency))) add('LEGAL', 'Los escoltas deben pertenecer a un organismo policial u otro reconocido por el Estado y definido por ley. Una empresa de seguridad privada no puede custodiar a un detenido.');
    } else if (L.type === 'DEPO' && esc.length === 1 && esc[0].sex !== pax.sex) {
      add('LEGAL', 'Deportado con un solo escolta: el escolta debe ser del mismo sexo que el pasajero.');
    }
  }
  if (P.hasInfant && !P.infantInBooking) add('INF_BOOKING', 'El infante no figura en la reserva (sin SSR INF ni boleto de infante). Se deriva a Ventas para agregarlo antes del check-in.');
  const expected = blockers.some((x) => x.kind === 'reject') ? 'reject' : blockers.length ? 'derive' : 'accept';
  return { blockers, expected, validDocs, members };
}

export function computeExcess(pax, weights) {
  const base = FARES[pax.booking.fare];
  const fare = { ...base, pieces: base.pieces * (pax.party?.seatHolders || 1) };
  const lines = [];
  let amount = 0;
  weights.forEach((w, i) => {
    if (i >= fare.pieces) { amount += BAG_FEES.extraPiece; lines.push(`Valija ${i + 1}: pieza adicional (franquicia ${fare.pieces}) → USD ${BAG_FEES.extraPiece}`); }
    if (w > fare.kg && w <= BAG_FEES.maxKg) { amount += BAG_FEES.overweight; lines.push(`Valija ${i + 1}: sobrepeso ${w} kg (> ${fare.kg} kg) → USD ${BAG_FEES.overweight}`); }
  });
  return { amount, lines };
}

// Motivo por el que una valija requiere limited release (Guía U4), o null
export function bagNeedsLR(b) {
  if (b.cond.kind !== 'ok') return b.cond.desc;
  if (b.weight > 23) return `Equipaje heavy (${b.weight.toFixed(1)} kg, más de 23 kg)`;
  return null;
}

export function isExitRow(seat) {
  return SEATMAP.exitRows.includes(parseInt(seat, 10));
}
export function exitRowProblem(pax) {
  if (pax.age < EXIT_ROW.minAge) return `tiene ${pax.age} años (debe ser mayor de ${EXIT_ROW.minAge})`;
  const ssr = pax.booking.ssr.find((c) => EXIT_ROW.bannedSsr[c]);
  if (ssr) return EXIT_ROW.bannedSsr[ssr];
  if (!pax.speaks.some((l) => EXIT_ROW.languages.includes(l))) return 'no puede leer ni comprender instrucciones en español ni en inglés (solo habla portugués)';
  if (pax.weeks) return 'está embarazada (condición que puede agravarse al operar la salida)';
  if (pax.drunk) return 'está bajo los efectos del alcohol';
  return null;
}

// ------------------------------------------------------------------
// Evaluación de la atención
// ------------------------------------------------------------------
const DECISION_LABEL = { accept: 'Aceptar', reject: 'No aceptar', derive: 'Derivar', volunteer: 'Voluntario (VDBC)', dnbd: 'Embarque denegado involuntario (DNBD)' };

export function evaluate(pax, act, decision, now, elapsedSec, mode = 'learn', ovbk = null) {
  const an = pax.party ? analyzeParty(pax, now) : analyze(pax, now);
  // Sobreventa: con el vuelo lleno, un pasajero en regla no puede ser aceptado
  if (ovbk && an.expected === 'accept' && ovbk.full) an.expected = act.volunteerYes ? 'volunteer' : 'dnbd';
  const items = [];
  const it = (ok, title, detail = '', pts = 0) => items.push({ ok, title, detail, pts });
  const info = (title, detail = '') => items.push({ ok: null, title, detail, pts: 0 });

  // Con un pasajero insubordinado (CAT 2/3) la atención se interrumpe: no se exige completar el proceso
  const interrupted = an.blockers.some((b) => b.code === 'INSUB') && decision.kind === 'reject';
  if (!act.docsRequested && !interrupted) it(false, 'No solicitó la documentación', 'Siempre se pide documento de viaje y reserva antes de operar en el sistema.', -15);
  const notListed = act.manual && an.blockers.some((b) => b.code === 'DATE');
  if (!act.bookingLoaded && !interrupted && !notListed) it(false, 'No buscó la reserva en el DCS', 'El primer paso en sistema es identificar la reserva (PNR o apellido).', -15);

  const reasonOk = an.blockers.some((b) => b.code === decision.reason);
  const ovbkOk = ovbk && ((decision.kind === 'volunteer' && act.volunteerYes && an.expected === 'accept' && ovbk.needed) || (decision.kind === 'volunteer' && an.expected === 'dnbd' && act.volunteerYes));
  if (ovbkOk) an.expected = 'volunteer';
  if (decision.kind === an.expected) {
    it(true, `Decisión correcta: ${DECISION_LABEL[decision.kind]}`, '', 100);
    if (!['accept', 'volunteer', 'dnbd'].includes(decision.kind)) {
      if (reasonOk) it(true, `Motivo correcto: ${REASONS[decision.reason].label}`, '', 20);
      else it(false, 'Motivo indicado incorrecto', `Indicó "${REASONS[decision.reason]?.label || '—'}". Correcto: ${an.blockers.filter((b) => b.kind === decision.kind).map((b) => b.label).join(' / ')}.`, -10);
    }
  } else if (decision.kind === 'volunteer' || decision.kind === 'dnbd') {
    if (an.blockers.length) it(false, `${DECISION_LABEL[decision.kind]} a un pasajero que no podía viajar`, 'La sobreventa se gestiona con pasajeros en regla. Este pasajero tenía un problema de documentación o de reserva: no corresponde VDBC ni DNBD (ni compensación).', -60);
    else if (decision.kind === 'volunteer' && !act.volunteerYes) it(false, 'Registró como voluntario a alguien que no aceptó', 'Un voluntario debe aceptar expresamente la oferta.', -40);
    else if (decision.kind === 'volunteer' && !ovbk?.needed) it(false, 'Voluntario innecesario', 'La sobreventa ya estaba cubierta: se pagó una compensación que no hacía falta.', -30);
    else if (decision.kind === 'dnbd' && !ovbk?.full) it(false, 'Denegó el embarque con asientos disponibles', 'Mientras quedan asientos no hay involuntarios: primero voluntarios y, recién con el vuelo lleno, DNBD.', -60);
    else if (decision.kind === 'dnbd' && act.volunteerYes) it(false, 'El pasajero había aceptado ser voluntario', 'Correspondía registrarlo como voluntario (VDBC), no como involuntario.', -30);
  } else if (decision.kind === 'accept') {
    const inad = an.blockers.some((b) => b.kind === 'reject');
    it(false, 'Aceptó a un pasajero que NO podía viajar', inad ? `Consecuencia: pasajero inadmisible (INAD) en destino. Multa a la aerolínea: ${INAD_FINE}.` : 'El pasajero no estaba en condiciones de ser chequeado en este vuelo.', -150);
  } else if (an.expected === 'accept') {
    it(false, `${DECISION_LABEL[decision.kind]} a un pasajero que estaba en regla`, 'El pasajero cumplía todos los requisitos. Una denegación injustificada genera reclamos, compensaciones y daño a la imagen de la empresa.', -100);
  } else {
    it(false, `Correspondía "${DECISION_LABEL[an.expected]}", no "${DECISION_LABEL[decision.kind]}"`, an.expected === 'reject'
      ? 'El problema es documental/de admisión: el pasajero no puede viajar y no se soluciona en Ventas.'
      : 'El problema es comercial o de reserva: se resuelve en Ventas, no es un rechazo por documentación.', -40);
    if (reasonOk) it(true, 'Igualmente detectó el problema correcto', REASONS[decision.reason].label, 10);
  }

  an.blockers.forEach((b) => info(`Problema: ${b.label}`, b.why));
  if (ovbk && ovbk.needed && !an.blockers.length && !act.offered && decision.kind !== 'dnbd') it(false, 'No ofreció ser voluntario', 'Con sobreventa, desde el comienzo de la atención se pregunta a cada pasajero si quiere ser voluntario.', -5);
  if (ovbk && decision.kind === 'dnbd' && !ovbk.offeredCount) info('Sobreventa', 'Para evitar involuntarios hay que buscar voluntarios desde el comienzo de la atención en counter.');
  (decision.comp || []).forEach((x) => items.push(x));
  if (decision.kind === 'volunteer' && decision.form?.standby) info('Stand-by', 'El voluntario va a la puerta en stand-by: embarca con boarding manual si se liberan lugares por pasajeros no show; si no, se le entrega la compensación y los servicios acordados.');

  // Datos didácticos sobre casos aceptables
  const tip = {
    dni_ok: `Nacionales de ${COUNTRIES[pax.nationality].name} pueden ingresar a ${ENTRY_RULES[pax.flight.country].name} con su documento de identidad vigente (Mercosur).`,
    visa_oldpp: 'Una visa vigente en un pasaporte vencido sigue siendo válida si el pasajero presenta ambos pasaportes. El APIS se envía con el pasaporte NUEVO.',
    minor_ok: 'Menor con autorización de viaje vigente firmada por ambos progenitores: puede viajar.',
    family_ok: 'Menores con ambos padres: no requieren permiso; se presenta la partida de nacimiento (acredita el vínculo) y el documento de cada menor. El infante, con su propio documento y en la reserva (INF).',
    dom_license: 'Cabotaje: si el pasajero perdió el DNI, se acepta la licencia de conducir VIGENTE como documento de viaje.',
    dom_police: 'Cabotaje: ante el robo o extravío del documento, se acepta la denuncia policial.',
    dom_tramite: 'Cabotaje: se acepta el certificado de trámite del DNI (en un vuelo a Brasil, en cambio, la constancia en trámite NO sirve).',
    depa_ok: 'DEPA en regla: reserva con más de 24 h, dos escoltas de una fuerza reconocida por el Estado (al menos uno del mismo sexo si es mujer), ropa de civil y un solo detenido por vuelo. Viajan en la última fila y embarcan primero; el detenido va esposado desde la puerta.',
    depo_ok: 'Deportado con escolta: no hay límite de horas para la reserva ni esposas. Al menos un escolta (del mismo sexo si es uno solo), de Extranjería. Viajan en la última fila.',
    depu_ok: 'Deportado sin escolta (DEPU): no hay restricciones de embarque, ubicación ni desembarque. Su viaje es responsabilidad del Ministerio del Interior (Extranjería). Se atiende como cualquier pasajero.',
    vip_angry: 'Pasajero exigente con tono agresivo que finalmente acata (CAT 1): lo resuelve el agente con cortesía y firmeza, sin conceder beneficios fuera de la tarifa. Viaja normalmente.',
    one_parent_ok: 'Menor con uno de sus padres: permiso notarial del padre o la madre que NO viaja.',
    deceased_ok: 'Si el otro progenitor falleció, se presenta el certificado de defunción (y la partida que acredita el vínculo). No hace falta permiso.',
    court_ok: 'Si el otro progenitor está ausente, viaja con la autorización del tribunal de familia a cargo de quien lo acompaña, para ese destino y vigente.',
    consul_ok: 'Si el otro progenitor está en el exterior, la autorización se tramita a través del consulado argentino.',
    tutor_ok: 'Si viaja con un familiar que tiene la tutela, se presenta el certificado del tribunal que la acredita.',
    relative_ok: 'Menor con otro adulto (abuelo/a): permiso notarial de AMBOS padres que identifique al adulto que viaja a cargo.',
    pregnant_ok: `Hasta la semana ${PREGNANCY.freeUntil} la pasajera gestante viaja sin certificado.`,
    pregnant_cert: `Semana ${pax.weeks}: con certificado de gineco-obstetra emitido dentro de los ${PREGNANCY.certMaxDays} días previos y con declaración de aptitud, puede viajar. Comentario en la reserva: PAX PRESENTA CERTIFICADO MEDICO OK.`,
  }[pax.scenario];
  if (tip && an.expected === 'accept') info('Dato', tip);
  if (pax.overlay === 'face_change') info('Cambio de aspecto', 'El pasajero cambió anteojos o color de pelo respecto de la foto, pero los rasgos faciales coinciden. No es motivo de rechazo: se comparan rasgos, no peinado ni accesorios.');

  const tagged = act.bags.filter((b) => b.tagged);
  if (decision.kind === 'accept' && an.expected === 'accept') {
    // APIS (cada integrante, incluidos los infantes)
    if (pax.party) {
      const members = partyMembers(pax);
      const missing = members.filter((m) => !act.apisBy?.[m.key]);
      const wrong = members.filter((m) => act.apisBy?.[m.key] && !an.validDocs.some((d) => d.id === act.apisBy[m.key].docId));
      if (missing.length) it(false, `APIS faltante: ${missing.map((m) => m.first).join(', ')}`, 'Se ingresan los datos del documento de TODOS los pasajeros de la reserva que se chequean, incluidos los infantes.', -10 * missing.length);
      else if (wrong.length) it(false, `APIS con documento incorrecto: ${wrong.map((m) => m.first).join(', ')}`, 'Cada integrante con su propio documento de viaje vigente.', -10);
      else it(true, `APIS de todo el grupo (${members.length} pasajeros)`, '', 10);
    } else if (!act.apis) it(false, 'No envió APIS', 'Los datos del documento (APIS) son obligatorios en vuelos internacionales antes de emitir la tarjeta de embarque.', -25);
    else if (!an.validDocs.some((d) => d.id === act.apis.docId)) it(false, 'APIS enviado con un documento incorrecto', `Se envió ${act.apis.docTitle}. Debe usarse el documento de viaje vigente y válido para el destino.`, -25);
    else it(true, 'APIS correcto', '', 0);

    // Seguridad y mercancías peligrosas
    if (pax.bags.length && !act.asked.security) it(false, 'No hizo las preguntas de la cartilla de mercancías peligrosas', 'Es obligatorio: señalar la cartilla y asegurar la respuesta del pasajero (aerosoles, gas butano, encendedores, pilas, cigarrillos electrónicos, inflamables, corrosivos).', -20);
    if (pax.dgItem && !act.dgRemoved) it(false, 'Mercancía peligrosa en el equipaje despachado', `El pasajero lleva ${pax.dgItem}. Power banks, baterías de litio de repuesto y cigarrillos electrónicos no pueden ir en bodega (solo en cabina); gas butano y aerosoles no domésticos no pueden viajar. Ante dudas, Tabla 2.3.A vigente.`, -40);
    else if (pax.dgItem) it(true, 'Detectó mercancía peligrosa y la hizo retirar', 'Se aseguró la respuesta del pasajero a la cartilla de MMPP.', 15);

    // Equipaje
    const pending = pax.bags.length - tagged.length;
    if (pending > 0) it(false, `Quedaron ${pending} valija(s) sin despachar`, '', -20);
    if (tagged.some((b) => b.weight > BAG_FEES.maxKg)) it(false, 'Despachó una valija de más de 32 kg', 'Límite de salud y seguridad laboral: ninguna pieza individual puede superar 32 kg. Se debe reacondicionar.', -30);
    else if (act.bags.some((b) => b.repacked)) it(true, 'Hizo reacondicionar la valija de más de 32 kg', '', 5);
    if (act.bags.length && !act.bags.every((b) => b.inspected)) it(false, 'No inspeccionó todas las valijas en 360°', 'Revise visualmente cada pieza: daños, ruedas, manijas, embalaje. Lo que detecte define si corresponde limited release.', -10);
    act.bags.forEach((b, i) => {
      const needs = bagNeedsLR(b);
      if (needs && b.tagged && !b.lr) it(false, `Valija ${i + 1}: faltó la firma del limited release`, `${needs}. Los equipajes no convencionales, envueltos en film, sobredimensionados, heavy o con daños deben firmar limited release (reverso del bag tag) y se deja un comentario en la reserva.`, -20);
      else if (needs && b.lr) it(true, `Valija ${i + 1}: limited release firmado`, needs, 10);
      else if (!needs && b.lr) it(false, `Valija ${i + 1}: limited release innecesario`, 'La valija estaba en buenas condiciones: no corresponde la firma.', -5);
    });
    if (pax.bags.length && !act.asked.valuables) it(false, 'No preguntó por artículos de valor', 'Se debe preguntar y recomendar llevar en cabina dinero, joyas, notebooks o cámaras: la compañía no responde por faltantes en bodega.', pax.valuables ? -15 : -5);
    else if (pax.valuables && !act.valuablesMoved) it(false, 'No recomendó llevar el artículo de valor en cabina', `El pasajero declaró ${pax.valuables}. Si decide no retirarlo, se deja un comentario en la reserva.`, -10);
    else if (pax.valuables) it(true, 'Recomendó llevar el artículo de valor en cabina', '', 5);
    const owed = computeExcess(pax, tagged.map((b) => b.weight));
    if (owed.amount > 0 && !act.charged) it(false, `No cobró exceso de equipaje (USD ${owed.amount})`, owed.lines.join(' · '), -30);
    else if (owed.amount > 0 && act.charged !== owed.amount) it(false, `Monto de exceso incorrecto (cobró USD ${act.charged}, correspondía USD ${owed.amount})`, 'Cobre el exceso una vez pesadas y etiquetadas todas las valijas.', -10);
    else if (owed.amount > 0) it(true, `Cobró correctamente el exceso: USD ${owed.amount}`, owed.lines.join(' · '), 10);
    else if (act.charged) it(false, 'Cobro de exceso indebido', 'El equipaje estaba dentro de la franquicia.', -20);

    // Mascota, retenidos y hielo seco
    if (pax.pet) {
      const okDecision = pax.pet.ok ? 'accept' : 'reject';
      if (!act.pet) it(false, `No resolvió la mascota (${pax.pet.species})`, pax.pet.why, -15);
      else if (act.pet !== okDecision) it(false, `Mascota: ${pax.pet.ok ? 'debía aceptarse en cabina' : 'no podía viajar en cabina'}`, pax.pet.why, -15);
      else it(true, `Mascota resuelta correctamente (${pax.pet.species})`, `${pax.pet.why}${pax.pet.ok ? ' Se ingresa el SSR PETC y no puede ir en salida de emergencia.' : ''}`, 10);
    }
    if (pax.sword) {
      if (!act.retained) it(false, 'La katana no puede ir en cabina', 'Espadas y sables son artículos retenidos: van en bodega, en la bolsa de retenidos (sin que se vea el contenido) y se completa la parte de misceláneos del NOTOC.', -20);
      else it(true, 'Katana gestionada como retenido', 'Bolsa de retenidos + NOTOC (misceláneos).', 10);
    }
    if (pax.dryIce) {
      if (!act.dryIceFixed) it(false, `Hielo seco por encima del límite (${pax.dryIce} kg)`, 'El hielo seco es mercancía peligrosa: máximo 2,5 kg por pasajero, con aprobación de la aerolínea y el bulto marcado (Tabla 2.3.A).', -25);
      else it(true, 'Hielo seco reducido a 2,5 kg y bulto marcado', '', 10);
    }

    // Armas de fuego y animales en bodega
    items.push(...gradeRestricted(pax, act));

    // Cochecito del infante (Guía U4 · franquicias)
    if (pax.party?.hasInfant) {
      if (!act.stroller) it(false, 'No gestionó el cochecito del infante', 'Coche sin costo (hasta 2 piezas): por la cinta de sobredimensionados con limited release, o en la puerta con etiqueta Gate Dispatch.', -5);
      else it(true, `Cochecito: ${act.stroller === 'counter' ? 'despachado en counter (sobredimensionados + limited release)' : 'Gate Dispatch en la puerta'}`, 'Sin costo, porque viaja con el infante.', 5);
    }
    if (pax.party?.relation === 'custody') {
      const members = partyMembers(pax);
      const seats = members.map((m) => act.seats?.[m.key]).filter(Boolean);
      const last = SEATMAP.economyRows[1];
      const who = pax.legal.type === 'DEPA' ? (pax.sex === 'F' ? 'La detenida' : 'El detenido') : (pax.sex === 'F' ? 'La deportada' : 'El deportado');
      if (seats.length < members.length) it(false, `Faltó asignar asiento a ${members.length - seats.length} integrante(s)`, 'Cada escolta y el pasajero con su asiento.', -10);
      else if (seats.some((x) => parseInt(x, 10) !== last)) it(false, 'El grupo no está en la última fila', `${who} y sus escoltas viajan en la última fila de la aeronave (fila ${last}).`, -15);
      else it(true, `${who} y sus escoltas, en la última fila`, '', 10);
      const ls = act.seats?.lead;
      if (pax.legal.type === 'DEPA' && ls && ['C', 'D'].includes(ls.slice(-1))) it(false, 'Detenido sentado del lado del pasillo', 'Práctica habitual: el detenido va del lado de la ventanilla, con los escoltas entre él y el pasillo.', -10);
      if (seats.some((x) => isExitRow(x))) it(false, 'Grupo con custodia en salida de emergencia', 'Un pasajero con condición legal y su custodia no ocupan filas de salida de emergencia.', -30);
    } else if (pax.party) {
      const members = partyMembers(pax).filter((m) => !m.isInfant);
      const seats = members.map((m) => act.seats?.[m.key]).filter(Boolean);
      if (seats.length < members.length) it(false, `Faltó asignar asiento a ${members.length - seats.length} integrante(s)`, 'Cada pasajero con asiento (el infante viaja en brazos).', -10);
      const rows = seats.map((x) => parseInt(x, 10));
      if (seats.length > 1 && Math.max(...rows) - Math.min(...rows) > 1) it(false, 'Familia sentada separada', 'Los menores se sientan junto a sus padres o al adulto con quien viajan.', -10);
      else if (seats.length === members.length) it(true, 'Familia sentada junta', '', 5);
      members.forEach((m) => {
        const st = act.seats?.[m.key];
        if (!st || !isExitRow(st)) return;
        const why = m.isMinor ? `${m.first} tiene ${m.age} años` : pax.party.hasInfant && m.key === 'lead' ? `${m.first} viaja con un infante en brazos` : null;
        if (why) it(false, 'Salida de emergencia a un pasajero no apto', `${why}: no puede ocupar una fila de salida de emergencia.`, -30);
      });
    }

    // Asiento
    if (pax.party) { /* evaluado arriba */ } else if (!act.seat) it(false, 'No asignó asiento', 'El sistema asignó uno automáticamente. Ofrezca asiento según preferencia y disponibilidad.', -10);
    else {
      const row = parseInt(act.seat, 10);
      const isJ = row <= SEATMAP.businessRows.at(-1);
      if (isJ !== (pax.booking.cabin === 'J')) it(false, 'Asiento en cabina incorrecta', `El pasajero viaja en ${pax.booking.cabin === 'J' ? 'Business' : 'Economy'}.`, -15);
      const prob = exitRowProblem(pax);
      if (isExitRow(act.seat) && prob) it(false, 'Asignó salida de emergencia a un pasajero no apto', `El pasajero ${prob}. En filas de salida solo pueden sentarse adultos capaces de operar la salida y asistir en una evacuación.`, -30);
      else if (pax.seatPref === 'exit' && prob) it(true, 'No asignó la salida de emergencia a un pasajero no apto', `El pasajero ${prob}.`, 10);
      else if (pax.seatPref === 'exit' && !isExitRow(act.seat)) it(false, 'No ofreció la salida de emergencia', 'El pasajero era apto y la pidió. Además, el procedimiento indica ofrecer proactivamente estos asientos: debe haber al menos un pasajero en cada fila de salida.', -5);
      const col = act.seat.slice(-1);
      const prefOk = { window: ['A', 'F'], aisle: ['C', 'D'] }[pax.seatPref];
      if (prefOk && !prefOk.includes(col)) it(false, 'No respetó la preferencia de asiento', `Pidió ${pax.seatPref === 'window' ? 'ventanilla' : 'pasillo'}.`, -5);
    }
    if (pax.booking.ssr.includes('UMNR')) info('Menor no acompañado', 'Recuerde: formulario UM firmado, sobre con documentación y entrega del menor a la tripulación/personal asignado.');
  } else if (tagged.length) {
    it(false, 'Despachó equipaje de un pasajero que no viaja', 'Una valija sin su pasajero a bordo debe ser bajada (offload) por seguridad. Nunca etiquete antes de confirmar que el pasajero puede viajar.', -20);
  }

  // Tiempo (solo puntúa en modo Desafío)
  if (mode !== 'challenge') { /* sin puntaje por tiempo */ }
  else if (elapsedSec <= 100) it(true, `Atención ágil (${Math.round(elapsedSec)} s)`, '', 20);
  else if (elapsedSec <= 180) it(true, `Buen tiempo de atención (${Math.round(elapsedSec)} s)`, '', 10);
  else if (elapsedSec > 330) it(false, `Atención lenta (${Math.round(elapsedSec)} s)`, 'La fila sigue creciendo: practique el orden de los pasos.', -10);

  const total = items.reduce((a, x) => a + x.pts, 0);
  return { items, total, analysis: an, correct: decision.kind === an.expected };
}
