// MODO HISTORIA: "Tu primer mes en Aeroplata".
// Cada día: briefing con la supervisora → check-in de un vuelo → embarque de ESE vuelo con los mismos pasajeros.
import { FLIGHTS, AIRLINE, STATION, EXIT_CONTROL_CODES, exitControl } from './data.js';
import { esc, fmtTime, timeToday, dayOnly } from './util.js';
import { getPlayer, setPlayer, gtxt, playerFace } from './player.js';
import { dayNews, newsHTML, reviewData, reviewHTML, replayDecks } from './dayend.js';
import { teamCrew } from './team.js';
import { askConfirm } from './confirm.js';

const $ = (s) => document.querySelector(s);
let api;

// Supervisora de turno
const MARTA = { name: 'Marta Gómez', role: 'Supervisora de turno', face: { sex: 'F', age: 46, skin: 1, hairColor: '#4a2f1e', hairStyle: 'bun', glasses: true, beard: false, shape: 'oval', nose: 1, brows: 'thin', eye: 1, smile: true, shirt: '#123a63' } };

// ------------------------------------------------------------------
// Días de la historia (editable por el instructor)
// ------------------------------------------------------------------
export const DAYS = [
  {
    id: 1, title: 'Bienvenida a Aeroplata', flight: 'AP1250', start: '17:10', mode: 'learn', level: 'basico', tutorial: true,
    blurb: 'Primer día. Un solo vuelo a São Paulo, con la supervisora al lado. Mercosur, DNI, valijas y tu primer embarque.',
    intro: [
      '¡Bienvenido/a a Aeroplata, {name}! Soy Marta Gómez, supervisora de turno. Hoy es tu primer día en Ezeiza. Tranqui: al primer pasajero lo atendemos juntos.',
      'Así funciona el día: arrancamos con el <b>briefing</b>, después vas al <b>counter</b> a chequear a los pasajeros de tu vuelo y, cuando cierra el check-in, vas a la <b>puerta</b> a embarcarlos. Los mismos pasajeros, ¿eh? Si algo se te pasa en el counter, lo vas a volver a ver en la puerta.',
      'Regla de oro: ante la duda, Timatic o el manual (📘). Y nunca, nunca etiquetes una valija antes de saber si el pasajero viaja.',
    ],
    briefing: {
      booked: 168, capacity: 174, ssr: 'WCHR 1 · INF 1 · PETC 1', blocked: ['12C', '12D'],
      notes: ['Asientos 12C y 12D inoperativos (informó Mantenimiento): bloqueados en el sistema.', 'Lluvia en São Paulo: la tripulación puede pedir unos minutos extra de aseo.', 'Dato del día: los argentinos entran a Brasil con DNI tarjeta vigente (Mercosur). Hoy viaja una familia: ojo con los papeles de los chicos.'],
    },
    checkin: [
      { scenario: 'ok', overlay: 'none' }, { scenario: 'dni_ok', overlay: 'none' }, { scenario: 'ok', overlay: 'overweight' },
      { scenario: 'expired', overlay: 'none' }, { scenario: 'ok', overlay: 'pet' }, { scenario: 'drunk', overlay: 'none' }, { scenario: 'pregnant_ok', overlay: 'dg' }, { scenario: 'family_ok', overlay: 'none' },
    ],
    gate: { level: 'basico', cases: ['wchr', 'inf_stroller', 'early', 'influencer', 'vaper', 'wrong_flight', 'dutyfree'] },
    afterCheckin: 'Cerramos el check-in del AP1250. ¡Buen trabajo! Ahora a la puerta {gate}: a las {gateTime} arrancás con la apertura. Ojo que tus pasajeros te van a reconocer... para bien o para mal.',
  },
  {
    id: 2, title: 'Rumbo a Miami', flight: 'AP1100', start: '18:30', mode: 'learn', level: 'intermedio',
    blurb: 'Vuelo a Estados Unidos: visas, ESTA, APIS con respuesta iAPI, una katana, un asado con hielo seco y tarjetas cruzadas.',
    intro: [
      'Hoy subimos la vara, {name}: Miami. Argentina no integra el Programa de Exención de Visas, así que <b>visa sí o sí</b>. España y Chile, con ESTA.',
      'Hay torneo de pádel en Miami: esperá raquetas, gente apurada y algún que otro souvenir raro. Si algo no puede ir en cabina, ya sabés: retenidos.',
    ],
    briefing: {
      booked: 257, capacity: 251, ssr: 'WCHR 2 · INF 1 · UMNR 0', blocked: ['20A'],
      notes: ['SOBREVENTA COMERCIAL: 257 reservas para 251 asientos. Buscá voluntarios desde el primer pasajero (USD 160 si viajan hoy en el AP1104 de las 23:50). Los rechazos por documentación también liberan lugares.', 'Asiento 20A inoperativo: si aparece alguien chequeado ahí por la web, reasignalo.', 'APIS obligatorio: la respuesta iAPI dice si el pasajero puede volar.', 'Dato del día: una visa vigente en un pasaporte vencido sirve si el pasajero trae los dos pasaportes. Y ojo con los "solo ida": si no es residente, necesita pasaje de regreso, y eso Migraciones no lo controla.'],
    },
    checkin: [
      { scenario: 'ok', overlay: 'none' }, { scenario: 'no_visa', overlay: 'none' }, { scenario: 'visa_oldpp', overlay: 'none' }, { scenario: 'ok', overlay: 'samurai' },
      { scenario: 'no_esta', overlay: 'none' }, { scenario: 'impostor', overlay: 'none' }, { scenario: 'ok', overlay: 'dry_ice' }, { scenario: 'pregnant_cert', overlay: 'none' },
      { scenario: 'ok', overlay: 'limited_release' }, { scenario: 'name_typo', overlay: 'none' }, { scenario: 'ok', overlay: 'valuables' }, { scenario: 'no_return', overlay: 'none' }, { scenario: 'vip_angry', overlay: 'overweight' }, { scenario: 'depu_ok', overlay: 'none' }, { scenario: 'ok', overlay: 'avih', variant: 'ok' },
    ],
    ovbk: { flight: 'AP1100', capacity: 251, short: 6 },
    gate: { level: 'intermedio', cases: ['wchr', 'senior_zone4', 'inf_stroller', 'influencer', 'vaper', 'name_mismatch', 'dup_bp', 'exit_minor', 'dead_phone', 'dutyfree', 'wrong_flight', 'inop_seat', 'gate_carryon'] },
    afterCheckin: 'Check-in del AP1100 cerrado. Puerta {gate}, apertura a las {gateTime}. Hoy el vuelo va lleno: atento/a a las tarjetas, que con tanta gente siempre hay alguna mezclada.',
  },
  {
    id: 3, title: 'Doble mostrador', flights: ['AP1180', 'AP1050'], flight: 'AP1050', start: '18:10', mode: 'challenge', level: 'intermedio', outage: { afterPax: 3, duration: 3 },
    blurb: 'Dos vuelos en el mismo counter (Santiago y Madrid), reloj en tiempo real. Menores, Schengen y gestantes. Después embarcás Madrid.',
    intro: [
      'Faltó un compañero, {name}, así que hoy atendés <b>dos vuelos en el mismo mostrador</b>: Santiago y Madrid. Y el reloj corre de verdad.',
      'Madrid es Schengen: pasaporte con <b>3 meses de validez después del regreso</b>. Y vienen familias: autorizaciones de viaje y menores no acompañados.',
    ],
    briefing: {
      booked: 233, capacity: 242, ssr: 'WCHR 1 · INF 1 · UMNR 1 · PETC 1', blocked: [],
      notes: ['Sistemas avisa: SITA está inestable esta noche. Tené a mano el kit de contingencia por si hay que pasar a manual.', 'Mostrador compartido: fijate a qué vuelo va cada pasajero.', 'Santiago cierra antes que Madrid: no te quedes sin tiempo.', 'Ojo con los pasajeros difíciles: cortesía y firmeza. Si no acatan, supervisor o seguridad (CAT 2).', 'Hoy viaja un detenido a Madrid con custodia policial: revisá las condiciones de transporte (DEPA).', 'Dato del día: menores de 5 a 13 años que viajan solos, servicio UMNR obligatorio. Con un solo padre: permiso del que no viaja. Con los abuelos: permiso de ambos padres que los nombre.'],
    },
    checkin: [
      { scenario: 'minor_ok', overlay: 'none' }, { scenario: 'validity_es', overlay: 'none' }, { scenario: 'dni_ok', overlay: 'none' }, { scenario: 'ok', overlay: 'pet' },
      { scenario: 'minor_noauth', overlay: 'none' }, { scenario: 'ok', overlay: 'heavy' }, { scenario: 'um_missing', overlay: 'none' }, { scenario: 'pregnant_nocert', overlay: 'none' },
      { scenario: 'ok', overlay: 'exit_restricted' }, { scenario: 'ok', overlay: 'samurai' }, { scenario: 'expired', overlay: 'none' }, { scenario: 'one_parent_ok', overlay: 'none' },
      { scenario: 'one_parent_noauth', overlay: 'none' }, { scenario: 'relative_ok', overlay: 'none' }, { scenario: 'infant_nodoc', overlay: 'none' }, { scenario: 'angry_cat2', overlay: 'none' }, { scenario: 'depa_ok', overlay: 'none' }, { scenario: 'ok', overlay: 'avih', variant: 'brachy' },
    ],
    gate: { level: 'intermedio', cases: ['wchr', 'inf_stroller', 'senior_zone4', 'early', 'influencer', 'vaper', 'exit_minor', 'name_mismatch', 'pet_exit', 'dead_phone', 'dutyfree', 'dup_bp', 'impostor', 'wrong_flight', 'web_yesterday', 'gate_smoker'] },
    afterCheckin: 'Listo el doble mostrador. Ahora embarcás Madrid por la puerta {gate} a las {gateTime}. Y sí, el reloj sigue corriendo.',
  },
  {
    id: 4, title: 'Hora pico', flights: ['AP1254', 'AP1184', 'AP1104'], flight: 'AP1104', start: '20:00', mode: 'challenge', level: 'avanzado', outage: { afterPax: 6, duration: 3 },
    blurb: 'Tres vuelos, hora pico, todo junto. El examen final de tu primer mes. Después embarcás Miami.',
    intro: [
      '{name}, último día del mes y te toca la hora pico: <b>tres vuelos</b> en tu mostrador. Si sobrevivís a esto, te ganaste el pin de Aeroplata.',
      'No hay atajos: documentos, Timatic, equipajes, asientos. Y en la puerta, Miami completo. ¡Vos podés!',
    ],
    briefing: {
      booked: 512, capacity: 530, ssr: 'WCHR 3 · INF 2 · UMNR 1 · PETC 2', blocked: ['14F'],
      notes: ['Tres vuelos: São Paulo, Santiago y Miami. Cada uno con su cierre.', 'Asiento 14F inoperativo: es salida de emergencia, ojo.', 'Sistemas avisa: en Miami pueden aparecer pasajeros chequeados SIN ASIENTO. Si pasa, voluntarios antes de embarcar.', 'Dato del día: en la puerta, la reimpresión de tarjetas está disponible hasta el −10.'],
    },
    checkin: [
      { scenario: 'ok', overlay: 'dg' }, { scenario: 'us_br_noevisa', overlay: 'none' }, { scenario: 'validity_stay', overlay: 'none' }, { scenario: 'visa_expired', overlay: 'none' },
      { scenario: 'dni_ok', overlay: 'pet' }, { scenario: 'impostor', overlay: 'none' }, { scenario: 'ok', overlay: 'dry_ice' }, { scenario: 'pregnant_39', overlay: 'none' },
      { scenario: 'wrong_date', overlay: 'none' }, { scenario: 'ok', overlay: 'extra_bag' }, { scenario: 'drunk', overlay: 'none' }, { scenario: 'visa_oldpp', overlay: 'samurai' },
      { scenario: 'no_ticket', overlay: 'none' }, { scenario: 'ok', overlay: 'light_bag' }, { scenario: 'infant_nobooking', overlay: 'none' }, { scenario: 'return_resident', overlay: 'none' }, { scenario: 'bomb_joke', overlay: 'none' }, { scenario: 'depa_late', overlay: 'none' }, { scenario: 'depo_ok', overlay: 'none' }, { scenario: 'ok', overlay: 'avih', variant: 'small' },
      { scenario: 'family_nobirth', overlay: 'none' }, { scenario: 'relative_noauth', overlay: 'none' },
    ],
    gateOvbk: { noSeat: 2 },
    gate: { level: 'avanzado', cases: ['wchr', 'inf_stroller', 'senior_zone4', 'early', 'influencer', 'vaper', 'exit_minor', 'name_mismatch', 'no_return', 'pet_exit', 'dead_phone', 'drunk', 'impostor', 'dutyfree', 'dup_bp', 'wrong_flight', 'web_yesterday', 'gate_rage', 'depa'] },
    afterCheckin: 'Cerrado el counter de la hora pico. Te espera Miami en la puerta {gate} a las {gateTime}. Último esfuerzo.',
  },
  {
    id: 5, title: 'Vacaciones de invierno', flights: ['AP2730', 'AP1050'], flight: 'AP1050', start: '18:10', mode: 'challenge', level: 'avanzado', extra: true,
    blurb: 'Extra: arrancan las vacaciones. Bariloche (cabotaje) y Madrid en el mismo counter: familias con papeles complicados, DNI perdidos y cazadores. Después embarcás Madrid.',
    intro: [
      'Ya tenés el pin, {name}, pero hoy arrancan las <b>vacaciones de invierno</b> y el counter se llena de chicos. Y donde hay chicos, hay papeles.',
      'Repasemos la tabla de menores: si un padre <b>falleció</b>, certificado de defunción. Si está <b>ausente</b>, autorización del tribunal de familia. Si está <b>en el exterior</b>, autorización por el consulado. Y si viaja un familiar con la <b>tutela</b>, certificado del tribunal.',
      'Leé cada papel completo: a quién autoriza, con quién y a qué destino. Un "me lo mandó por WhatsApp" no es una autorización.',
      'Y hoy compartís counter con <b>Bariloche</b>, un vuelo de <b>cabotaje</b>: abre 120 minutos antes y cierra 50 antes. Si alguien perdió el DNI, acordate de las excepciones: licencia de conducir vigente, denuncia policial o constancia de trámite.',
    ],
    briefing: {
      booked: 238, capacity: 242, ssr: 'WCHR 1 · INF 3 · UMNR 2 · PETC 1', blocked: [],
      notes: ['Temporada alta: muchas familias. Contá bien quién viaja con quién.', 'Migraciones avisa: controlan con rigor las autorizaciones de menores. Si la dejás pasar mal, el menor se queda en el control y el vuelo espera.', 'Dato del día: la autorización judicial vale para el destino que indica. Si dice Uruguay, no sirve para Madrid.', 'Bariloche: temporada de caza y nieve. Si alguien declara un arma: documento ORIGINAL, estuche rígido y gestión de retenido.'],
    },
    checkin: [
      { scenario: 'ok', overlay: 'firearm', variant: 'ok' }, { scenario: 'dom_license', overlay: 'none' }, { scenario: 'family_ok', overlay: 'none' }, { scenario: 'dom_police', overlay: 'none' },
      { scenario: 'ok', overlay: 'firearm', variant: 'copy' }, { scenario: 'dom_nodoc', overlay: 'none' }, { scenario: 'deceased_ok', overlay: 'none' }, { scenario: 'ok', overlay: 'heavy' }, { scenario: 'consul_letter', overlay: 'none' },
      { scenario: 'court_ok', overlay: 'none' }, { scenario: 'validity_es', overlay: 'none' }, { scenario: 'tutor_nocert', overlay: 'none' }, { scenario: 'ok', overlay: 'pet' },
      { scenario: 'consul_ok', overlay: 'none' }, { scenario: 'court_wrong', overlay: 'none' }, { scenario: 'um_missing', overlay: 'none' }, { scenario: 'tutor_ok', overlay: 'none' },
      { scenario: 'deceased_nocert', overlay: 'none' }, { scenario: 'ok', overlay: 'exit_restricted' }, { scenario: 'vip_angry', overlay: 'heavy' }, { scenario: 'depa_female', overlay: 'none' }, { scenario: 'ok', overlay: 'avih', variant: 'pups' },
    ],
    gate: { level: 'avanzado', cases: ['wchr', 'inf_stroller', 'senior_zone4', 'early', 'influencer', 'exit_minor', 'name_mismatch', 'dead_phone', 'dutyfree', 'dup_bp', 'wrong_flight', 'web_yesterday', 'no_return', 'gate_carryon', 'gate_smoker'] },
    afterCheckin: 'Sobreviviste a las vacaciones de invierno en el counter. Ahora Madrid por la puerta {gate} a las {gateTime}: cochecitos, mochilas y chicos con hambre.',
  },
];

// ------------------------------------------------------------------
export function initCareer(a) { api = a; }

function progress() {
  try { return JSON.parse(localStorage.getItem('ckCareer') || '{}'); } catch { return {}; }
}
function saveStars(name, day, stars) {
  const p = progress();
  p[name] = p[name] || {};
  p[name][day] = Math.max(p[name][day] || 0, stars);
  try { localStorage.setItem('ckCareer', JSON.stringify(p)); } catch {}
}
const studentName = () => { try { return localStorage.getItem('ckName') || ''; } catch { return ''; } };

export function showHome() {
  api.openModal(`
    <div class="start home">
      <div class="startHero">
        <img src="assets/logo-512.png" alt="Next, please!" class="heroLogo" />
        <p>Simulador de atención al pasajero · Check-in y embarque en Ezeiza con ${AIRLINE.name}</p>
      </div>
      <div class="who">
        <label>Tu nombre<input id="hName" maxlength="40" placeholder="Ej.: Lucía Pérez" value="${esc(studentName())}"></label>
        <div class="gPick"><span>¿Cómo querés que te traten?</span>
          <div class="gOpts">
            <button class="gBtn ${getPlayer().gender === 'F' ? 'on' : ''}" data-g="F">${api.faceSVG(playerFace('F'), { w: 64, h: 80, bg: '#dce7f0' })}<b>Agente mujer</b><small>"Bienvenida, compañera"</small></button>
            <button class="gBtn ${getPlayer().gender === 'M' ? 'on' : ''}" data-g="M">${api.faceSVG(playerFace('M'), { w: 64, h: 80, bg: '#dce7f0' })}<b>Agente hombre</b><small>"Bienvenido, compañero"</small></button>
          </div>
        </div>
      </div>
      <p class="hint err hidden" id="hWarn">Elegí tu nombre y cómo querés que te traten para empezar.</p>
      <div class="homeGrid">
        <button class="homeCard" id="hStory"><span class="icoTile y"><i class="mdi mdi-airplane-takeoff"></i></span><h2>Modo Historia</h2><p id="hStoryTxt">${gtxt('Sos agente recién ingresado/a. Briefing, counter y puerta de embarque, día a día, con tu supervisora.')}</p></button>
        <button class="homeCard" id="hPractice"><span class="icoTile b"><i class="mdi mdi-bullseye-arrow"></i></span><h2>Práctica libre</h2><p>Elegí puesto (counter o puerta), nivel y modo (aprendizaje o desafío contra reloj).</p></button>
        <button class="homeCard" id="hOnline"><span class="icoTile o"><i class="mdi mdi-account-group"></i></span><h2>Jugar en sala</h2><p>Con hasta dos compañeros en línea: cada uno en su mostrador, misma fila y mismos vuelos.</p></button>
      </div>
      <p class="disclaimer">Las reglas documentarias están simplificadas con fines didácticos. En la operación real siempre se consulta Timatic y los procedimientos vigentes de la compañía.</p>
    </div>`, 'wide');
  let gender = getPlayer().gender;
  document.querySelectorAll('.gBtn').forEach((b) => {
    b.onclick = () => {
      gender = b.dataset.g;
      document.querySelectorAll('.gBtn').forEach((x) => x.classList.toggle('on', x === b));
      $('#hStoryTxt').textContent = gtxt('Sos agente recién ingresado/a. Briefing, counter y puerta de embarque, día a día, con tu supervisora.', gender);
    };
  });
  const saveName = () => {
    const n = $('#hName').value.trim();
    if (!n || !gender) { $('#hWarn').classList.remove('hidden'); if (!n) $('#hName').focus(); return null; }
    setPlayer(n, gender);
    api.setStudent(n);
    return n;
  };
  $('#hStory').onclick = () => { if (saveName()) showDays(); };
  $('#hPractice').onclick = () => { if (saveName()) { api.closeModal(); api.showPractice(); } };
  $('#hOnline').onclick = () => { if (saveName()) api.showOnline(); };
}

function showDays() {
  const name = studentName() || 'Agente';
  const done = progress()[name] || {};
  const saved = loadCheckpoint(), shift = loadShift(), gateSave = saved && loadGate();
  // Lo pendiente: un counter a mitad, o el counter terminado y la puerta por hacer
  const pending = shift
    ? { day: shift.day, at: shift.at, where: `Counter: atendiste ${shift.snap.idx + 1} de ${shift.snap.pax.length} pasajeros`, cta: 'Seguir con el counter ▶', go: () => resumeCounter(shift) }
    : gateSave && gateSave.day === saved.day ? { day: gateSave.day, at: gateSave.at, where: gateSave.closed ? 'Puerta: vuelo cerrado, falta el informe' : `Puerta de embarque: ${gateSave.boarded} de ${gateSave.checked} a bordo`, cta: 'Seguir con el embarque ▶', go: () => resumeGate(gateSave, saved.cp) }
    : saved ? { day: saved.day, at: saved.at, where: 'Counter terminado: falta el embarque', cta: 'Seguir desde la puerta ▶', go: () => resumeDay(saved) } : null;
  const rows = DAYS.map((d, i) => {
    const locked = i > 0 && !done[DAYS[i - 1].id];
    const stars = done[d.id] ? '★'.repeat(done[d.id]) + '☆'.repeat(3 - done[d.id]) : '';
    return `<div class="day ${locked ? 'locked' : ''}"><span class="num">${d.id}</span>
      <div class="info"><b>Día ${d.id} · ${esc(d.title)}</b><small>${esc(d.blurb)}</small><br><small>${d.mode === 'challenge' ? '⏱ Contra reloj' : '📘 Sin presión de tiempo'}</small></div>
      <span class="stars">${stars}</span>
      <button class="btn ${locked ? 'ghost' : 'ok'}" data-day="${d.id}" ${locked ? 'disabled' : ''}>${locked ? '🔒' : done[d.id] ? 'Repetir' : 'Jugar'}</button></div>`;
  }).join('');
  api.openModal(`<div class="home"><h1>🧑‍✈️ Tu primer mes en ${AIRLINE.name}</h1>
    <p class="hint">Cada día se desbloquea al terminar el anterior. Las estrellas dependen de tus decisiones y de los errores críticos (pasajeros inadmisibles, valijas sin su pasajero).</p>
${pending ? `<div class="resume"><span class="icoTile y"><i class="mdi mdi-content-save-check"></i></span>      <div><b>Tenés el Día ${pending.day} a mitad de camino</b><small>${pending.where}, guardado ${fmtAgo(pending.at)}.</small></div>      <button class="btn ok" id="dResume">${pending.cta}</button></div>` : ''}
    <div class="days">${rows}</div>
    <div class="row end"><button class="btn ghost" id="dBack">← Volver</button></div></div>`, 'wide');
  document.querySelectorAll('[data-day]').forEach((b) => {
    b.onclick = async () => {
      const day = DAYS.find((d) => d.id === +b.dataset.day);
      if (pending && !(await askConfirm({ title: "Día pendiente", text: `Tenés el Día ${pending.day} a mitad de camino. Si empezás ${day.id === pending.day ? "este día de nuevo" : "otro día"}, se descarta lo guardado. ¿Seguir igual?`, ok: "Empezar igual", cancel: "Volver", icon: "content-save-alert" }))) return;
      startDay(day);
    };
  });
  if (pending) $("#dResume").onclick = pending.go;
  $('#dBack').onclick = showHome;
}

// Diálogo de la supervisora, en páginas
function story(pages, onDone, cta = 'Siguiente ▶') {
  let i = 0;
  const name = studentName() || 'Agente';
  const show = () => {
    api.openModal(`<div class="story">
      <div class="who">${api.faceSVG(MARTA.face, { w: 84, h: 105, bg: '#dce7f0' })}<b>${MARTA.name}</b><br>${MARTA.role}</div>
      <div class="says"><p>${gtxt(pages[i]).replace(/\{name\}/g, esc(name))}</p></div></div>
      <div class="row end"><button class="btn ok" id="sNext">${i < pages.length - 1 ? 'Siguiente ▶' : cta}</button></div>`, 'wide');
    $('#sNext').onclick = () => { i++; if (i < pages.length) show(); else { api.closeModal(); onDone(); } };
  };
  show();
}

// ------------------------------------------------------------------
// Coach: tips de la supervisora sobre la escena (tutorial)
// ------------------------------------------------------------------
let coachTimer = null, coachSteps = null, coachIdx = 0, coachDone = null;
function coachSay(html, autoHide = 0) {
  let el = $('#coach');
  if (!el) { $('#view3d').insertAdjacentHTML('beforeend', '<div id="coach" class="coach"></div>'); el = $('#coach'); }
  el.innerHTML = `${api.faceSVG(MARTA.face, { w: 44, h: 55, bg: '#dce7f0' })}<div><b>Marta:</b> ${gtxt(html)}</div><button class="x" title="Ocultar">✕</button>`;
  el.classList.remove('hidden');
  el.querySelector('.x').onclick = () => el.classList.add('hidden');
  clearTimeout(coachSay.t);
  if (autoHide) coachSay.t = setTimeout(() => el.classList.add('hidden'), autoHide);
}
function coachHide() { $('#coach')?.classList.add('hidden'); }
function clearPulse() { document.querySelectorAll('.pulse').forEach((e) => e.classList.remove('pulse')); }

function runCoach(steps, onFinish) {
  coachSteps = steps; coachIdx = -1; coachDone = onFinish;
  clearInterval(coachTimer);
  coachTimer = setInterval(() => {
    const G = api.getCheckin();
    if (!G.cur || !G.act) return;
    if (coachIdx === -1 || coachSteps[coachIdx].until(G)) {
      do { coachIdx++; } while (coachIdx < coachSteps.length && coachSteps[coachIdx].until(G));
      if (coachIdx >= coachSteps.length) { clearInterval(coachTimer); clearPulse(); coachDone?.(); return; }
      coachSay(coachSteps[coachIdx].text);
    }
    clearPulse();
    const sel = coachSteps[coachIdx]?.target?.(G);
    if (sel) document.querySelectorAll(sel).forEach((e) => e.classList.add('pulse'));
  }, 300);
}

const CHECKIN_TUTORIAL = [
  { text: 'Saludá al pasajero y pedile la <b>documentación y la reserva</b> (botón <i class="mdi mdi-passport"></i> abajo).', until: (G) => G.act.docsRequested, target: () => '[data-q="docs"]' },
  { text: 'Los documentos quedaron sobre el mostrador. <b>Hacé clic en uno</b> para ampliarlo y comparar la foto con la persona.', until: (G) => G.act.docViewed, target: () => '.docThumb' },
  { text: 'Ahora el sistema: pestaña <b>1 · Identificar</b>. Escribí el <b>código de reserva</b> (está en el e-ticket) y tocá Buscar. Después, Abrir.', until: (G) => G.act.bookingLoaded, target: () => '#tabs [data-tab="ident"], #q, #qGo, [data-pick]' },
  { text: 'Pestaña <b>2 · APIS</b>: tocá <b>Leer MRZ</b> con el documento con el que viaja y después <b>Enviar APIS</b>.', until: (G) => !!G.act.apis, target: () => '#tabs [data-tab="pax"], #apScan, #apSend' },
  { text: 'Equipaje: preguntá si <b>despacha</b> <i class="mdi mdi-bag-suitcase"></i> y hacé la <b>cartilla de mercancías peligrosas</b> <i class="mdi mdi-alert-octagon"></i>. También conviene preguntar por <b>artículos de valor</b> <i class="mdi mdi-diamond-stone"></i>.', until: (G) => G.act.asked.bags && G.act.asked.security, target: () => '[data-q="bags"], [data-q="security"]' },
  { text: 'Pestaña <b>3 · Equipaje</b>: <b>Inspección 360°</b> y <b>Etiquetar</b> cada valija. Si se pasa de peso, cobrá el exceso al final.', until: (G) => G.act.bagsShown && G.act.bags.every((b) => b.tagged), target: () => '#tabs [data-tab="bags"], [data-insp], [data-tag]' },
  { text: 'Pestaña <b>4 · Asientos</b>: preguntale su preferencia <i class="mdi mdi-seat-passenger"></i> y elegí un asiento libre.', until: (G) => !!G.act.seat, target: () => '#tabs [data-tab="seat"], [data-q="seat"]' },
  { text: 'Todo en regla: <b><i class="mdi mdi-check-bold"></i> Aceptar y emitir la tarjeta de embarque</b>. ¡Tu primer pasajero!', until: (G) => G.idx > 0, target: () => '#btnAccept' },
];

const GATE_TIPS = {
  web: 'Este pasajero hizo <b>web check-in</b> y no despacha valija: <b>no pasó por ningún counter</b>. Nadie vio sus papeles: tocá <b>🛂 Verificar documentos</b> antes de embarcarlo (fecha y vuelo de la tarjeta, documento y, si el destino lo pide, pasaje de regreso).',
  ovbk: 'Hay pasajeros <b>sin asiento</b>: antes de embarcar, <b>buscá voluntarios</b> (pestaña 2). Si nadie se ofrece, pedí al gerente un aumento. Si no alcanza: DNBD.',
  start: 'Llegaste a la puerta. Primero la <b>apertura</b> (pestaña 1): las cuatro tareas. Después esperá que la tripulación autorice por radio.',
  crew: '¡La tripulación autorizó! Pestaña 2: usá el <b>micrófono en orden</b>: preembarque, embarque y Zona 1. El botón que brilla es el que sigue.',
  pax: 'En el podio: pedí <b>tarjeta y documento</b>, <b>escaneá</b> y fijate que todo coincida (nombre, foto, zona, asiento).',
  final: 'Llamado final hecho. Pestaña 3: <b>llamá por nombre</b> a los que faltan y tienen valija. ¿No aparece nadie? <b>Recorré la sala</b>.',
  m15: 'Minuto <b>−15</b>: buscá el equipaje de los que no embarcan, <b>des-chequealos</b> y cerrá el vuelo. Si tenés voluntarios en <b>stand-by</b>, cada des-chequeado libera un asiento para ellos.',
};

// ------------------------------------------------------------------
// Un día de trabajo
// ------------------------------------------------------------------
function startDay(day) {
  clearCheckpoint();
  const name = studentName() || 'Agente';
  api.setStudent(name);
  story(day.intro, () => briefing(day), 'Ir al briefing ▶');
}

function briefing(day) {
  const flights = (day.flights || [day.flight]).map((no) => FLIGHTS.find((f) => f.no === no));
  const b = day.briefing;
  const fo = Math.round((b.booked / b.capacity) * 100);
  api.openModal(`<div class="home">
    <h1>📋 Briefing · Día ${day.id}</h1>
    <p class="hint">${MARTA.name}, supervisora de turno, repasa la información operativa antes de abrir el counter.</p>
    ${flights.map((f) => `<div class="brief">
      <div><span>Vuelo</span><b>${f.no} ${STATION.code}-${f.dest}</b></div><div><span>Destino</span><b>${f.city}</b></div><div><span>Aeronave</span><b>${f.aircraft}</b></div>
      <div><span>STD</span><b>${f.dep}</b></div><div><span>Counter abre / cierra</span><b>${fmtTime(new Date(timeToday(dayOnly(new Date()), f.dep) - f.open * 60000))} / ${fmtTime(new Date(timeToday(dayOnly(new Date()), f.dep) - f.close * 60000))}</b></div><div><span>Puerta</span><b>${f.gate}</b></div>
    </div>`).join('')}
    <div class="brief">
      <div><span>Factor de ocupación</span><b>${fo} %${fo >= 100 ? ' · lleno' : ''}</b></div>
      <div><span>Asistencias especiales</span><b>${b.ssr}</b></div>
      <div><span>Asientos inoperativos</span><b>${b.blocked.length ? b.blocked.join(', ') : 'ninguno'}</b></div>
    </div>
    <h3>Novedades</h3>
    <ul class="notes">${b.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <div class="row end"><button class="btn ok big" id="bGo">¡Al counter! ▶</button></div></div>`, 'wide');
  $('#bGo').onclick = () => { api.closeModal(); goCounter(day, flights); };
}

function goCounter(day, flights) {
  const label = flights.length === 1 ? `${flights[0].no} ${flights[0].city}` : `${flights.length} vuelos`;
  api.startCheckin({ ...counterOpts(day, flights), saveTag: { name: studentName() || 'Agente', day: day.id } });
  if (day.ovbk) coachSay('Hoy hay <b>sobreventa</b>: preguntá 🙋 <b>¿Voluntario?</b> a cada pasajero desde el principio. Todo lo de la sobreventa está en la pestaña <b>6</b>.', 12000);
  else if (day.tutorial) {
    runCoach(CHECKIN_TUTORIAL, () => coachSay(`¡Excelente! Desde ahora seguís sin mí. ${crewIntro()} Yo ando cerca: si te trabás, tocá <b>📘 Manual</b>.`, 11000));
  } else {
    coachSay(`Hoy: ${esc(label)}. ${crewIntro()} ${day.mode === 'challenge' ? 'El reloj corre en tiempo real y la <b>fila se impacienta</b> (arriba a la izquierda). Si se pone brava, 📢 hablale. Y si alguien se quiere colar, mirá a qué hora cierra su vuelo.' : 'Sin apuro, hacelo bien.'}`, day.mode === 'challenge' ? 14000 : 10000);
  }
}

function afterCheckin(day, results, score, queueLog = []) {
  clearInterval(coachTimer); clearPulse(); coachHide();
  const gateFlight = FLIGHTS.find((f) => f.no === day.flight);
  const gateTime = fmtTime(new Date(timeToday(dayOnly(new Date()), gateFlight.dep) - 60 * 60000));
  const ok = results.filter((r) => r.ev.correct).length;
  const stoppedCodes = (r) => r.ev.analysis.blockers.map((b) => b.code).filter((c) => EXIT_CONTROL_CODES.includes(c));
  // Los que tenían problemas documentales no llegan a la puerta: los frena el control de salida
  const stopped = results
    .filter((r) => r.decision.kind === 'accept' && r.pax.flight.no === gateFlight.no && stoppedCodes(r).length)
    .map((r) => ({ pax: r.pax, seat: r.act.seat || r.act.autoSeat || '—', bags: r.act.bags.filter((b) => b.tagged).length, codes: stoppedCodes(r) }));
  const carry = results
    .filter((r) => r.decision.kind === 'accept' && r.pax.flight.no === gateFlight.no && !stoppedCodes(r).length && !r.ev.analysis.blockers.some((b) => b.code === 'LEGAL'))
    .map((r) => ({
      pax: r.pax, seat: r.act.seat || r.act.autoSeat, bags: r.act.bags.filter((b) => b.tagged).length,
      blockers: r.ev.analysis.blockers.map((b) => b.code), petAccepted: r.act.pet === 'accept', strollerGate: r.act.stroller === 'gate',
    }));
  const standby = results
    .filter((r) => r.decision.kind === 'volunteer' && r.decision.form?.standby && r.pax.flight.no === gateFlight.no)
    .map((r) => ({ pax: r.pax, form: r.decision.form }));
  const ck = { ok, total: results.length, score, results, queue: queueLog, critical: results.filter((r) => r.decision.kind === 'accept' && r.ev.analysis.expected === 'reject').length };
  const msg = day.afterCheckin.replace('{gate}', gateFlight.gate).replace('{gateTime}', gateTime);
  const ctl = exitControl(gateFlight);
  const toGate = ck.critical - results.filter((r) => r.decision.kind === 'accept' && stoppedCodes(r).length).length;
  const extra = ck.critical
    ? `Ah, y una cosa: aceptaste ${ck.critical === 1 ? 'a un pasajero que no cumplía' : `a ${ck.critical} pasajeros que no cumplían`} los requisitos. ${toGate < ck.critical ? `Los problemas de documentación no pasan el control de ${ctl}: te van a avisar por radio y vas a tener que bajar su equipaje.` : ''} ${toGate > 0 ? 'Y lo que no es de documentación, en la puerta tenés otra oportunidad de frenarlo.' : ''}`
    : ok === results.length ? '¡Counter perfecto! Ni una decisión mal. Así da gusto.' : `Hiciste ${ok} de ${results.length} decisiones correctas en el counter.`;
  // Punto de guardado: si se corta antes de terminar la puerta, el día sigue desde el embarque
  const cp = { ck, carry, stopped, standby };
  saveCheckpoint(day.id, cp);
  story([`${msg}`, extra], () => goGate(day, cp), 'Ir a la puerta ▶');
}

function goGate(day, cp) {
  try { localStorage.removeItem('ckGate'); } catch {}
  const gateFlight = FLIGHTS.find((f) => f.no === day.flight);
  api.startBoarding({
    student: studentName() || 'Agente', level: day.gate.level, mode: day.mode, flightNo: gateFlight.no, cases: day.gate.cases,
    carry: cp.carry, stopped: cp.stopped, standby: cp.standby, ovbk: day.gateOvbk || null,
    onEvent: (ev, B) => gateCoach(day, ev, B),
    onDone: (gate) => endDay(day, cp.ck, gate),
    saveTag: { name: studentName() || 'Agente', day: day.id },
  });
}

// ------------------------------------------------------------------
// Punto de guardado entre el counter y la puerta (en el navegador)
// Las fechas se guardan como texto ISO y se vuelven a convertir al leer.
// ------------------------------------------------------------------
const CP_KEY = 'ckCheckpoint';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function saveCheckpoint(dayId, cp) {
  try { localStorage.setItem(CP_KEY, JSON.stringify({ name: studentName() || 'Agente', day: dayId, at: Date.now(), cp })); } catch {}
}
function loadCheckpoint() {
  try {
    const s = JSON.parse(localStorage.getItem(CP_KEY) || 'null', (k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v));
    return s && s.name === (studentName() || 'Agente') && DAYS.some((d) => d.id === s.day) ? s : null;
  } catch { return null; }
}
const clearCheckpoint = () => { try { [CP_KEY, 'ckShift', 'ckGate'].forEach((k) => localStorage.removeItem(k)); } catch {} };

function resumeDay(saved) {
  const day = DAYS.find((d) => d.id === saved.day);
  api.setStudent(studentName() || 'Agente');
  story([`¡Volviste! Te estaba esperando. El counter del día ${day.id} ya está cerrado: tus pasajeros van camino a la puerta ${FLIGHTS.find((f) => f.no === day.flight).gate}. Seguimos desde el embarque.`], () => goGate(day, saved.cp), 'Ir a la puerta ▶');
}

function gateCoach(day, ev, B) {
  const seen = gateCoach.seen || (gateCoach.seen = new Set());
  if (ev === 'start' && B?.ovbk && !seen.has(`${day.id}-ovbk`)) { seen.add(`${day.id}-ovbk`); coachSay(GATE_TIPS.ovbk, 14000); return; }
  if (ev === 'web') { if (!seen.has(`${day.id}-web`)) { seen.add(`${day.id}-web`); coachSay(GATE_TIPS.web, 14000); } return; }
  if (seen.has(`${day.id}-${ev}`)) return;
  if (day.id > 2 && ev !== 'm15') return;
  if (day.id === 2 && !['crew', 'm15'].includes(ev)) return;
  if (!GATE_TIPS[ev]) return;
  seen.add(`${day.id}-${ev}`);
  coachSay(GATE_TIPS[ev], 12000);
}

function endDay(day, ck, gate) {
  coachHide();
  const ok = ck.ok + gate.ok, total = ck.total + gate.total;
  const pct = total ? ok / total : 0;
  // Lo que se escapó en el counter pero se frenó en la puerta no cuenta como crítico
  const caught = gate.results.filter((r) => r.pax.fromCheckin && r.pax.kind !== 'carry' && r.decision.kind === 'deny').length;
  const crit = Math.max(0, ck.critical - caught) + gate.critical;
  const stars = pct >= 0.9 && crit === 0 ? 3 : pct >= 0.7 && crit <= 1 ? 2 : 1;
  saveStars(studentName() || 'Agente', day.id, stars);
  clearCheckpoint();
  const comments = {
    3: ['¡Impecable! Si seguís así, el mes que viene me reemplazás... no, mentira, pero casi.', 'Tres estrellas. Me hiciste quedar bien con la gerencia. Te ganaste un café de la máquina (el bueno).'],
    2: ['Muy bien. Algunos detalles para pulir, pero los pasajeros llegaron a destino y eso es lo importante.', 'Buen día. Repasá las observaciones del informe y mañana sale perfecto.'],
    1: ['Bueno... sobrevivimos. Revisemos juntos los errores, que para eso estamos.', 'Hoy fue un día difícil. Todos tuvimos uno así. Repasá el manual y volvé a intentarlo.'],
  }[stars];
  const isLast = day.id === 4;
  day.flightObj = FLIGHTS.find((f) => f.no === day.flight);
  const nw = dayNews(day, ck, gate);
  const rev = reviewData(ck, gate);
  const nRev = rev.counter.length + rev.gateBad.length + rev.procBad.length;
  const decks = replayDecks(rev);
  api.openModal(`<div class="home dayEnd">
    <h1>🏁 Fin del día ${day.id} · ${esc(day.title)}</h1>
    <div class="endTabs">
      <button class="on" data-et="sum">Resumen</button>
      <button data-et="news">📰 Qué pasó después${nw.news.some((n) => n.tone === 'bad') ? ' <i class="dot"></i>' : ''}</button>
      <button data-et="rev">📋 Repaso de errores${nRev ? ` (${nRev})` : ''}</button>
    </div>
    <div class="etPane" data-pane="sum">
      <div class="sumStars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <div class="kpis">
        <div><span>Counter</span><b>${ck.ok}/${ck.total} decisiones</b></div>
        <div><span>Puerta</span><b>${gate.ok}/${gate.total} decisiones</b></div>
        <div><span>Errores críticos</span><b class="${crit ? 'err' : ''}">${crit}</b>${caught ? `<small>${caught} atajado(s) en la puerta</small>` : ''}</div>
        <div><span>Puntaje counter</span><b>${ck.score}</b></div>
        <div><span>Puntaje puerta</span><b>${gate.score}</b></div>
        <div><span>Embarcados</span><b>${gate.boarded}/${gate.checked}</b></div>
      </div>
      <div class="story"><div class="who">${api.faceSVG(MARTA.face, { w: 70, h: 88, bg: '#dce7f0' })}<b>Marta</b></div>
      <div class="says"><p>${esc(comments[Math.floor(Math.random() * comments.length)])}</p>${isLast && stars ? '<p>🎖 ¡Completaste tu primer mes en Aeroplata! Te ganaste el pin de la compañía.</p>' : ''}
      <p>Antes de irte, mirá <b>qué pasó después</b> con tus pasajeros${nRev ? ' y repasá los errores, que para eso estamos' : ''}.</p></div></div>
    </div>
    <div class="etPane hidden" data-pane="news">
      <p class="hint">Al día siguiente, en tu bandeja de entrada... Así terminaron las decisiones que tomaste.</p>
      ${newsHTML(nw)}
    </div>
    <div class="etPane hidden" data-pane="rev">
      ${reviewHTML(rev, api.faceSVG)}
      ${decks.ck.length || decks.gate.length ? `<div class="row gap replay">
        ${decks.ck.length ? `<button class="btn warn" id="rpCk">🔁 Practicar los casos del counter (${decks.ck.length})</button>` : ''}
        ${decks.gate.length ? `<button class="btn warn" id="rpGate">🔁 Practicar los casos de la puerta (${decks.gate.length})</button>` : ''}
      </div><p class="hint">Se arman pasajeros nuevos con los mismos casos, en modo aprendizaje y sin afectar tus estrellas.</p>` : ''}
    </div>
    <div class="row end gap"><button class="btn ok" id="eMenu">Volver al menú</button></div></div>`, 'wide');
  document.querySelectorAll('[data-et]').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('[data-et]').forEach((x) => x.classList.toggle('on', x === t));
      document.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== t.dataset.et));
      t.querySelector('.dot')?.remove();
    };
  });
  const replay = (r) => { try { sessionStorage.setItem('ckReplay', JSON.stringify({ ...r, day: day.id, level: day.level, title: day.title })); } catch {} location.reload(); };
  const flights = day.flights || [day.flight];
  if ($('#rpCk')) $('#rpCk').onclick = () => replay({ where: 'counter', deck: decks.ck, flights, start: day.start });
  if ($('#rpGate')) $('#rpGate').onclick = () => replay({ where: 'gate', cases: [...decks.gate, 'ok', 'wchr'], flightNo: day.flight });
  $('#eMenu').onclick = () => location.reload();
}

// Presentación de los compañeros del turno (mostradores 21 y 23)
function crewIntro() {
  const c = teamCrew();
  if (c.length < 2) return '';
  return `Te acompañan <b>${esc(c[0].name)}</b> en el 21 y <b>${esc(c[1].name)}</b> en el 23: la fila es una sola. Tocá sus tarjetas (arriba a la derecha) para ver cómo atienden${c[1].role === 'nuevo' ? `, y si ${esc(c[1].name)} te consulta algo, dale una mano` : ''}.`;
}

// "hace 5 minutos", "hace 2 horas", "el 08/10"
function fmtAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  if (m < 24 * 60) return `hace ${Math.round(m / 60)} h`;
  const d = new Date(t);
  return `el ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Opciones del counter de un día (las usan el inicio normal y el retomado)
function counterOpts(day, flights) {
  const label = flights.length === 1 ? `${flights[0].no} ${flights[0].city}` : `${flights.length} vuelos`;
  return {
    deck: day.checkin, flights: flights.map((f) => f.no), start: day.start, mode: day.mode, level: day.level, blocked: day.briefing.blocked,
    ovbk: day.ovbk || null, outage: day.outage || null,
    team: true, consults: !day.tutorial,
    counterLabel: `Mostrador 22 · ${label}`, signLabel: flights.map((f) => `${f.no} ${f.city.toUpperCase()}`).join('  ·  '),
    onEnd: (results, score, queueLog) => afterCheckin(day, results, score, queueLog),
  };
}

// Counter guardado a mitad (después de cada pasajero)
function loadShift() {
  try {
    const s = JSON.parse(localStorage.getItem('ckShift') || 'null', (k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v));
    return s && s.name === (studentName() || 'Agente') && DAYS.some((d) => d.id === s.day) ? s : null;
  } catch { return null; }
}
function resumeCounter(saved) {
  const day = DAYS.find((d) => d.id === saved.day);
  const flights = (day.flights || [day.flight]).map((no) => FLIGHTS.find((f) => f.no === no));
  api.setStudent(studentName() || 'Agente');
  story([`¡Volviste! Tu mostrador quedó tal cual: ya atendiste a ${saved.snap.idx + 1} de ${saved.snap.pax.length} pasajeros. Seguimos con el próximo.`], () => {
    api.resumeCheckin(saved, { ...counterOpts(day, flights), saveTag: { name: saved.name, day: day.id } });
  }, 'Volver al counter ▶');
}

// Puerta de embarque guardada a mitad (después de cada pasajero)
function loadGate() {
  try {
    const s = JSON.parse(localStorage.getItem('ckGate') || 'null');
    return s && s.name === (studentName() || 'Agente') && DAYS.some((d) => d.id === s.day) ? s : null;
  } catch { return null; }
}
function resumeGate(saved, cp) {
  const day = DAYS.find((d) => d.id === saved.day);
  api.setStudent(studentName() || 'Agente');
  story([`¡Volviste! La puerta ${FLIGHTS.find((f) => f.no === day.flight).gate} quedó como la dejaste: ${saved.closed ? 'el vuelo ya está cerrado, falta ver el informe.' : `${saved.boarded} de ${saved.checked} pasajeros a bordo. Seguimos embarcando.`}`], () => {
    api.resumeBoarding(saved, {
      onEvent: (ev, B) => gateCoach(day, ev, B),
      onDone: (gate) => endDay(day, cp.ck, gate),
      saveTag: { name: saved.name, day: day.id },
    });
  }, 'Volver a la puerta ▶');
}
