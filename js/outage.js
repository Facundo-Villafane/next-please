// SISTEMA CAÍDO: contingencia de atención manual en el counter (Guía U4 · Parte I, preparación).
// Se cae SITA a mitad del turno: kit de contingencia, manifiesto impreso, planilla API manual,
// bag tags y boarding pass manuales. Al volver el sistema, se cargan los manuales antes del cierre.
import { FLIGHTS, AIRLINE, COUNTRIES, NAMES, STATION } from './data.js';
import { FAMILY } from './generator.js';
import { isIdDoc, partyMembers } from './rules.js';
import { docTitle } from './docs.js';
import { esc, norm, fmtTime, fmtDate, pick, rnd, chance, shuffle, randomDigits } from './util.js';

const $ = (s) => document.querySelector(s);
let G, api;

const KIT = [
  { k: 'bp', label: 'Boarding pass manual', ok: true },
  { k: 'tag', label: 'Bag tag manual', ok: true },
  { k: 'list', label: 'Lista de pasajeros / manifiesto impreso', ok: true },
  { k: 'ctrl', label: 'Planilla de control de pasajeros y equipajes', ok: true },
  { k: 'api', label: 'Planilla API manual', ok: true },
  { k: 'wb', label: 'Planilla de estiba / peso y balance', ok: true },
  { k: 'roll', label: 'Rollo de termopapel para la impresora', ok: false, why: 'Sin sistema, la impresora térmica no imprime: por eso existen los formularios manuales.' },
  { k: 'mate', label: 'Mate y termo', ok: false, why: 'Tentador, pero no es parte del kit de contingencia.' },
  { k: 'stamp', label: 'Sello de Migraciones', ok: false, why: 'Lo usa Migraciones, no el agente de la aerolínea.' },
  { k: 'sign', label: 'Cartel "Volvemos en 5 minutos"', ok: false, why: 'La operación continúa en manual: no se cierra el counter.' },
  { k: 'gd', label: 'Etiquetas Gate Dispatch', ok: false, why: 'Son para la puerta de embarque, no para la atención manual en el counter.' },
];
// Escenarios que no se juegan en manual (requieren sistema o son demasiado complejos en papel)
const NOT_MANUAL = ['no_esta', 'vip_angry', 'angry_cat2', 'bomb_joke', 'late', 'depa_ok', 'depa_late', 'depa_one_escort', 'depa_female', 'depa_second', 'depa_private', 'depo_ok', 'depo_wrong_sex', 'depu_ok'];

export function initOutage(g, a) { G = g; api = a; }

// Elige la ventana de pasajeros que se atienden en manual
export function planOutage(opts) {
  G.outage = null;
  const cfg = opts.outage;
  if (!cfg) return;
  const ok = (e) => e && !FAMILY[e.scenario] && !NOT_MANUAL.includes(e.scenario);
  const dur = cfg.duration || 3;
  for (let s = cfg.afterPax || 2; s + dur <= G.deck.length; s++) {
    if (G.deck.slice(s, s + dur).every(ok)) { G.outage = { start: s, end: s + dur, phase: 'idle', manual: [], log: [] }; return; }
  }
}

export const isManual = () => G.outage?.phase === 'down';

// Llamado al llegar cada pasajero (antes de que camine al mostrador)
export function outageOnPax(onReady) {
  const o = G.outage;
  if (!o) return onReady();
  if (G.idx === o.start && o.phase === 'idle') { o.phase = 'down'; return goDown(onReady); }
  if (G.idx === o.end && o.phase === 'down') { o.phase = 'up'; return goUp(onReady); }
  onReady();
}

function setLook() {
  const down = isManual();
  $('#dcs').classList.toggle('down', down);
  $('.dcsHead span').textContent = down ? '📵 SIN SISTEMA · ATENCIÓN MANUAL' : 'DCS · DEPARTURE CONTROL';
  const labels = down
    ? { ident: '1 · Lista de pasajeros', pax: '2 · Planilla API', bags: '3 · Bag tag manual', seat: '4 · Plano de asientos' }
    : { ident: '1 · Identificar', pax: '2 · Pasajero / APIS', bags: '3 · Equipaje', seat: '4 · Asientos' };
  Object.entries(labels).forEach(([k, t]) => { const b = document.querySelector(`#tabs [data-tab="${k}"]`); if (b) b.textContent = t; });
}

function goDown(onReady) {
  api.sys('*** SITA FUERA DE SERVICIO · SIN CONEXIÓN ***', 'err');
  api.openModal(`<div class="story"><div class="who">${api.marta(70)}<b>Marta</b></div>
    <div class="says"><p>📵 <b>¡Se cayó SITA en todo el aeropuerto!</b> No hay sistema, ni impresoras, ni APIS. La operación no se frena: seguimos en <b>manual</b>.</p>
    <p>Primero armá el <b>kit de contingencia</b>: elegí lo que necesitás para atender sin sistema.</p></div></div>
    <div class="kit">${shuffle(KIT).map((x) => `<label><input type="checkbox" value="${x.k}"> ${esc(x.label)}</label>`).join('')}</div>
    <div class="row end"><button class="btn ok" id="kitGo">Listo, a atender ▶</button></div>`, 'wide');
  $('#kitGo').onclick = () => {
    const chosen = new Set([...document.querySelectorAll('.kit input:checked')].map((i) => i.value));
    const lines = [];
    let pts = 0;
    KIT.forEach((x) => {
      if (x.ok && chosen.has(x.k)) pts += 2;
      if (x.ok && !chosen.has(x.k)) { pts -= 3; lines.push(`✖ Faltó: ${x.label}`); }
      if (!x.ok && chosen.has(x.k)) { pts -= 3; lines.push(`✖ ${x.label}: ${x.why}`); }
    });
    G.score += pts;
    G.outage.log.push({ type: 'kit', pts, perfect: !lines.length });
    api.openModal(`<h2>${lines.length ? '🧰 Kit armado, con observaciones' : '🧰 ¡Kit de contingencia perfecto!'}</h2>
      <p class="hint">Elementos para la atención manual (Guía U4): boarding pass manual, bag tag manual, lista de pasajeros / manifiesto, planilla de control de pasajeros y equipajes, planilla API manual y planilla de estiba / peso y balance.</p>
      ${lines.length ? `<ul class="list">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      <p class="big">Puntaje: <b>${pts > 0 ? '+' : ''}${pts}</b></p>
      <p class="hint">Cómo se atiende en manual: <b>1)</b> buscar y tildar al pasajero en la lista impresa · <b>2)</b> copiar los datos del documento en la planilla API · <b>3)</b> escribir a mano el bag tag (¡ojo con el destino!) · <b>4)</b> asiento del plano en papel y boarding pass manual al aceptar. Timatic se consulta desde el celular de Marta.</p>
      <div class="row end"><button class="btn ok" id="kitOk">Continuar ▶</button></div>`, 'wide');
    $('#kitOk').onclick = () => { api.closeModal(); setLook(); G.tab = 'ident'; api.renderTabs(); onReady(); };
  };
}

function goUp(onReady) {
  setLook();
  api.sys('SITA RESTABLECIDO · CARGAR LOS PASAJEROS ATENDIDOS EN MANUAL', 'ok');
  const n = G.outage.manual.length;
  api.openModal(`<div class="story"><div class="who">${api.marta(70)}<b>Marta</b></div>
    <div class="says"><p>✅ <b>¡Volvió el sistema!</b> Buen trabajo en manual.</p>
    <p>${n ? `Ahora falta lo más importante: cargar en el sistema a los <b>${n} pasajero(s)</b> que aceptaste en manual (check-in y API) <b>antes del cierre de sus vuelos</b>. La API es obligación legal: si no se transmite, el pasajero llega a destino sin información para Migraciones.` : 'No aceptaste pasajeros en manual, así que no hay nada para cargar.'}</p>
    ${n ? '<p>Lo hacés desde la pestaña <b>1 · Identificar</b>, entre pasajero y pasajero.</p>' : ''}</div></div>
    <div class="row end"><button class="btn ok" id="upOk">Seguir atendiendo ▶</button></div>`, 'wide');
  $('#upOk').onclick = () => { api.closeModal(); onReady(); };
}

// ------------------------------------------------------------------
// 1 · Lista de pasajeros (manifiesto impreso)
// ------------------------------------------------------------------
function makeManifest(p) {
  const today = new Date(G.now); today.setHours(0, 0, 0, 0);
  const flights = G.flights.filter((f) => G.now >= f.openTime);
  const rows = [];
  const real = p.booking.date.getTime() === today.getTime();
  if (real) rows.push({ real: true, last: p.booking.last, first: p.booking.first, pnr: p.booking.pnr, flight: p.flight.no, tkt: p.booking.ticket, ssr: p.booking.ssr.join(' ') });
  // Señuelos: alguien con el mismo apellido, y otros pasajeros del día
  rows.push({ last: p.booking.last, first: pick(NAMES.AR[p.sex === 'M' ? 'F' : 'M']).split(' ')[0], pnr: pnr(), flight: pick(flights).no, tkt: tkt(), ssr: '' });
  for (let i = 0; i < 10; i++) {
    const sex = pick(['M', 'F']);
    rows.push({ last: pick(NAMES.AR.last), first: pick(NAMES.AR[sex]).split(' ')[0], pnr: pnr(), flight: pick(flights).no, tkt: chance(0.96) ? tkt() : null, ssr: chance(0.15) ? pick(['WCHR', 'VGML', 'PETC']) : '' });
  }
  return rows.sort((a, b) => norm(a.last).localeCompare(norm(b.last)) || norm(a.first).localeCompare(norm(b.first)));
}
const pnr = () => Array.from({ length: 6 }, () => pick('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))).join('');
const tkt = () => AIRLINE.ticketPrefix + randomDigits(10);

export function paneList(pane) {
  const a = G.act, p = G.cur;
  if (!a.manifest) a.manifest = makeManifest(p);
  const rows = a.manifest.map((r, i) => `<tr class="${a.tickedRow === i ? 'ticked' : ''}"><td>${a.tickedRow === i ? '✔' : ''}</td><td>${esc(norm(r.last))}/${esc(norm(r.first))}</td><td class="mono">${r.pnr}</td><td>${r.flight}</td><td class="mono">${r.tkt ? `${r.tkt.slice(0, 3)}-${r.tkt.slice(3)}` : '<b class="err">SIN EMITIR</b>'}</td><td>${r.ssr || ''}</td>
    <td>${a.tickedRow == null ? `<button class="btn sm" data-tick="${i}">Tildar</button>` : ''}</td></tr>`).join('');
  pane.innerHTML = `
    ${uploadBox()}
    <div class="paper manifest">
      <div class="ph2"><b>LISTA DE PASAJEROS · ${STATION.code} · ${fmtDate(G.now)}</b><span>Impresa antes de la caída del sistema · vuelos con check-in abierto · orden alfabético</span></div>
      <table class="grid"><tr><th></th><th>Pasajero</th><th>PNR</th><th>Vuelo</th><th>Boleto</th><th>SSR</th><th></th></tr>${rows}</table>
    </div>
    <p class="hint">Buscá al pasajero <b>por apellido y nombre</b>, controlá vuelo y boleto, y tildalo. Si no figura en la lista de hoy, algo no está bien con su reserva.</p>`;
  bindUpload(pane);
  pane.querySelectorAll('[data-tick]').forEach((b) => {
    b.onclick = () => {
      const r = a.manifest[+b.dataset.tick];
      if (!r.real) { a.wrongTicks = (a.wrongTicks || 0) + 1; api.sys(`${norm(r.last)}/${norm(r.first)} NO ES EL PASAJERO QUE TENÉS ENFRENTE · Verificá nombre y vuelo`, 'err'); return; }
      a.tickedRow = +b.dataset.tick;
      a.bookingLoaded = true;
      api.sys(`PASAJERO TILDADO EN LA LISTA · ${r.flight}${r.tkt ? '' : ' · ⚠ BOLETO SIN EMITIR'}`, r.tkt ? 'ok' : 'warn');
      api.renderPane();
    };
  });
}

// ------------------------------------------------------------------
// 2 · Planilla API manual
// ------------------------------------------------------------------
export function paneApi(pane) {
  const a = G.act, p = G.cur;
  if (!a.bookingLoaded) { pane.innerHTML = '<div class="blank">PASAJERO NO TILDADO<br><small>Primero buscalo en la lista de pasajeros (pestaña 1).</small></div>'; return; }
  const docs = a.docsRequested ? p.docs.filter(isIdDoc) : [];
  const nats = Object.entries(COUNTRIES).map(([k, c]) => `<option value="${k}">${c.iso3} · ${esc(c.name)}</option>`).join('');
  const done = a.apiManual;
  pane.innerHTML = `
    <div class="paper apiForm">
      <div class="ph2"><b>PLANILLA API MANUAL · ${p.flight.no} ${STATION.code}-${p.flight.dest}</b><span>Completar con letra clara a partir del documento de viaje · se transmite al restablecerse el sistema</span></div>
      ${!a.docsRequested ? '<p class="hint">Pedile el documento al pasajero.</p>' : done ? `<p class="okline">✔ Registrado en la planilla: ${esc(done.summary)}</p>` : `
      <div class="apiGrid">
        <label>Documento<select id="mDoc">${docs.map((d) => `<option value="${d.id}">${esc(docTitle(d))}</option>`).join('')}</select></label>
        <label>Apellido<input id="mLast" class="mono" value="${esc(norm(p.booking.last))}" readonly></label>
        <label>N° de documento<input id="mNum" class="mono" placeholder="Copiar del documento" autocomplete="off"></label>
        <label>Nacionalidad<select id="mNat"><option value="">—</option>${nats}</select></label>
        <label>Vencimiento<input id="mExp" class="mono" placeholder="DD/MM/AAAA" autocomplete="off"></label>
      </div>
      <div class="row end"><button class="btn ok" id="mSave">✍ Registrar en la planilla</button></div>`}
    </div>
    <p class="hint">Sin sistema no hay respuesta de APIS: <b>el control del documento (vigencia, validez, visa) lo hacés vos a ojo</b>, con el documento y Timatic.</p>`;
  if (!$('#mSave')) return;
  $('#mSave').onclick = () => {
    const d = p.docs.find((x) => x.id === $('#mDoc').value);
    const num = $('#mNum').value, nat = $('#mNat').value, exp = $('#mExp').value.trim();
    if (!num || !nat || !exp) { api.sys('COMPLETÁ TODOS LOS CAMPOS DE LA PLANILLA', 'err'); return; }
    const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const errors = [];
    if (clean(num) !== clean(d.number)) errors.push(`N° de documento (anotaste ${num.trim()}, es ${d.number})`);
    if (nat !== d.nationality) errors.push(`nacionalidad (anotaste ${COUNTRIES[nat].iso3}, es ${COUNTRIES[d.nationality].iso3})`);
    if (exp.replace(/[-.]/g, '/') !== fmtDate(d.expiry)) errors.push(`vencimiento (anotaste ${exp}, es ${fmtDate(d.expiry)})`);
    a.apiManual = { docId: d.id, errors, summary: `${docTitle(d)} N° ${num.trim()} · ${COUNTRIES[nat].iso3} · vence ${exp}` };
    a.apis = { docId: d.id, docTitle: docTitle(d), response: 'PLANILLA API MANUAL (PENDIENTE DE TRANSMISIÓN)', okBoard: true, manual: true };
    a.apisBy = { lead: a.apis };
    api.sys('API REGISTRADA EN LA PLANILLA MANUAL', 'ok');
    api.renderPane();
  };
}

// ------------------------------------------------------------------
// 3 · Bag tag manual
// ------------------------------------------------------------------
export function manualTag(i, onDone) {
  const p = G.cur;
  const dests = [...new Set(FLIGHTS.map((f) => f.dest))];
  api.openModal(`<h2>🏷 Bag tag manual · Valija ${i + 1}</h2>
    <p class="hint">Completá a mano la etiqueta: el destino y el vuelo son lo que lleva la valija al avión correcto.</p>
    <div class="paper tagForm">
      <div class="row gap wrap">
        <label class="inl">N° de etiqueta <b class="mono">0${AIRLINE.ticketPrefix} ${randomDigits(6)}</b></label>
        <label class="inl">Destino <select id="tgDest"><option value="">—</option>${dests.map((d) => `<option>${d}</option>`).join('')}</select></label>
        <label class="inl">Vuelo <select id="tgFlt"><option value="">—</option>${G.flights.map((f) => `<option>${f.no}</option>`).join('')}</select></label>
      </div>
      <label class="inl"><input type="checkbox" id="tgStub"> Entregar el talón al pasajero (y abrochar el comprobante en la planilla de control)</label>
    </div>
    <div class="row end gap"><button class="btn ghost" id="tgNo">Cancelar</button><button class="btn ok" id="tgOk">Colocar etiqueta</button></div>`);
  $('#tgNo').onclick = api.closeModal;
  $('#tgOk').onclick = () => {
    const dest = $('#tgDest').value, flt = $('#tgFlt').value;
    if (!dest || !flt) { api.sys('COMPLETÁ DESTINO Y VUELO EN LA ETIQUETA', 'err'); return; }
    api.closeModal();
    onDone({ manual: true, dest, flt, stub: $('#tgStub').checked, wrong: dest !== p.flight.dest || flt !== p.flight.no });
  };
}

// ------------------------------------------------------------------
// Boarding pass manual (al aceptar)
// ------------------------------------------------------------------
export function manualBp(seat, onDone) {
  const p = G.cur, f = p.flight;
  const gates = [...new Set(FLIGHTS.map((x) => x.gate))].sort();
  const times = shuffle([-45, -30, -60, -90]).map((m) => fmtTime(new Date(f.depTime.getTime() + m * 60000)));
  api.openModal(`<h2>🎫 Boarding pass manual</h2>
    <p class="hint">Sin impresora: completá la tarjeta a mano. Vuelo, puerta y hora de embarque salen de la información del vuelo (tablero / briefing).</p>
    <div class="paper bpForm">
      <div class="row gap wrap">
        <label class="inl">Pasajero <b>${esc(norm(p.booking.last))}/${esc(norm(p.booking.first))}</b></label>
        <label class="inl">Vuelo <select id="bfFlt"><option value="">—</option>${G.flights.map((x) => `<option>${x.no}</option>`).join('')}</select></label>
        <label class="inl">Puerta <select id="bfGate"><option value="">—</option>${gates.map((g) => `<option>${g}</option>`).join('')}</select></label>
        <label class="inl">Embarque <select id="bfTime"><option value="">—</option>${times.map((t) => `<option>${t}</option>`).join('')}</select></label>
        <label class="inl">Asiento <input id="bfSeat" class="mono" value="${esc(seat || '')}" size="4"></label>
      </div>
    </div>
    <div class="row end gap"><button class="btn ghost" id="bfNo">Cancelar</button><button class="btn ok" id="bfOk">Entregar tarjeta</button></div>`);
  $('#bfNo').onclick = api.closeModal;
  $('#bfOk').onclick = () => {
    const v = { flt: $('#bfFlt').value, gate: $('#bfGate').value, time: $('#bfTime').value, seat: $('#bfSeat').value.trim().toUpperCase() };
    if (!v.flt || !v.gate || !v.time || !v.seat) { api.sys('COMPLETÁ TODOS LOS CAMPOS DE LA TARJETA', 'err'); return; }
    api.closeModal();
    onDone(v);
  };
}

// ------------------------------------------------------------------
// Evaluación de lo hecho en manual (se suma a la evaluación del pasajero)
// ------------------------------------------------------------------
export function manualItems(p, a, decision) {
  if (!a.manual) return [];
  const items = [];
  const it = (ok, title, detail, pts) => items.push({ ok, title, detail, pts });
  if (a.wrongTicks) it(false, `Tildó a otro pasajero en la lista (${a.wrongTicks})`, 'En manual, la lista es el sistema: tildar al pasajero equivocado deja a uno chequeado de más y a otro de menos.', -5 * a.wrongTicks);
  if (decision.kind === 'accept') {
    const f = p.flight;
    if (!a.apiManual) it(false, 'No completó la planilla API manual', 'La API es obligación legal también en contingencia: se anota en la planilla y se transmite al volver el sistema.', -20);
    else if (a.apiManual.errors.length) it(false, 'Errores de transcripción en la planilla API', `Revisá: ${a.apiManual.errors.join('; ')}.`, -10 * Math.min(2, a.apiManual.errors.length));
    else it(true, 'Planilla API manual completa y sin errores', '', 10);
    a.bags.filter((b) => b.tagged && b.manualTag).forEach((b, i) => {
      if (b.manualTag.wrong) it(false, `Bag tag manual equivocado: ${b.manualTag.dest} / ${b.manualTag.flt}`, `La valija viajaría a ${b.manualTag.dest}: el pasajero va a ${f.dest} en el ${f.no}. En manual no hay sistema que avise: hay que verificar destino y vuelo.`, -20);
      if (!b.manualTag.stub) it(false, `Valija ${i + 1}: no entregó el talón al pasajero`, 'El talón es su comprobante para reclamar el equipaje.', -5);
    });
    const bp = a.manualBp;
    if (bp) {
      const errs = [];
      if (bp.flt !== f.no) errs.push(`vuelo ${bp.flt} (es ${f.no})`);
      if (bp.gate !== f.gate) errs.push(`puerta ${bp.gate} (es ${f.gate})`);
      if (bp.time !== fmtTime(new Date(f.depTime.getTime() - 45 * 60000))) errs.push(`hora de embarque ${bp.time} (es ${fmtTime(new Date(f.depTime.getTime() - 45 * 60000))})`);
      if (errs.length) it(false, 'Boarding pass manual con errores', `Revisá: ${errs.join('; ')}. El pasajero va a ir adonde diga su tarjeta.`, -10 * errs.length);
      else it(true, 'Boarding pass manual correcto', '', 10);
    }
  }
  return items;
}

// El pasajero aceptado en manual queda pendiente de carga en el sistema
export function registerManual(p, a, decision) {
  if (a.manual && decision.kind === 'accept') G.outage.manual.push({ name: `${p.first} ${p.last}`, flight: p.flight, uploaded: null });
}

// ------------------------------------------------------------------
// Carga en el sistema de los pasajeros atendidos en manual
// ------------------------------------------------------------------
function uploadBox() {
  const o = G.outage;
  if (!o || o.phase !== 'up') return '';
  const pend = o.manual.filter((m) => !m.uploaded);
  if (!o.manual.length) return '';
  return `<div class="ovbkBox upBox"><b>📤 Pasajeros atendidos en manual</b> · cargar check-in y transmitir la API antes del cierre de cada vuelo
    <table class="grid">${o.manual.map((m, i) => `<tr><td>${esc(m.name)}</td><td>${m.flight.no} · cierra ${fmtTime(m.flight.closeTime)}</td><td>${m.uploaded ? `<span class="tag green">CARGADO ${fmtTime(m.uploaded)}</span>` : `<button class="btn sm ok" data-up="${i}">Cargar en el sistema</button>`}</td></tr>`).join('')}</table>
    ${pend.length ? '' : '<small>Todo cargado. ✔</small>'}</div>`;
}
function bindUpload(pane) {
  pane.querySelectorAll('[data-up]').forEach((b) => {
    b.onclick = () => {
      const m = G.outage.manual[+b.dataset.up];
      m.uploaded = new Date(G.now);
      api.sys(`CHECK-IN Y API TRANSMITIDOS · ${norm(m.name).toUpperCase()} · ${m.flight.no}`, m.uploaded < m.flight.closeTime ? 'ok' : 'warn');
      api.renderPane();
    };
  });
}
export function identUploadBox(pane) {
  const html = uploadBox();
  if (!html) return;
  pane.insertAdjacentHTML('afterbegin', html);
  bindUpload(pane);
}

// Al final del turno: ¿se cargaron a tiempo?
export function outageEndCheck() {
  const o = G.outage;
  if (!o || o.phase === 'idle') return [];
  if (o.phase === 'down') { o.phase = 'up'; setLook(); }
  const res = [];
  o.manual.forEach((m) => {
    if (!m.uploaded) { G.score -= 20; res.push({ ok: false, name: m.name, flight: m.flight.no, city: m.flight.city, why: 'never' }); }
    else if (m.uploaded >= m.flight.closeTime) { G.score -= 10; res.push({ ok: false, name: m.name, flight: m.flight.no, city: m.flight.city, why: 'late' }); }
    else { G.score += 5; res.push({ ok: true, name: m.name, flight: m.flight.no }); }
  });
  o.log.push({ type: 'upload', res });
  return o.log;
}

export function resetOutageLook() { setLook(); }
