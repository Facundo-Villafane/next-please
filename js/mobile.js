// Celular (pantalla angosta): arriba la escena 3D; abajo dos pestañas,
// "Pasajero" (diálogo, preguntas y documentos) y "Sistema" (DCS y botones de decisión).
// En la compu no cambia nada: el diálogo vuelve a flotar sobre la escena.
const $ = (s) => document.querySelector(s);
const mq = window.matchMedia('(max-width: 760px)');
let tab = 'pax';

function apply() {
  const on = mq.matches;
  document.body.classList.toggle('mobile', on);
  const dialog = $('#dialog'), desk = $('#desk'), view = $('#view3d');
  if (!dialog || !desk || !view) return;
  // El diálogo va arriba de los documentos en el celu, y flotando sobre la escena en la compu
  if (on && dialog.parentElement !== desk) desk.prepend(dialog);
  if (!on && dialog.parentElement !== view) view.appendChild(dialog);
  show(tab);
}

export function mobileShow(which) {
  tab = which;
  document.body.classList.toggle('mt-pax', which === 'pax');
  document.body.classList.toggle('mt-dcs', which === 'dcs');
  document.querySelectorAll('#mobTabs button').forEach((b) => b.classList.toggle('on', b.dataset.mt === which));
  if (which === 'dcs') $('#mobTabs [data-mt="dcs"]')?.classList.remove('ping');
}
const show = mobileShow;

// Avisa en la pestaña "Sistema" que hay novedades (mensaje del DCS) si estás mirando la otra
export function mobilePing() {
  if (!mq.matches || tab === 'dcs') return;
  $('#mobTabs [data-mt="dcs"]')?.classList.add('ping');
}

export function initMobile() {
  if (!$('#mobTabs')) {
    $('#layout').insertAdjacentHTML('afterbegin', `<nav id="mobTabs">
      <button data-mt="pax" class="on"><i class="mdi mdi-account-voice"></i> Pasajero</button>
      <button data-mt="dcs"><i class="mdi mdi-monitor"></i> Sistema <i class="dot"></i></button></nav>`);
    $('#mobTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.mt); });
  }
  mq.addEventListener?.('change', apply);
  apply();
}
