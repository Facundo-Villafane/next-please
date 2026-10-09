// ARMAS DE FUEGO (retenidos + NOTOC) y ANIMALES EN BODEGA (AVIH) — Guía U4 · Parte I.
// Variantes, documentos, formulario de gestión en el counter y corrección.
import { esc, pick, rnd, addDays, addYears, randomDigits } from './util.js';

const $ = (s) => document.querySelector(s);

export const FIREARMS = [
  { id: 'ok', label: 'Escopeta de caza calibre 12', purpose: 'un viaje de caza', caseKind: 'rigid', doc: 'original', ammoKg: 2.4, accept: true },
  { id: 'ok2', label: 'Pistola 9 mm de tiro deportivo', purpose: 'un torneo de tiro deportivo', caseKind: 'rigid', doc: 'original', ammoKg: 1.2, accept: true },
  { id: 'copy', label: 'Pistola 9 mm de tiro deportivo', purpose: 'un torneo de tiro deportivo', caseKind: 'rigid', doc: 'copy', ammoKg: 1.2, accept: false, why: 'Presenta una FOTOCOPIA de la credencial: para aceptar el arma se requiere el documento ORIGINAL que acredite la tenencia y portación.' },
  { id: 'soft', label: 'Escopeta de caza calibre 12', purpose: 'un viaje de caza', caseKind: 'soft', doc: 'original', ammoKg: 2, accept: false, why: 'El arma viene en una funda blanda: debe transportarse en un estuche o contenedor RÍGIDO, y conseguirlo es responsabilidad exclusiva del pasajero.' },
];
export const AVIH = [
  { id: 'ok', animal: 'perra', breed: 'Golden Retriever', name: 'Lola', kg: 31, kennel: 'ok', docs: true, accept: true },
  { id: 'two', animal: 'dos gatos adultos', breed: 'Europeo común', name: 'Tom y Jerry', kg: '5 y 6', kennel: 'ok', docs: true, accept: true, note: 'Dos adultos acostumbrados a convivir, de hasta 14 kg cada uno, pueden ir en el mismo canil.' },
  { id: 'brachy', animal: 'perro', breed: 'Bulldog francés', name: 'Napoleón', kg: 12, kennel: 'ok', docs: true, accept: false, why: 'El Bulldog francés es una raza braquicéfala (hocico chato): no se acepta en bodega por el riesgo respiratorio.' },
  { id: 'danger', animal: 'perro', breed: 'Pit Bull Terrier', name: 'Rocky', kg: 27, kennel: 'ok', docs: true, accept: false, why: 'Raza considerada peligrosa por la compañía: no se acepta en bodega.' },
  { id: 'small', animal: 'perro', breed: 'Ovejero alemán', name: 'Zeus', kg: 36, kennel: 'small', docs: true, accept: false, why: 'El canil le queda chico: el animal tiene que poder estar de pie en posición natural, darse vuelta y acostarse.' },
  { id: 'damaged', animal: 'perro', breed: 'Labrador', name: 'Bruno', kg: 30, kennel: 'damaged', docs: true, accept: false, why: 'El canil está dañado (puerta que no cierra y un alambre suelto hacia adentro): puede abrirse o lastimar al animal.' },
  { id: 'pups', animal: 'cuatro cachorros de 3 meses', breed: 'Beagle', name: 'la camada', kg: '3 c/u', kennel: 'ok', docs: true, accept: false, why: 'En un mismo canil van como máximo TRES cachorros de menos de 6 meses de la misma camada. Son cuatro.' },
  { id: 'nodocs', animal: 'perro', breed: 'Border Collie', name: 'Chispa', kg: 20, kennel: 'ok', docs: false, accept: false, why: 'Para viajar al exterior se necesita el Certificado Veterinario Internacional de SENASA (con la vacuna antirrábica): no lo presenta.' },
];
const KENNEL_DESC = {
  ok: 'Canil rígido de plástico con puerta metálica, ventilación en los cuatro lados y fondo impermeable con una manta. El animal se para, se da vuelta y se acuesta sin problema.',
  small: 'Canil rígido con ventilación y fondo impermeable, pero el animal va agachado: no puede estar de pie ni darse vuelta.',
  damaged: 'La puerta del canil no traba bien y hay un alambre suelto que apunta hacia adentro. Tiene ventilación y fondo con manta.',
};

// Documentos que se agregan al mostrador
export function firearmDocs(p, fa, today) {
  return [{ type: 'WEAPON_PERMIT', first: p.first, last: p.last, face: { ...p.face }, copy: fa.doc === 'copy', number: `CLU ${randomDigits(7)}`, weapon: fa.label, serial: `${pick(['BRT', 'GLK', 'MSB', 'RMG'])}-${randomDigits(6)}`, expiry: addYears(today, rnd(1, 4)) }];
}
export function avihDocs(p, av, today) {
  if (!av.docs) return [];
  return [{ type: 'PET_CVI', first: p.first, last: p.last, animal: av.animal, breed: av.breed, name: av.name, chip: randomDigits(15), rabies: addDays(today, -rnd(40, 300)), issue: addDays(today, -rnd(1, 8)) }];
}

// ------------------------------------------------------------------
// Formulario de gestión en el counter
// ------------------------------------------------------------------
const NOTOC_OPTS = [
  { k: 'full', label: 'NOTOC completo: notificación al capitán' },
  { k: 'misc', label: 'Sólo la parte inferior del NOTOC (misceláneos)' },
  { k: 'none', label: 'No hace falta NOTOC' },
];
const WEAPON_STEPS = [
  { k: 'psa', label: 'Pedir que la PSA (seguridad aeroportuaria) revise el documento de portación' },
  { k: 'ssr', label: 'Ingresar el SSR WEAP en la reserva' },
  { k: 'ops', label: 'Alertar al encargado de operaciones (gestión del NOTOC)' },
  { k: 'bag', label: 'Colocar el arma en la bolsa de retenidos (cierre seguro, que no se vea el contenido)' },
];
const WEAPON_ROUTE = [
  { k: 'belt', label: 'Despacharla por la cinta, como una valija más' },
  { k: 'cabin', label: 'Que la lleve en cabina, descargada y con candado' },
  { k: 'gate', label: 'Seguridad la retira y la entrega en la puerta de embarque al equipo de seguridad, con la aeronave en posición y estacionada' },
];
const AVIH_STEPS = [
  { k: 'docs', label: 'Verificar el Certificado Veterinario Internacional de SENASA y la antirrábica' },
  { k: 'seal', label: 'Colocar precintos en las puertas del canil' },
  { k: 'ssr', label: 'Ingresar el SSR AVIH en la reserva' },
  { k: 'ops', label: 'Avisar a operaciones para el NOTOC' },
];

export function firearmModal(p, a, ui, onDone) {
  const fa = p.firearm;
  ui.openModal(`<h2>🔫 Arma de fuego declarada</h2>
    <p>${esc(p.first)} viaja a ${esc(fa.purpose)} con una <b>${esc(fa.label)}</b> ${fa.caseKind === 'rigid' ? 'en un <b>estuche rígido</b> con candado' : 'en una <b>funda blanda</b> de lona'}. Munición declarada: <b>${String(fa.ammoKg).replace('.', ',')} kg</b>, en su caja original, aparte.</p>
    <p class="hint">Revisá la credencial de tenencia y portación sobre el mostrador antes de decidir.</p>
    <h3>¿Se acepta el arma?</h3>
    <div class="cfOpts"><label class="inl"><input type="radio" name="faOk" value="yes"> Sí, se acepta como retenido en bodega</label><label class="inl"><input type="radio" name="faOk" value="no"> No se acepta el arma (el pasajero viaja sin ella)</label></div>
    <div id="faMore">
      <h3>Gestión en el counter</h3>
      <div class="kit">${WEAPON_STEPS.map((x) => `<label><input type="checkbox" value="${x.k}"> ${esc(x.label)}</label>`).join('')}</div>
      <h3>¿Cómo llega el arma al avión?</h3>
      <div class="cfOpts">${WEAPON_ROUTE.map((x) => `<label class="inl"><input type="radio" name="faRoute" value="${x.k}"> ${esc(x.label)}</label>`).join('')}</div>
      <h3>NOTOC (munición de ${String(fa.ammoKg).replace('.', ',')} kg)</h3>
      <div class="cfOpts">${NOTOC_OPTS.map((x) => `<label class="inl"><input type="radio" name="faNotoc" value="${x.k}"> ${esc(x.label)}</label>`).join('')}</div>
    </div>
    <div class="row end gap"><button class="btn ghost" id="faNo">Cancelar</button><button class="btn ok" id="faOkBtn">Registrar</button></div>`, 'wide');
  const toggle = () => { $('#faMore').style.display = document.querySelector('input[name="faOk"]:checked')?.value === 'no' ? 'none' : ''; };
  document.querySelectorAll('input[name="faOk"]').forEach((i) => { i.onchange = toggle; });
  $('#faNo').onclick = ui.closeModal;
  $('#faOkBtn').onclick = () => {
    const ok = document.querySelector('input[name="faOk"]:checked')?.value;
    if (!ok) return;
    a.firearm = {
      accept: ok === 'yes',
      steps: [...document.querySelectorAll('#faMore .kit input:checked')].map((i) => i.value),
      route: document.querySelector('input[name="faRoute"]:checked')?.value || null,
      notoc: document.querySelector('input[name="faNotoc"]:checked')?.value || null,
    };
    ui.closeModal();
    onDone(a.firearm);
  };
}

export function avihModal(p, a, ui, onDone) {
  const av = p.avih;
  ui.openModal(`<h2>🐕 Mascota en bodega (AVIH)</h2>
    <p>${esc(p.first)} viaja con <b>${esc(av.name)}</b>: ${esc(av.animal)}, ${esc(av.breed)}, ${esc(String(av.kg))} kg, en un canil para bodega. Lo reservó con anticipación.</p>
    <div class="row gap"><button class="btn" id="avInsp">🔍 Inspeccionar el canil</button></div>
    <p id="avDesc" class="inspectBox" style="display:none"></p>
    <h3>¿Se acepta en bodega?</h3>
    <div class="cfOpts"><label class="inl"><input type="radio" name="avOk" value="yes"> Sí, se acepta como AVIH</label><label class="inl"><input type="radio" name="avOk" value="no"> No se acepta</label></div>
    <div id="avMore">
      <h3>Gestión en el counter</h3>
      <div class="kit">${AVIH_STEPS.map((x) => `<label><input type="checkbox" value="${x.k}"> ${esc(x.label)}</label>`).join('')}</div>
      <h3>NOTOC</h3>
      <div class="cfOpts">${NOTOC_OPTS.map((x) => `<label class="inl"><input type="radio" name="avNotoc" value="${x.k}"> ${esc(x.label)}</label>`).join('')}</div>
    </div>
    <div class="row end gap"><button class="btn ghost" id="avNo">Cancelar</button><button class="btn ok" id="avOkBtn">Registrar</button></div>`, 'wide');
  let inspected = !!a.avihInspected;
  const show = () => { $('#avDesc').style.display = ''; $('#avDesc').textContent = KENNEL_DESC[av.kennel]; };
  if (inspected) show();
  $('#avInsp').onclick = () => { inspected = true; a.avihInspected = true; show(); };
  const toggle = () => { $('#avMore').style.display = document.querySelector('input[name="avOk"]:checked')?.value === 'no' ? 'none' : ''; };
  document.querySelectorAll('input[name="avOk"]').forEach((i) => { i.onchange = toggle; });
  $('#avNo').onclick = ui.closeModal;
  $('#avOkBtn').onclick = () => {
    const ok = document.querySelector('input[name="avOk"]:checked')?.value;
    if (!ok) return;
    a.avih = {
      accept: ok === 'yes', inspected,
      steps: [...document.querySelectorAll('#avMore .kit input:checked')].map((i) => i.value),
      notoc: document.querySelector('input[name="avNotoc"]:checked')?.value || null,
    };
    ui.closeModal();
    onDone(a.avih);
  };
}

// ------------------------------------------------------------------
// Corrección (se suma a la evaluación del pasajero aceptado)
// ------------------------------------------------------------------
export function gradeRestricted(pax, act) {
  const items = [];
  const it = (ok, title, detail, pts) => items.push({ ok, title, detail, pts });
  const fa = pax.firearm;
  if (fa) {
    const r = act.firearm;
    if (!r) it(false, 'No gestionó el arma de fuego declarada', 'Un arma de fuego es un retenido: no se despacha ni va en cabina sin la gestión de seguridad.', -30);
    else if (r.accept !== fa.accept) it(false, fa.accept ? 'Rechazó un arma que cumplía los requisitos' : 'Aceptó un arma que no cumplía los requisitos', fa.accept ? 'Documento original de tenencia y portación y estuche rígido: se acepta como retenido en bodega.' : fa.why, -30);
    else if (!fa.accept) it(true, 'No aceptó el arma', fa.why, 15);
    else {
      const miss = WEAPON_STEPS.filter((x) => !r.steps.includes(x.k));
      if (miss.length) it(false, `Gestión del arma incompleta (${miss.length})`, `Faltó: ${miss.map((x) => x.label.toLowerCase()).join('; ')}.`, -5 * miss.length);
      if (r.route !== 'gate') it(false, 'El arma no viaja así', 'Seguridad retira el retenido y lo entrega en la puerta de embarque al equipo de seguridad, sólo con la aeronave en posición y completamente estacionada.', -20);
      if (r.notoc !== 'none') it(false, 'NOTOC del arma incorrecto', 'Novedad DGR 2024 (edición 65): ya no hace falta NOTOC para armas de fuego con municiones de menos de 5 kg; se tratan como un equipaje más en bodega.', -10);
      if (!miss.length && r.route === 'gate' && r.notoc === 'none') it(true, 'Arma de fuego gestionada correctamente', 'Original + estuche rígido · PSA · SSR WEAP · operaciones · bolsa de retenidos · entrega en la puerta.', 20);
    }
  }
  const av = pax.avih;
  if (av) {
    const r = act.avih;
    if (!r) it(false, 'No gestionó la mascota en bodega (AVIH)', 'El animal no puede quedar en el counter sin aceptación ni rechazo.', -30);
    else {
      if (!r.inspected) it(false, 'No inspeccionó el canil', 'El agente verifica el estado del canil: resistente, cierre seguro, tamaño adecuado, sin daños, ventilación y fondo impermeable.', -10);
      if (r.accept !== av.accept) it(false, av.accept ? 'Rechazó una mascota que cumplía los requisitos' : 'Aceptó en bodega una mascota que no cumplía los requisitos', av.accept ? (av.note || 'Perro o gato de raza permitida, canil reglamentario y documentación SENASA: se acepta.') : av.why, -30);
      else if (!av.accept) it(true, 'No aceptó la mascota en bodega', av.why, 15);
      else {
        const miss = AVIH_STEPS.filter((x) => !r.steps.includes(x.k));
        if (miss.length) it(false, `Gestión del AVIH incompleta (${miss.length})`, `Faltó: ${miss.map((x) => x.label.toLowerCase()).join('; ')}.`, -5 * miss.length);
        if (r.notoc !== 'full') it(false, 'NOTOC del AVIH incorrecto', 'El transporte de animales vivos en bodega (AVIH) requiere NOTOC con notificación al capitán.', -10);
        if (!miss.length && r.notoc === 'full') it(true, `AVIH aceptado correctamente: ${av.name}`, `${av.note ? `${av.note} ` : ''}Canil inspeccionado y precintado · SSR AVIH · NOTOC al capitán.`, 20);
      }
    }
  }
  return items;
}
