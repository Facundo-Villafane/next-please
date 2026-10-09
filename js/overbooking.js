// SOBREVENTA (Guía U4 · Parte III): voluntarios (VDBC), involuntarios (DNBD), protección,
// compensación y servicios según la matriz de Argentina.
import { FLIGHTS, STATION } from './data.js';
import { esc, fmtTime, timeToday, dayOnly, addDays } from './util.js';

// Matriz de compensación (Argentina) — editable por el instructor
export const OVBK_POLICY = {
  comp: { intl: { same: 160, next: 200 }, dom: { same: 60, next: 100 } },
  managerRaise: 250, // monto autorizado por el gerente de aeropuertos en la puerta
  delayHoursForMeal: 4,
  delayHoursForTransport: 4,
  voucher: 'Voucher de servicios: llega al correo en 48 h hábiles, válido 6 meses, transferible.',
};

// Opciones de protección: vuelos posteriores del mismo día al mismo destino + el mismo vuelo al día siguiente
export function protectionsFor(flight) {
  const today = dayOnly(new Date());
  const dep = timeToday(today, flight.dep);
  const same = FLIGHTS.filter((f) => f.dest === flight.dest && f.no !== flight.no && timeToday(today, f.dep) > dep)
    .map((f) => ({ id: f.no, no: f.no, dep: timeToday(today, f.dep), sameDay: true }));
  const next = { id: `${flight.no}+1`, no: flight.no, dep: addDays(dep, 1), sameDay: false };
  return [...same, next].map((p) => ({
    ...p,
    delayH: (p.dep - dep) / 3600000,
    label: `${p.no} ${STATION.code}-${flight.dest} · ${p.sameDay ? 'hoy' : 'mañana'} ${fmtTime(p.dep)}`,
  }));
}

// Frase modelo de la guía para ofrecer ser voluntario
export function volunteerScript(flight, amount = OVBK_POLICY.comp.intl.same) {
  const p = protectionsFor(flight)[0];
  return `Sr./Sra., estamos ofreciendo una compensación de USD ${amount} en voucher de servicios si acepta viajar en el vuelo ${p.no} ${p.sameDay ? 'de hoy' : 'de mañana'} a las ${fmtTime(p.dep)}. La compensación estará disponible en su correo en un plazo de 48 horas hábiles y podrá usarla durante 6 meses. Este voucher es transferible.`;
}

export function volunteerScriptEn(flight, amount = OVBK_POLICY.comp.intl.same) {
  const p = protectionsFor(flight)[0];
  return `Sir/Madam, we are offering USD ${amount} in a service voucher if you agree to take flight ${p.no} ${p.sameDay ? 'today' : 'tomorrow'} at ${fmtTime(p.dep)}. The voucher will be emailed within 48 business hours, it is valid for 6 months and it is transferable.`;
}

// Lo que corresponde según la matriz
export function expectedComp(pax, prot, { authorized = null } = {}) {
  const base = prot.sameDay ? OVBK_POLICY.comp.intl.same : OVBK_POLICY.comp.intl.next;
  const resident = pax.nationality === 'AR';
  return {
    amount: authorized && authorized > base ? authorized : base,
    meal: prot.delayH > OVBK_POLICY.delayHoursForMeal,
    transport: prot.delayH > OVBK_POLICY.delayHoursForTransport,
    hotel: !prot.sameDay && !resident,
    phone: true,
  };
}

// Formulario de sobreventa (VDBC / DNBD + protección + compensación + servicios)
export function compForm(ui, { pax, flight, title, amounts = [60, 100, 160, 200, OVBK_POLICY.managerRaise], standbyOption = false, onSubmit }) {
  const prots = protectionsFor(flight);
  ui.openModal(`<div class="home">
    <h2>${esc(title)}</h2>
    <p class="hint">Pasajero: <b>${esc(pax.last.toUpperCase())}/${esc(pax.first.toUpperCase())}</b> · ${esc(pax.nationality === 'AR' ? 'residente en Argentina' : 'no residente (retorna a su país)')} · Vuelo ${flight.no} STD ${flight.dep}</p>
    <h3>Código SSR</h3>
    <div class="reasons inline">
      <label><input type="radio" name="ssr" value="VDBC"> VDBC · Voluntario</label>
      <label><input type="radio" name="ssr" value="DNBD"> DNBD · Involuntario (embarque denegado)</label>
    </div>
    <h3>Protección</h3>
    <div class="reasons">${prots.map((p, i) => `<label><input type="radio" name="prot" value="${i}"> ${esc(p.label)} <small>(${p.delayH < 24 ? `${p.delayH.toFixed(1).replace('.', ',')} h después` : 'día siguiente'})</small></label>`).join('')}</div>
    <h3>Compensación</h3>
    <div class="row gap wrap">
      <select id="cAmt"><option value="">Monto…</option>${amounts.map((a) => `<option value="${a}">USD ${a}</option>`).join('')}</select>
      <select id="cType"><option value="voucher">Voucher de servicios</option><option value="cash">Dinero</option></select>
    </div>
    <h3>Servicios</h3>
    <div class="checks">
      <label><input type="checkbox" id="sMeal"> Alimentación</label>
      <label><input type="checkbox" id="sHotel"> Hotel</label>
      <label><input type="checkbox" id="sTransport"> Transporte</label>
      <label><input type="checkbox" id="sPhone"> Comunicación telefónica</label>
    </div>
    ${standbyOption ? `<h3>Stand-by</h3><label class="chk"><input type="checkbox" id="cStby"> Enviar a la puerta en stand-by (boarding manual si se liberan lugares por no show; si no, recibe la compensación acordada)</label>` : ''}
    <p class="hint">${esc(OVBK_POLICY.voucher)}</p>
    <div class="row end gap"><button class="btn ghost" id="cNo">Cancelar</button><button class="btn ok" id="cOk">Registrar</button></div></div>`, 'wide');
  document.getElementById('cNo').onclick = ui.closeModal;
  document.getElementById('cOk').onclick = () => {
    const ssr = document.querySelector('#modalBox input[name=ssr]:checked')?.value;
    const pi = document.querySelector('#modalBox input[name=prot]:checked')?.value;
    const amount = +document.getElementById('cAmt').value;
    if (!ssr || pi === undefined || !amount) { document.getElementById('cOk').textContent = 'Completá SSR, protección y monto'; return; }
    const form = {
      ssr, prot: prots[+pi], amount, type: document.getElementById('cType').value,
      meal: document.getElementById('sMeal').checked, hotel: document.getElementById('sHotel').checked,
      transport: document.getElementById('sTransport').checked, phone: document.getElementById('sPhone').checked,
      standby: !!document.getElementById('cStby')?.checked,
    };
    ui.closeModal();
    onSubmit(form);
  };
}

// Corrección del formulario. Devuelve ítems { ok, title, detail, pts }
export function gradeComp(pax, form, flight, { ssr, authorized = null }) {
  const items = [];
  const it = (ok, title, detail, pts) => items.push({ ok, title, detail, pts });
  const prots = protectionsFor(flight);
  const exp = expectedComp(pax, form.prot, { authorized });
  if (form.ssr !== ssr) it(false, `SSR incorrecto: correspondía ${ssr}`, ssr === 'VDBC' ? 'VDBC = Volunteer Denied Boarding: el pasajero aceptó ceder su lugar.' : 'DNBD = Denied Boarding: no hubo voluntarios y el pasajero no puede viajar por sobreventa.', -10);
  else it(true, `SSR ${ssr} ingresado`, '', 5);
  if (ssr === 'DNBD' && form.prot.id !== prots[0].id) it(false, 'Protección: debía ser el vuelo más próximo', `Al involuntario se lo reacomoda en el vuelo más próximo (${prots[0].label}), aunque también tenga sobreventa.`, -10);
  if (form.amount !== exp.amount) {
    it(false, `Compensación incorrecta: USD ${form.amount} (correspondía USD ${exp.amount})`, authorized && exp.amount === authorized
      ? `El gerente de aeropuertos autorizó USD ${authorized} para esta búsqueda de voluntarios.`
      : `Matriz Argentina, vuelo internacional: protección el mismo día USD ${OVBK_POLICY.comp.intl.same}; al día siguiente USD ${OVBK_POLICY.comp.intl.next}.`, -15);
  } else it(true, `Compensación correcta: USD ${exp.amount} (${form.type === 'cash' ? 'dinero' : 'voucher'})`, '', 10);
  const svc = [
    ['meal', 'Alimentación', `corresponde con atraso de más de ${OVBK_POLICY.delayHoursForMeal} horas`],
    ['transport', 'Transporte', `corresponde con atraso de más de ${OVBK_POLICY.delayHoursForTransport} horas`],
    ['hotel', 'Hotel', 'corresponde si hay pernocte, para pasajeros que retornan o en tránsito (no para residentes)'],
    ['phone', 'Comunicación telefónica', 'corresponde siempre'],
  ];
  const wrong = svc.filter(([k]) => !!form[k] !== exp[k]);
  if (wrong.length) it(false, `Servicios incorrectos: ${wrong.map(([, n]) => n).join(', ')}`, wrong.map(([k, n, why]) => `${n}: ${why} → ${exp[k] ? 'SÍ' : 'NO'}`).join(' · '), -5 * wrong.length);
  else it(true, 'Servicios según la matriz', svc.map(([k, n]) => `${n}: ${exp[k] ? 'sí' : 'no'}`).join(' · '), 10);
  return items;
}

export function compSummary(form) {
  const svc = [form.meal && 'alimentación', form.hotel && 'hotel', form.transport && 'transporte', form.phone && 'comunicación'].filter(Boolean);
  return `USD ${form.amount} (${form.type === 'cash' ? 'dinero' : 'voucher'}) · protección ${form.prot.label} · servicios: ${svc.join(', ') || 'ninguno'}`;
}
