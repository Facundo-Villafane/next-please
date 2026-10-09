// Renderizado de rostros (SVG), zona MRZ y documentos de viaje.
import { COUNTRIES, AIRLINE, STATION } from './data.js';
import { esc, fmtPass, fmtDate, fmtGds, yymmdd, norm } from './util.js';

export const SKIN = ['#f6d7c3', '#e9b994', '#c98f68', '#8e5b3c', '#5d3b25'];
export const HAIR = { negro: '#1d1714', castano: '#4a2f1e', castanoClaro: '#7a5233', rubio: '#c9a35b', pelirrojo: '#9c4422', canoso: '#b8b5b0', blanco: '#e3e1dc' };
export const EYES = ['#3b2a1d', '#5b3d22', '#3f6a3a', '#3d6c9b', '#6b6b4a'];

// ------------------------------------------------------------------
// Rostro SVG a partir de atributos
// ------------------------------------------------------------------
export function faceSVG(f, { bg = '#dce7f0', w = 100, h = 125 } = {}) {
  const skin = SKIN[f.skin];
  const hair = f.hairColor;
  const shapes = { round: [24, 26], oval: [21, 28], long: [19, 31] };
  const kid = (f.age ?? 30) < 12, baby = (f.age ?? 30) < 3 || f.hairStyle === 'baby';
  // Chicos: cara más redonda y grande en la foto; bebés todavía más
  const [rx, ry] = baby ? [27, 27] : kid ? [24, 25.5] : (shapes[f.shape] || shapes.oval);
  const cx = 50, cy = baby ? 60 : 56;
  const top = cy - ry;
  const p = [];
  p.push(`<rect width="100" height="125" fill="${bg}"/>`);
  // cabello largo (detrás)
  if (f.hairStyle === 'long') p.push(`<path d="M${cx - rx - 6},${cy - 6} Q${cx},${top - 22} ${cx + rx + 6},${cy - 6} L${cx + rx + 8},${cy + 34} L${cx - rx - 8},${cy + 34} Z" fill="${hair}"/>`);
  // hombros y cuello
  p.push(baby ? `<path d="M20,125 Q24,102 40,98 L60,98 Q76,102 80,125 Z" fill="${f.shirt}"/>` : `<path d="M8,125 Q12,96 40,92 L60,92 Q88,96 92,125 Z" fill="${f.shirt}"/>`);
  p.push(`<rect x="${cx - 8}" y="${cy + ry - 8}" width="16" height="16" fill="${skin}"/>`);
  p.push(`<path d="M42,92 L50,102 L58,92" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/>`);
  // orejas
  p.push(`<ellipse cx="${cx - rx}" cy="${cy}" rx="4" ry="6.5" fill="${skin}"/><ellipse cx="${cx + rx}" cy="${cy}" rx="4" ry="6.5" fill="${skin}"/>`);
  // cabeza
  p.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>`);
  // arrugas
  if (f.age >= 55) p.push(`<path d="M${cx - 9},${top + 12} q9,-3 18,0 M${cx - 7},${top + 16} q7,-2 14,0" stroke="rgba(0,0,0,.18)" fill="none" stroke-width="1"/>`);
  // cabello delantero
  if (f.hairStyle === 'short' || f.hairStyle === 'long' || f.hairStyle === 'bun') {
    p.push(`<path d="M${cx - rx - 1},${cy - 4} Q${cx - rx - 2},${top - 8} ${cx},${top - 7} Q${cx + rx + 2},${top - 8} ${cx + rx + 1},${cy - 4} Q${cx + rx - 4},${top + 6} ${cx + 4},${top + 8} Q${cx - rx + 2},${top + 8} ${cx - rx - 1},${cy - 4} Z" fill="${hair}"/>`);
  }
  if (f.hairStyle === 'bun') p.push(`<circle cx="${cx}" cy="${top - 10}" r="8" fill="${hair}"/>`);
  if (f.hairStyle === 'baby') p.push(`<path d="M${cx - 4},${top + 3} q1,-9 9,-7 q-6,1 -5,7" fill="${hair}" stroke="${hair}" stroke-width="1.5" stroke-linejoin="round"/>`);
  if (f.hairStyle === 'curly') {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      p.push(`<circle cx="${cx + Math.cos(a) * (rx + 1)}" cy="${cy - 6 + Math.sin(a) * (ry + 1)}" r="7.5" fill="${hair}"/>`);
    }
  }
  if (f.hairStyle === 'bald') {
    p.push(`<path d="M${cx - rx},${cy - 2} q-1,-10 3,-14 M${cx + rx},${cy - 2} q1,-10 -3,-14" stroke="${hair}" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  }
  // cejas
  const bw = kid ? 1 : f.brows === 'thick' ? 2.6 : 1.3;
  const by = cy - 9;
  p.push(`<path d="M${cx - 15},${by} q6,-3 11,0 M${cx + 4},${by} q5,-3 11,0" stroke="${f.hairStyle === 'bald' ? '#5a463a' : hair}" stroke-width="${bw}" fill="none" stroke-linecap="round"/>`);
  // ojos
  const erx = kid ? 4.8 : 4.2, ery = kid ? 3.6 : 2.6, eir = kid ? 2.7 : 2;
  p.push(`<ellipse cx="${cx - 9}" cy="${cy - 2}" rx="${erx}" ry="${ery}" fill="#fff"/><ellipse cx="${cx + 9}" cy="${cy - 2}" rx="${erx}" ry="${ery}" fill="#fff"/>`);
  p.push(`<circle cx="${cx - 9}" cy="${cy - 2}" r="${eir}" fill="${EYES[f.eye]}"/><circle cx="${cx + 9}" cy="${cy - 2}" r="${eir}" fill="${EYES[f.eye]}"/>`);
  // nariz
  const noses = [
    `M${cx},${cy} l-3,9 q3,2 6,0`,
    `M${cx - 1},${cy - 1} q-5,10 -1,11 q4,1 6,-1`,
    `M${cx},${cy} q-6,8 -4,10 h8 q2,-2 -4,-10`,
  ];
  p.push(kid ? `<path d="M${cx - 2.5},${cy + 7} q2.5,2 5,0" stroke="rgba(0,0,0,.3)" stroke-width="1.1" fill="none" stroke-linecap="round"/>` : `<path d="${noses[f.nose] || noses[0]}" stroke="rgba(0,0,0,.35)" stroke-width="1.2" fill="none"/>`);
  if (kid && !f.flushed) p.push(`<ellipse cx="${cx - 13}" cy="${cy + 7}" rx="5" ry="3" fill="#f08a8a" opacity=".35"/><ellipse cx="${cx + 13}" cy="${cy + 7}" rx="5" ry="3" fill="#f08a8a" opacity=".35"/>`);
  // barba
  if (f.beard) p.push(`<path d="M${cx - rx + 2},${cy + 4} Q${cx - rx + 4},${cy + ry + 2} ${cx},${cy + ry + 2} Q${cx + rx - 4},${cy + ry + 2} ${cx + rx - 2},${cy + 4} Q${cx + 8},${cy + 18} ${cx},${cy + 16} Q${cx - 8},${cy + 18} ${cx - rx + 2},${cy + 4} Z" fill="${hair}" opacity=".85"/>`);
  // rubor (consumo de alcohol: congestión en el rostro)
  if (f.flushed) p.push(`<ellipse cx="${cx - 12}" cy="${cy + 7}" rx="6" ry="3.5" fill="#e0473d" opacity=".45"/><ellipse cx="${cx + 12}" cy="${cy + 7}" rx="6" ry="3.5" fill="#e0473d" opacity=".45"/><path d="M${cx - 5},${cy - 2} h-8 M${cx + 5},${cy - 2} h8" stroke="#b33" stroke-width=".6" opacity=".6"/>`);
  // boca
  p.push(kid ? `<path d="M${cx - 4},${cy + 13} q4,3 8,0" stroke="#b0574f" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : `<path d="M${cx - 6},${cy + 15} q6,${f.smile ? 4 : 1.5} 12,0" stroke="#8a4a3c" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
  // anteojos
  if (f.glasses) {
    p.push(`<g fill="none" stroke="#222" stroke-width="1.5"><rect x="${cx - 16}" y="${cy - 7}" width="13" height="10" rx="3"/><rect x="${cx + 3}" y="${cy - 7}" width="13" height="10" rx="3"/><path d="M${cx - 3},${cy - 3} h6"/></g>`);
  }
  return `<svg viewBox="0 0 100 125" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${p.join('')}</svg>`;
}

// ------------------------------------------------------------------
// MRZ (ICAO 9303)
// ------------------------------------------------------------------
export function mrzCheck(str) {
  const w = [7, 3, 1];
  let s = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    let v = 0;
    if (c === '<') v = 0;
    else if (/\d/.test(c)) v = +c;
    else v = c.charCodeAt(0) - 55;
    s += v * w[i % 3];
  }
  return String(s % 10);
}
const fill = (s, n) => (s + '<'.repeat(n)).slice(0, n);
const mrzName = (last, first) => norm(last).replace(/ /g, '<') + '<<' + norm(first).replace(/ /g, '<');

export function mrzTD3(d) {
  const iso = COUNTRIES[d.country].iso3;
  const nat = COUNTRIES[d.nationality].iso3;
  const l1 = fill(`P<${iso}${mrzName(d.last, d.first)}`, 44);
  const num = fill(d.number, 9);
  const dob = yymmdd(d.dob), exp = yymmdd(d.expiry);
  const pers = fill('', 14);
  const part = num + mrzCheck(num) + nat + dob + mrzCheck(dob) + d.sex + exp + mrzCheck(exp) + pers + mrzCheck(pers);
  const comp = mrzCheck(num + mrzCheck(num) + dob + mrzCheck(dob) + exp + mrzCheck(exp) + pers + mrzCheck(pers));
  return [l1, part + comp];
}
export function mrzTD1(d) {
  const iso = COUNTRIES[d.country].iso3;
  const nat = COUNTRIES[d.nationality].iso3;
  const num = fill(d.number, 9);
  const l1 = fill(`ID${iso}${num}${mrzCheck(num)}`, 30);
  const dob = yymmdd(d.dob), exp = yymmdd(d.expiry);
  const l2a = dob + mrzCheck(dob) + d.sex + exp + mrzCheck(exp) + nat;
  const l2 = fill(l2a, 29) + mrzCheck(l1.slice(5, 30) + l2a);
  const l3 = fill(mrzName(d.last, d.first), 30);
  return [l1, l2, l3];
}
export function mrzVisa(d) {
  const nat = COUNTRIES[d.nationality].iso3;
  const l1 = fill(`V<USA${mrzName(d.last, d.first)}`, 44);
  const num = fill(d.number, 9);
  const dob = yymmdd(d.dob), exp = yymmdd(d.expiry);
  const l2 = fill(num + mrzCheck(num) + nat + dob + mrzCheck(dob) + d.sex + exp + mrzCheck(exp) + 'B1B2', 44);
  return [l1, l2];
}

// ------------------------------------------------------------------
// Documentos
// ------------------------------------------------------------------
const PASS_HEAD = {
  AR: ['REPÚBLICA ARGENTINA', 'MERCOSUR', 'PASAPORTE / PASSPORT', '#14365a'],
  BR: ['REPÚBLICA FEDERATIVA DO BRASIL', 'MERCOSUL', 'PASSAPORTE / PASSPORT', '#163f2b'],
  UY: ['REPÚBLICA ORIENTAL DEL URUGUAY', 'MERCOSUR', 'PASAPORTE / PASSPORT', '#3a2a55'],
  CL: ['REPÚBLICA DE CHILE', '', 'PASAPORTE / PASSPORT', '#4a1d24'],
  ES: ['REINO DE ESPAÑA', 'UNIÓN EUROPEA', 'PASAPORTE / PASSPORT', '#5b1424'],
  US: ['UNITED STATES OF AMERICA', '', 'PASSPORT', '#1b2a4a'],
};

const field = (label, value, cls = '') => `<div class="f ${cls}"><span class="l">${label}</span><span class="v">${esc(value)}</span></div>`;

export function docTitle(d) {
  switch (d.type) {
    case 'PASSPORT': return `Pasaporte ${COUNTRIES[d.country].iso3}${d.old ? ' (anterior)' : ''}`;
    case 'ID': return COUNTRIES[d.country].idName;
    case 'VISA_US': return 'Visa EE.UU.';
    case 'EVISA_BR': return 'e-Visa Brasil';
    case 'AUTH_MINOR': return 'Autorización de viaje';
    case 'BOOKING': return 'Reserva / e-ticket';
    case 'MED_CERT': return 'Certificado médico';
    case 'DRIVER_LICENSE': return 'Licencia de conducir';
    case 'POLICE_REPORT': return 'Denuncia policial';
    case 'DNI_TRAMITE': return 'Constancia de DNI en trámite';
    case 'WEAPON_PERMIT': return 'Credencial de armas';
    case 'PET_CVI': return 'Certificado veterinario';
    case 'ESCORT_ID': return 'Credencial de escolta';
    case 'LEGAL_ORDER': return d.kind === 'DEPA' ? 'Oficio judicial' : 'Disposición de expulsión';
    case 'RESIDENCE': return d.country === 'US' ? 'Green Card' : 'TIE (residencia)';
    case 'BIRTH_CERT': return 'Partida de nacimiento';
    case 'DEATH_CERT': return 'Acta de defunción';
    case 'COURT_AUTH': return 'Autorización judicial';
    case 'GUARDIANSHIP': return 'Certificado de tutela';
    case 'BOARDING_PASS': return 'Tarjeta de embarque';
    default: return d.type;
  }
}

export function renderDoc(d) {
  switch (d.type) {
    case 'PASSPORT': return renderPassport(d);
    case 'ID': return renderId(d);
    case 'VISA_US': return renderVisaUS(d);
    case 'EVISA_BR': return renderEvisaBR(d);
    case 'AUTH_MINOR': return renderAuth(d);
    case 'BOOKING': return renderBooking(d);
    case 'MED_CERT': return renderMedCert(d);
    case 'DRIVER_LICENSE': return renderLicense(d);
    case 'POLICE_REPORT': return renderPoliceReport(d);
    case 'DNI_TRAMITE': return renderTramite(d);
    case 'WEAPON_PERMIT': return renderWeaponPermit(d);
    case 'PET_CVI': return renderPetCvi(d);
    case 'ESCORT_ID': return renderEscortId(d);
    case 'LEGAL_ORDER': return renderLegalOrder(d);
    case 'RESIDENCE': return renderResidence(d);
    case 'BIRTH_CERT': return renderBirthCert(d);
    case 'DEATH_CERT': return renderDeathCert(d);
    case 'COURT_AUTH': return renderCourtAuth(d);
    case 'GUARDIANSHIP': return renderGuardianship(d);
    case 'BOARDING_PASS': return renderBoardingPass(d);
  }
  return '';
}

function renderResidence(d) {
  const us = d.country === 'US';
  return `<div class="doc idcard resid" style="--dc:${us ? '#3b7a57' : '#a0302b'}">
    <div class="idh"><b>${us ? 'UNITED STATES OF AMERICA' : 'REINO DE ESPAÑA'}</b><span>${us ? 'PERMANENT RESIDENT' : 'TARJETA DE IDENTIDAD DE EXTRANJERO · RESIDENCIA'}</span></div>
    <div class="idbody">
      <div class="photo">${faceSVG(d.face, { w: 78, h: 98 })}</div>
      <div class="fields">
        ${field(us ? 'Surname' : 'Apellidos', d.last.toUpperCase())}
        ${field(us ? 'Given Name' : 'Nombre', d.first.toUpperCase())}
        <div class="row">${field(us ? 'Country of Birth' : 'Nacionalidad', COUNTRIES[d.nationality].name.toUpperCase())}${field(us ? 'Category' : 'Tipo', us ? 'IR1' : 'RESIDENCIA')}</div>
        <div class="row">${field(us ? 'USCIS#' : 'NIE', d.number, 'mono')}${field(us ? 'Card Expires' : 'Validez', fmtPass(d.expiry), 'exp')}</div>
      </div>
    </div>
  </div>`;
}

function renderEscortId(d) {
  const priv = /PRIVADA/.test(d.agency);
  return `<div class="doc idcard escort" style="--dc:${priv ? '#5b5b5b' : '#1d2f5e'}">
    <div class="idh"><b>${esc(d.agency)}</b><span>${priv ? 'CREDENCIAL DE PERSONAL' : 'CREDENCIAL POLICIAL · ESCOLTA'}</span></div>
    <div class="idbody">
      <div class="photo">${faceSVG(d.face, { w: 78, h: 98 })}</div>
      <div class="fields">
        ${field('Apellido', d.last.toUpperCase())}${field('Nombre', d.first.toUpperCase())}
        <div class="row">${field('Jerarquía', priv ? 'Vigilador' : d.rank)}${field('Legajo', d.number, 'mono')}</div>
        ${field('Vigencia', fmtDate(d.expiry), 'exp')}
      </div>
    </div>
  </div>`;
}

function renderLegalOrder(d) {
  const depa = d.kind === 'DEPA';
  const head = depa ? `JUZGADO NACIONAL EN LO CRIMINAL Y CORRECCIONAL FEDERAL N° ${d.court}` : 'DIRECCIÓN NACIONAL DE MIGRACIONES · MINISTERIO DEL INTERIOR';
  const title = depa ? 'OFICIO JUDICIAL · TRASLADO DE DETENIDO / EXTRADICIÓN' : `DISPOSICIÓN DE EXPULSIÓN · ${d.kind === 'DEPU' ? 'SIN CUSTODIA' : 'CON CUSTODIA'}`;
  const body = depa
    ? `Se ordena el traslado de <b>${esc(d.first.toUpperCase())} ${esc(d.last.toUpperCase())}</b>, privado/a de su libertad, en el vuelo <b>${esc(d.flightNo)}</b> con destino a <b>${esc(d.dest)}</b>, bajo custodia de ${esc(d.agency || '')}: ${d.escorts.map((e) => `<b>${esc(e)}</b>`).join(' y ')}.`
    : `Se dispone la expulsión de <b>${esc(d.first.toUpperCase())} ${esc(d.last.toUpperCase())}</b> (${esc(COUNTRIES[d.nationality].name)}) hacia <b>${esc(d.dest)}</b> en el vuelo <b>${esc(d.flightNo)}</b>${d.escorts.length ? `, acompañado/a por ${d.escorts.map((e) => `<b>${esc(e)}</b>`).join(' y ')} (${esc(d.agency)})` : ', sin custodia. Su viaje es responsabilidad del Ministerio del Interior'}.`;
  return `<div class="doc paper auth">
    <div class="ph2"><b>${title}</b><span>${head} · N° ${esc(d.number)}</span></div>
    <p>Buenos Aires, ${fmtDate(d.date)}. ${body}</p>
    <div class="sigs"><span>${depa ? 'Juez/a' : 'Director/a de Extranjería'}</span><span class="seal">${depa ? 'PODER<br>JUDICIAL' : 'DNM'}</span></div>
  </div>`;
}

function renderWeaponPermit(d) {
  return `<div class="doc idcard ${d.copy ? 'photocopy' : ''}" style="--dc:#3d4a3a">
    <div class="idh"><b>REPÚBLICA ARGENTINA · ANMaC</b><span>CREDENCIAL DE LEGÍTIMO USUARIO DE ARMAS DE FUEGO · TENENCIA Y PORTACIÓN</span></div>
    <div class="idbody"><div class="photo">${faceSVG(d.face, { w: 78, h: 98 })}</div>
      <div class="fields">${field('Titular', `${d.last.toUpperCase()}, ${d.first.toUpperCase()}`)}${field('Arma registrada', d.weapon)}
        <div class="row">${field('N° de serie', d.serial, 'mono')}${field('Credencial', d.number, 'mono')}</div>${field('Vencimiento', fmtDate(d.expiry), 'exp')}</div></div>
    ${d.copy ? '<div class="stamp-copy">FOTOCOPIA</div>' : ''}
  </div>`;
}
function renderPetCvi(d) {
  return `<div class="doc paper auth">
    <div class="ph2"><b>CERTIFICADO VETERINARIO INTERNACIONAL (CVI)</b><span>SENASA · Servicio Nacional de Sanidad y Calidad Agroalimentaria</span></div>
    <div class="row">${field('Animal', `${d.name} · ${d.animal}`)}${field('Raza', d.breed)}</div>
    <div class="row">${field('Microchip', d.chip, 'mono')}${field('Antirrábica aplicada', fmtDate(d.rabies))}</div>
    <div class="row">${field('Propietario', `${d.first} ${d.last}`)}${field('Emitido', fmtDate(d.issue))}</div>
    <p>Se certifica que el/los animal(es) descripto(s) fue(ron) examinado(s) y se encuentra(n) clínicamente sano(s) y apto(s) para viajar.</p>
    <div class="sigs"><span>Veterinario oficial</span><span class="seal">SENASA</span></div>
  </div>`;
}


function renderLicense(d) {
  return `<div class="doc idcard" style="--dc:#2a6b8f">
    <div class="idh"><b>REPÚBLICA ARGENTINA</b><span>LICENCIA NACIONAL DE CONDUCIR</span></div>
    <div class="idbody"><div class="photo">${faceSVG(d.face, { w: 78, h: 98 })}</div>
      <div class="fields">${field('Apellido', d.last.toUpperCase())}${field('Nombre', d.first.toUpperCase())}
        <div class="row">${field('DNI', d.number, 'mono')}${field('Clase', 'B1')}</div>
        <div class="row">${field('Nacimiento', fmtPass(d.dob))}${field('Vencimiento', fmtPass(d.expiry), 'exp')}</div></div></div>
  </div>`;
}
function renderPoliceReport(d) {
  return `<div class="doc paper auth">
    <div class="ph2"><b>DENUNCIA POR ${d.robbery ? 'ROBO' : 'EXTRAVÍO'} DE DOCUMENTACIÓN</b><span>Policía de la Ciudad · Comisaría Vecinal ${d.station} · Acta N° ${d.number}</span></div>
    <p>En la Ciudad de Buenos Aires, el ${fmtDate(d.issue)}, se presenta <b>${esc(d.first.toUpperCase())} ${esc(d.last.toUpperCase())}</b>, DNI N° <b>${esc(d.dni)}</b>, nacido/a el ${fmtDate(d.dob)}, y denuncia el ${d.robbery ? 'robo' : 'extravío'} de su Documento Nacional de Identidad${d.robbery ? ' junto con su billetera, en la vía pública' : ''}.</p>
    <div class="sigs"><span>Oficial de servicio</span><span class="seal">POLICÍA<br>DE LA<br>CIUDAD</span></div>
  </div>`;
}
function renderTramite(d) {
  return `<div class="doc paper auth">
    <div class="ph2"><b>CONSTANCIA DE DNI EN TRÁMITE</b><span>RENAPER · Registro Nacional de las Personas · Trámite N° ${d.tramite}</span></div>
    <div class="row" style="align-items:flex-start;gap:12px"><div class="photo">${faceSVG(d.face, { w: 70, h: 88 })}</div>
      <div>${field('Apellido y nombre', `${d.last.toUpperCase()}, ${d.first.toUpperCase()}`)}${field('DNI', d.number, 'mono')}${field('Motivo', 'Nuevo ejemplar por extravío')}${field('Válida hasta', fmtDate(d.expiry), 'exp')}</div></div>
  </div>`;
}

function renderBoardingPass(d) {
  return `<div class="doc bpdoc">
    <div class="bpdH"><b>✈ ${AIRLINE.name}</b><span>TARJETA DE EMBARQUE · BOARDING PASS</span>${d.web ? '<em class="webTag">📱 WEB CHECK-IN</em>' : ''}</div>
    <div class="bpdName">${esc(norm(d.last))}/${esc(norm(d.first))} ${d.title}</div>
    <div class="bpdGrid">
      ${field('Desde', STATION.code)}${field('Hacia', d.dest)}${field('Vuelo', d.flightNo)}${field('Fecha', fmtGds(d.date))}
      ${field('Embarque', d.boarding)}${field('Puerta', d.gate)}${field('Asiento', d.seat, 'big')}${field('Zona', d.zone, 'big')}
    </div>
    <div class="row">${field('Clase', d.cls)}${field('Secuencia', 'SEQ ' + String(d.seq).padStart(3, '0'))}${d.ssr ? field('SSR', d.ssr) : ''}</div>
    <div class="barcode"></div>
  </div>`;
}

function renderPassport(d) {
  const [c1, c2, c3, color] = PASS_HEAD[d.country];
  const mrz = mrzTD3(d);
  const canceled = d.old ? `<div class="stamp-cancel">ANULADO · CANCELLED</div>` : '';
  return `<div class="doc passport" style="--dc:${color}">
    <div class="ph"><b>${c1}</b><span>${c2}</span><em>${c3}</em></div>
    <div class="pbody">
      <div class="photo">${faceSVG(d.face, { w: 96, h: 120 })}</div>
      <div class="fields">
        <div class="row">${field('Tipo / Type', 'P')}${field('Código / Code', COUNTRIES[d.country].iso3)}${field('Pasaporte N° / Passport No.', d.number, 'mono')}</div>
        ${field('Apellido / Surname', d.last.toUpperCase())}
        ${field('Nombre / Given names', d.first.toUpperCase())}
        <div class="row">${field('Nacionalidad / Nationality', COUNTRIES[d.nationality].name.toUpperCase())}${field('Sexo / Sex', d.sex)}</div>
        <div class="row">${field('Fecha de nacimiento / Date of birth', fmtPass(d.dob))}${field('Lugar de nacimiento', d.birthPlace)}</div>
        <div class="row">${field('Fecha de emisión / Date of issue', fmtPass(d.issue))}${field('Fecha de vencimiento / Date of expiry', fmtPass(d.expiry), 'exp')}</div>
      </div>
    </div>
    <div class="mrz">${mrz.map(esc).join('<br>')}</div>
    ${canceled}
  </div>`;
}

function renderId(d) {
  const color = { AR: '#2d6d9c', BR: '#3f7d4c', UY: '#4b5e8e', CL: '#3d6577', ES: '#4a6a8a' }[d.country] || '#456';
  const mrz = mrzTD1(d);
  const numFmt = d.country === 'AR' ? d.number.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : d.number;
  return `<div class="doc idcard" style="--dc:${color}">
    <div class="idh"><b>${PASS_HEAD[d.country][0]}</b><span>${COUNTRIES[d.country].idName.toUpperCase()}</span></div>
    <div class="idbody">
      <div class="photo">${faceSVG(d.face, { w: 78, h: 98 })}</div>
      <div class="fields">
        ${field('Apellido / Surname', d.last.toUpperCase())}
        ${field('Nombre / Name', d.first.toUpperCase())}
        <div class="row">${field('Sexo', d.sex)}${field('Nacionalidad', COUNTRIES[d.nationality].name.toUpperCase())}</div>
        <div class="row">${field('Fecha de nacimiento', fmtPass(d.dob))}${field('Documento', numFmt, 'mono')}</div>
        <div class="row">${field('Fecha de emisión', fmtPass(d.issue))}${field('Fecha de vencimiento', fmtPass(d.expiry), 'exp')}</div>
      </div>
    </div>
    <div class="idback"><span>Dorso</span><div class="mrz small">${mrz.map(esc).join('<br>')}</div></div>
  </div>`;
}

function renderVisaUS(d) {
  return `<div class="doc visa">
    <div class="vh"><b>UNITED STATES OF AMERICA</b><em>VISA</em></div>
    <div class="vbody">
      <div class="photo">${faceSVG(d.face, { w: 78, h: 98, bg: '#e8e3d0' })}</div>
      <div class="fields">
        <div class="row">${field('Issuing Post Name', 'BUENOS AIRES')}${field('Control Number', d.control, 'mono')}</div>
        ${field('Surname', d.last.toUpperCase())}
        ${field('Given Name', d.first.toUpperCase())}
        <div class="row">${field('Passport Number', d.linkedPassport, 'mono')}${field('Sex', d.sex)}${field('Birth Date', fmtGds(d.dob))}</div>
        <div class="row">${field('Visa Type/Class', 'R  B1/B2')}${field('Entries', 'M')}${field('Nationality', COUNTRIES[d.nationality].iso3)}</div>
        <div class="row">${field('Issue Date', fmtGds(d.issue))}${field('Expiration Date', fmtGds(d.expiry), 'exp')}</div>
      </div>
    </div>
    <div class="mrz">${mrzVisa({ ...d, number: d.linkedPassport }).map(esc).join('<br>')}</div>
    <div class="vnote">Visa adherida en pasaporte N° ${esc(d.linkedPassport)}</div>
  </div>`;
}

function renderEvisaBR(d) {
  return `<div class="doc paper evisa">
    <div class="ph2"><b>REPÚBLICA FEDERATIVA DO BRASIL</b><span>Ministério das Relações Exteriores</span><em>e-VISA · VISTO ELETRÔNICO</em></div>
    <div class="fields">
      <div class="row">${field('Nº do Visto', d.control, 'mono')}${field('Tipo', 'VIVIS – Visita')}</div>
      ${field('Nome / Name', `${d.last.toUpperCase()}, ${d.first.toUpperCase()}`)}
      <div class="row">${field('Passaporte', d.linkedPassport, 'mono')}${field('Nacionalidade', COUNTRIES[d.nationality].name.toUpperCase())}</div>
      <div class="row">${field('Data de emissão', fmtDate(d.issue))}${field('Válido até', fmtDate(d.expiry), 'exp')}</div>
      ${field('Estadia máxima', '90 dias')}
    </div>
    <div class="qr"></div>
  </div>`;
}

function renderAuth(d) {
  if (d.mode === 'letter') {
    return `<div class="doc paper auth letter">
    <p class="hand">${d.consulate ? esc(d.consulate.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())) : 'Buenos Aires'}, ${fmtDate(d.issue)}</p>
    <p class="hand">A quien corresponda:<br>Yo, ${esc(d.parent1)}, DNI ${esc(d.parent1Doc)}, autorizo a mi hijo/a ${esc(d.first)} ${esc(d.last)} a viajar con ${esc(d.companion)} a donde quieran. Estoy trabajando afuera y no puedo ir.<br>Gracias!!</p>
    <p class="hand sign">${esc(d.parent1)}</p>
    <div class="vnote">Impresión de una foto recibida por WhatsApp · sin sello ni legalización</div>
  </div>`;
  }
  if (d.mode === 'consular') {
    return `<div class="doc paper auth">
    <div class="ph2"><b>AUTORIZACIÓN DE VIAJE PARA MENORES DE EDAD</b><span>Consulado General de la República Argentina en ${esc(d.consulate)} · Actuación consular N° ${d.notary}</span></div>
    <p>En la ciudad de ${esc(d.consulate)}, a los ${d.issue.getDate()} días del mes ${d.issue.getMonth() + 1} de ${d.issue.getFullYear()}, comparece ante el Cónsul
    <b>${esc(d.parent1)}</b> (DNI ${esc(d.parent1Doc)}), progenitor/a residente en el exterior, y AUTORIZA a su hijo/a <b>${esc(d.first.toUpperCase())} ${esc(d.last.toUpperCase())}</b>, documento N° <b>${esc(d.minorDoc)}</b>,
    a salir de la República Argentina <b>en compañía de ${esc(d.companion)}</b> (DNI ${esc(d.companionDoc)}), con destino a <b>${esc(d.destination)}</b>.</p>
    <div class="row">${field('Vigencia hasta', fmtDate(d.expiry), 'exp')}${field('Registro', `Consulado en ${d.consulate}`)}</div>
    <div class="sigs"><span>Firma progenitor/a</span><span>Firma y sello del Cónsul</span><span class="seal">CONSULADO<br>ARGENTINO<br>${esc(d.consulate).replace(/ /g, '<br>')}</span></div>
  </div>`;
  }
  const who = d.parent2
    ? `<b>${esc(d.parent1)}</b> (DNI ${esc(d.parent1Doc)}) y <b>${esc(d.parent2)}</b> (DNI ${esc(d.parent2Doc)}), en su carácter de progenitores,`
    : `<b>${esc(d.parent1)}</b> (DNI ${esc(d.parent1Doc)}), en su carácter de progenitor/a,`;
  const how = d.mode === 'one' ? `a salir del país <b>en compañía de su otro/a progenitor/a, ${esc(d.companion)}</b> (DNI ${esc(d.companionDoc)}),`
    : d.mode === 'relative' ? `a salir del país <b>en compañía de ${esc(d.companion)}</b> (DNI ${esc(d.companionDoc)}), quien viajará a cargo del menor,`
      : '<b>sin la compañía de sus progenitores</b>';
  return `<div class="doc paper auth">
    <div class="ph2"><b>AUTORIZACIÓN DE VIAJE PARA MENORES DE EDAD</b><span>Ley 26.061 · Disposición DNM</span></div>
    <p>En la Ciudad de Buenos Aires, a los ${d.issue.getDate()} días del mes ${d.issue.getMonth() + 1} de ${d.issue.getFullYear()}, comparece${d.parent2 ? 'n' : ''}
    ${who} y AUTORIZA${d.parent2 ? 'N' : ''} a su hijo/a <b>${esc(d.first.toUpperCase())} ${esc(d.last.toUpperCase())}</b>, DNI <b>${esc(d.minorDoc)}</b>,
    ${how} con destino a <b>${esc(d.destination)}</b>.</p>
    <div class="row">${field('Vigencia hasta', fmtDate(d.expiry), 'exp')}${field('Registro', `Escribanía N° ${d.notary}`)}</div>
    <div class="sigs"><span>Firma progenitor/a</span>${d.parent2 ? '<span>Firma progenitor/a</span>' : ''}<span class="seal">ESCRIBANO<br>PÚBLICO<br>N° ${d.notary}</span></div>
  </div>`;
}

function renderBirthCert(d) {
  return `<div class="doc paper birth">
    <div class="ph2"><b>ACTA DE NACIMIENTO</b><span>Registro del Estado Civil y Capacidad de las Personas · Tomo ${d.tomo} · Acta N° ${d.acta}</span></div>
    <div class="row">${field('Apellido', d.last.toUpperCase())}${field('Nombre', d.first.toUpperCase())}</div>
    <div class="row">${field('Fecha de nacimiento', fmtDate(d.dob))}${field('Lugar', d.place)}</div>
    <div class="row">${field('Padre', d.father.toUpperCase())}${field('DNI', d.fatherDoc)}</div>
    <div class="row">${field('Madre', d.mother.toUpperCase())}${field('DNI', d.motherDoc)}</div>
    <div class="sigs"><span>Oficial público</span><span class="seal">REGISTRO<br>CIVIL</span></div>
  </div>`;
}
function renderDeathCert(d) {
  return `<div class="doc paper birth">
    <div class="ph2"><b>ACTA DE DEFUNCIÓN</b><span>Registro del Estado Civil y Capacidad de las Personas · Tomo ${d.tomo} · Acta N° ${d.acta}</span></div>
    <div class="row">${field('Apellido', d.last.toUpperCase())}${field('Nombre', d.first.toUpperCase())}</div>
    <div class="row">${field('DNI', d.doc)}${field('Fecha de defunción', fmtDate(d.dod))}</div>
    ${field('Lugar', d.place)}
    <div class="sigs"><span>Oficial público</span><span class="seal">REGISTRO<br>CIVIL</span></div>
  </div>`;
}

function renderCourtAuth(d) {
  return `<div class="doc paper auth">
    <div class="ph2"><b>AUTORIZACIÓN JUDICIAL SUPLETORIA DE VIAJE</b><span>Juzgado Nacional de Primera Instancia en lo Civil N° ${d.court} (Familia) · Expte. N° ${esc(d.expte)}</span></div>
    <p>Buenos Aires, ${fmtDate(d.issue)}. AUTOS Y VISTOS: atento la ausencia de <b>${esc(d.absent)}</b>, cuyo paradero se desconoce, y lo dictaminado por el Ministerio Público,
    RESUELVO: autorizar al/la menor <b>${esc(d.first.toUpperCase())} ${esc(d.last.toUpperCase())}</b>, documento N° <b>${esc(d.minorDoc)}</b>, a salir del país
    <b>en compañía de ${esc(d.companion)}</b> (DNI ${esc(d.companionDoc)}), con destino a <b>${esc(d.destination)}</b>.</p>
    <div class="row">${field('Vigencia hasta', fmtDate(d.expiry), 'exp')}${field('Destino autorizado', d.destination)}</div>
    <div class="sigs"><span>Juez/a</span><span>Secretario/a</span><span class="seal">PODER<br>JUDICIAL<br>DE LA NACIÓN</span></div>
  </div>`;
}

function renderGuardianship(d) {
  return `<div class="doc paper auth">
    <div class="ph2"><b>TESTIMONIO · DISCERNIMIENTO DE TUTELA</b><span>Juzgado Nacional de Primera Instancia en lo Civil N° ${d.court} (Familia) · Expte. N° ${esc(d.expte)}</span></div>
    <p>Buenos Aires, ${fmtDate(d.issue)}. Se discierne la <b>tutela</b> de ${d.kids.length > 1 ? 'los menores' : 'el/la menor'} <b>${d.kids.map((k) => esc(k.toUpperCase())).join(', ')}</b>
    a favor de <b>${esc(d.tutor)}</b> (DNI ${esc(d.tutorDoc)}), quien ejercerá su representación y cuidado, incluida la autorización para salir del país.</p>
    <div class="row">${field('Tutor/a', d.tutor)}${field('DNI', d.tutorDoc)}</div>
    <div class="sigs"><span>Juez/a</span><span>Secretario/a</span><span class="seal">PODER<br>JUDICIAL<br>DE LA NACIÓN</span></div>
  </div>`;
}
function renderBooking(d) {
  const b = d.booking;
  return `<div class="doc paper booking">
    <div class="bh"><b>✈ ${AIRLINE.name}</b><span>Confirmación de reserva / e-Ticket</span></div>
    <div class="row">${field('Código de reserva', b.pnr, 'mono big')}${field('N° de boleto', b.ticket ? `${b.ticket.slice(0, 3)}-${b.ticket.slice(3)}` : '—', 'mono')}</div>
    ${field(b.party?.length ? 'Pasajeros' : 'Pasajero', [`${b.last.toUpperCase()}/${b.first.toUpperCase()} ${b.title}`, ...(b.party || []).map((x) => `${x.last.toUpperCase()}/${x.first.toUpperCase()} ${x.title}`)].join(' · '))}
    <table class="itin"><tr><th>Vuelo</th><th>Fecha</th><th>Desde</th><th>Hacia</th><th>Sale</th><th>Clase</th></tr>
      <tr><td>${b.flight.no}</td><td>${fmtGds(b.date)}</td><td>${b.origin}</td><td>${b.flight.dest}</td><td>${b.flight.dep}</td><td>${b.fareLabel}</td></tr>
      ${b.returnDate ? `<tr><td>${AIRLINE.code}${+b.flight.no.slice(2) + 1}</td><td>${fmtGds(b.returnDate)}</td><td>${b.flight.dest}</td><td>${STATION.code}</td><td>—</td><td>${b.fareLabel}</td></tr>` : ''}
    </table>
    <div class="small">Equipaje incluido: ${b.allowanceText}. Presentarse en el aeropuerto 3 horas antes. El check-in cierra 60 minutos antes de la salida.</div>
  </div>`;
}

function renderMedCert(d) {
  return `<div class="doc paper medcert">
    <div class="ph2"><b>CERTIFICADO MÉDICO</b><span>${esc(d.doctor)} · ${esc(d.specialty)} · ${esc(d.license)}</span></div>
    <p>Fecha: <b>${fmtDate(d.issue)}</b></p>
    <p>Certifico que la Sra. <b>${esc(d.first.toUpperCase())} ${esc(d.last.toUpperCase())}</b>, documento N° <b>${esc(d.docNumber)}</b>,
    cursa un embarazo de <b>${d.weeks} semanas</b> de gestación, con evolución normal.</p>
    <p>Itinerario: vuelo ${esc(d.flightNo)} ${esc(d.route)} del ${fmtDate(d.travelDate)}.</p>
    <p>${d.fit ? 'Se encuentra en <b>condiciones de viajar en avión</b>.' : 'Se indica control en 7 días. Se sugiere reposo relativo.'}</p>
    <div class="sigs"><span>Firma y sello</span><span class="seal">${esc(d.license)}<br>${esc(d.specialty.split(' ')[0].toUpperCase())}</span></div>
  </div>`;
}
