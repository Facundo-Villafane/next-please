// Menú de pausa y Configuración (sonido, juego, cuenta, perfil). El inicio y "Jugar" están en career.js.
import { settings, setSetting, sfx, announce, voicesFor, canSpeak } from './sound.js';
import { cloudUser, cloudReady, openLogin, logout, syncNow } from './cloud.js';
import { esc } from './util.js';

const $ = (s) => document.querySelector(s);
let api;
export function initMenu(a) { api = a; }

// ------------------------------------------------------------------
// Pausa: reanudar, guardar, configuración, menú principal
// ------------------------------------------------------------------
// o = { where: 'counter'|'gate', saved: hay guardado, save(): guarda ya, resume(), online }
export function pauseMenu(o) {
  const show = (msg = '') => {
    api.openModal(`<div class="pause pauseMenu">
      <h1><i class="mdi mdi-pause-circle"></i> Pausa</h1>
      <p class="hint">${o.online ? 'En la sala el turno sigue para tus compañeros.' : 'El reloj del turno está detenido.'}</p>
      <div class="menuList">
        <button class="btn ok big" id="pmResume"><i class="mdi mdi-play"></i> Reanudar</button>
        <button class="btn big" id="pmSave" ${o.saved ? '' : 'disabled'}><i class="mdi mdi-content-save"></i> Guardar</button>
        ${o.saved ? '' : `<small class="hint">${o.online ? 'Las salas no se guardan.' : 'La práctica libre no se guarda: es para practicar sin presión.'}</small>`}
        <p class="pmMsg ${msg ? '' : 'hidden'}" id="pmMsg">${msg}</p>
        <button class="btn big" id="pmSettings"><i class="mdi mdi-cog"></i> Configuración</button>
        <button class="btn big ghost" id="pmHome"><i class="mdi mdi-home"></i> Menú principal</button>
      </div></div>`);
    $('#pmResume').onclick = () => { api.closeModal(); o.resume(); };
    $('#pmSave').onclick = () => {
      if (!o.save()) return;
      $('#pmMsg').innerHTML = `<i class="mdi mdi-check-circle"></i> Guardado a las ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}. Igual se guarda solo después de cada pasajero.`;
      $('#pmMsg').classList.remove('hidden');
    };
    $('#pmSettings').onclick = () => showSettings({ back: () => show(), inGame: true });
    $('#pmHome').onclick = async () => {
      const ok = await api.confirm(o.saved
        ? { title: 'Volver al menú principal', text: 'Tu turno queda guardado tal cual está. Lo retomás desde Continuar en el inicio.', ok: 'Ir al menú', cancel: 'Seguir jugando', icon: 'content-save-check' }
        : { title: 'Volver al menú principal', text: o.online ? 'Vas a salir de la sala y tu mostrador lo toma un compañero virtual. Este turno no se guarda.' : 'Este turno de práctica no se guarda: si salís, se pierde.', ok: 'Salir igual', cancel: 'Seguir jugando', icon: 'alert', tone: 'bad' });
      if (!ok) { show(); return; }
      if (o.saved) o.save();
      api.leave();
    };
  };
  show();
}

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------
const slider = (k, label, icon) => `<label class="setRow"><span><i class="mdi mdi-${icon}"></i> ${label}</span>
  <input type="range" min="0" max="100" step="5" data-vol="${k}" value="${Math.round(settings()[k] * 100)}"><b data-out="${k}">${Math.round(settings()[k] * 100)} %</b></label>`;
const toggle = (k, label, icon, sub = '') => `<label class="setRow"><span><i class="mdi mdi-${icon}"></i> ${label}${sub ? `<small>${sub}</small>` : ''}</span>
  <input type="checkbox" class="switch" data-tog="${k}" ${settings()[k] ? 'checked' : ''}></label>`;

export function showSettings({ back, inGame = false, tab = 'sound' } = {}) {
  const S = settings();
  const u = cloudUser();
  const tabs = [['sound', 'volume-high', 'Sonido'], ['game', 'gamepad-variant', 'Juego'], ['account', 'account-circle', 'Cuenta']];
  const panes = {
    sound: `${toggle('mute', 'Silenciar todo', 'volume-off')}
      ${slider('master', 'Volumen general', 'volume-high')}
      ${slider('sfx', 'Efectos', 'bell-ring')}
      ${slider('amb', 'Ambiente del aeropuerto', 'account-group')}
      <p class="hint">Efectos: llamado de la fila, impresora, escáner, errores del sistema, anuncios. Ambiente: el murmullo de la terminal.</p>
      <h3>Voces de los anuncios</h3>
      ${canSpeak() ? `${toggle('voices', 'Anuncios con voz', 'account-voice', 'Embarque, zonas, llamado final, llamados por nombre, demoras y cancelaciones.')}
      ${toggle('english', 'También en inglés', 'translate', 'Como en Ezeiza: primero en castellano y después en inglés.')}
      ${slider('voice', 'Volumen de la voz', 'microphone')}
      <label class="setRow"><span><i class="mdi mdi-account-tie-voice"></i> Voz en castellano</span><select id="sVoiceEs"></select></label>
      <label class="setRow"><span><i class="mdi mdi-account-tie-voice-outline"></i> Voz en inglés</span><select id="sVoiceEn"></select></label>
      <label class="setRow"><span><i class="mdi mdi-speedometer"></i> Velocidad</span><select id="sRate"><option value="0.85">Pausada</option><option value="1">Normal</option><option value="1.15">Rápida</option></select></label>
      <div class="row gap wrap"><button class="btn sm ok" id="sTryAnn"><i class="mdi mdi-bullhorn"></i> Probar un anuncio</button></div>
      <p class="hint">Las voces son las del navegador y el sistema: cambian según la compu. En Edge y Chrome suelen aparecer voces "naturales" o de Google, que suenan mejor.</p>` : '<p class="hint">Este navegador no tiene síntesis de voz: los anuncios se ven en el cartel, con el gong.</p>'}
      <h3>Probar efectos</h3>
      <div class="row gap wrap"><button class="btn sm" data-try="next"><i class="mdi mdi-play"></i> Llamado</button><button class="btn sm" data-try="print"><i class="mdi mdi-play"></i> Impresora</button><button class="btn sm" data-try="pa"><i class="mdi mdi-play"></i> Anuncio</button><button class="btn sm" data-try="err"><i class="mdi mdi-play"></i> Error</button></div>`,
    game: `${toggle('bubbles', 'Globitos de humor en la fila', 'message-alert', 'Íconos sobre los pasajeros que muestran cómo la llevan con la espera.')}
      <label class="setRow"><span><i class="mdi mdi-monitor"></i> Calidad gráfica<small>Baja: sin sombras ni suavizado, para compus lentas.${inGame ? ' Se aplica la próxima vez que se cargue el juego.' : ''}</small></span>
        <select id="sQuality"><option value="high">Alta</option><option value="low">Baja</option></select></label>
      ${inGame ? '' : `<h3>Perfil</h3><div class="row gap wrap"><button class="btn" id="sProfile"><i class="mdi mdi-pencil"></i> Cambiar nombre o trato</button></div>
      <h3>Progreso</h3><div class="row gap wrap"><button class="btn bad" id="sWipe"><i class="mdi mdi-delete-alert"></i> Borrar todo mi progreso</button></div>
      <p class="hint">Borra historia, carrera, estadísticas y partidas guardadas${u ? ', también en la nube' : ' de este navegador'}. No se puede deshacer.</p>`}`,
    account: u
      ? `<div class="acct"><span class="cloudBadge on"><i class="mdi mdi-cloud-check"></i> Conectado</span><b>${esc(u.email || 'tu cuenta')}</b></div>
        <p class="hint">Tu progreso se sube solo a la nube después de cada cambio, y podés seguir desde cualquier compu o el celular.</p>
        <p class="pmMsg hidden" id="sSyncMsg"></p>
        <div class="row gap wrap"><button class="btn" id="sSync"><i class="mdi mdi-cloud-sync"></i> Sincronizar ahora</button>${inGame ? '' : '<button class="btn ghost" id="sLogout"><i class="mdi mdi-logout"></i> Salir de la cuenta</button>'}</div>
        ${inGame ? '<p class="hint">Para salir de la cuenta, volvé al menú principal.</p>' : '<p class="hint">Al salir, se borra la copia de esta compu (en la nube queda guardado).</p>'}`
      : cloudReady()
        ? `<div class="acct"><span class="cloudBadge"><i class="mdi mdi-cloud-off-outline"></i> Sin cuenta</span></div>
          <p class="hint">Ahora tu progreso está sólo en este navegador. Con una cuenta (Google o correo) queda en la nube y seguís desde cualquier lado.</p>
          ${inGame ? '<p class="hint">Para entrar con tu cuenta, volvé al menú principal.</p>' : '<button class="btn ok" id="sLogin"><i class="mdi mdi-cloud-upload"></i> Entrar o crear cuenta</button>'}`
        : '<div class="acct"><span class="cloudBadge off"><i class="mdi mdi-cloud-off-outline"></i> Nube no disponible</span></div><p class="hint">No hay conexión con la nube (¿internet?). Seguís jugando y se guarda en este navegador.</p>',
  };
  api.openModal(`<div class="home settings">
    <h1><i class="mdi mdi-cog"></i> Configuración</h1>
    <div class="endTabs">${tabs.map(([k, ic, l]) => `<button data-st="${k}" class="${k === tab ? 'on' : ''}"><i class="mdi mdi-${ic}"></i> ${l}</button>`).join('')}</div>
    <div class="setPane">${panes[tab]}</div>
    <div class="row end"><button class="btn ok" id="sBack">Listo</button></div></div>`, 'wide');
  const again = (t) => showSettings({ back, inGame, tab: t });
  document.querySelectorAll('[data-st]').forEach((b) => { b.onclick = () => again(b.dataset.st); });
  document.querySelectorAll('[data-vol]').forEach((r) => {
    r.oninput = () => { setSetting(r.dataset.vol, r.value / 100); $(`[data-out="${r.dataset.vol}"]`).textContent = `${r.value} %`; };
    r.onchange = () => sfx(r.dataset.vol === 'amb' ? 'pa' : 'next');
  });
  document.querySelectorAll('[data-tog]').forEach((c) => { c.onchange = () => setSetting(c.dataset.tog, c.checked); });
  document.querySelectorAll('[data-try]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); sfx(b.dataset.try); }; });
  // Voces: la lista llega tarde en algunos navegadores, así que se completa cuando esté
  const fillVoices = () => {
    [['#sVoiceEs', 'es', 'voiceEs'], ['#sVoiceEn', 'en', 'voiceEn']].forEach(([sel, lang, k]) => {
      const el = $(sel); if (!el) return;
      const list = voicesFor(lang);
      el.innerHTML = `<option value="">Automática${list[0] ? ` (${esc(list[0].name)})` : ''}</option>` + list.map((v) => `<option value="${esc(v.name)}">${esc(v.name)} · ${esc(v.lang)}</option>`).join('');
      el.value = S[k] || '';
      el.onchange = () => setSetting(k, el.value);
    });
  };
  fillVoices();
  if (window.speechSynthesis && !voicesFor('es').length) window.speechSynthesis.addEventListener?.('voiceschanged', fillVoices, { once: true });
  if ($('#sRate')) { $('#sRate').value = String(S.rate); $('#sRate').onchange = () => setSetting('rate', +$('#sRate').value); }
  if ($('#sTryAnn')) $('#sTryAnn').onclick = (e) => { e.stopPropagation(); announce('Su atención por favor: llamado final de embarque a pasajeros del vuelo AP1100 con destino a Miami. Les pedimos embarcar de inmediato por la puerta 12.', 'Your attention please: this is the final boarding call for passengers on flight AP1100 to Miami. Please proceed immediately to gate 12.'); };
  if ($('#sQuality')) { $('#sQuality').value = S.quality; $('#sQuality').onchange = () => setSetting('quality', $('#sQuality').value); }
  if ($('#sProfile')) $('#sProfile').onclick = () => api.editProfile();
  if ($('#sWipe')) $('#sWipe').onclick = async () => {
    const ok = await api.confirm({ title: 'Borrar todo el progreso', text: 'Se borran tus días de la historia, la carrera, la plata, las estadísticas y las partidas guardadas. No se puede deshacer.', ok: 'Borrar todo', cancel: 'Cancelar', icon: 'delete-alert', tone: 'bad' });
    if (!ok) { again('game'); return; }
    ['ckCareer', 'ckProgress', 'ckCheckpoint', 'ckShift', 'ckGate', 'ckCShift', 'ckCGate', 'ckBook-checkin', 'ckBook-gate'].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
    await syncNow();
    api.leave();
  };
  if ($('#sLogin')) $('#sLogin').onclick = () => openLogin(() => again('account'));
  if ($('#sLogout')) $('#sLogout').onclick = async () => {
    const ok = await api.confirm({ title: 'Salir de la cuenta', text: 'Tu progreso queda guardado en la nube y se borra la copia de esta compu. ¿Salir?', ok: 'Salir', cancel: 'Quedarme', icon: 'logout' });
    if (ok) logout(); else again('account');
  };
  if ($('#sSync')) $('#sSync').onclick = async () => {
    const m = $('#sSyncMsg');
    m.textContent = 'Sincronizando…'; m.classList.remove('hidden');
    const ok = await syncNow();
    if ($('#sSyncMsg')) $('#sSyncMsg').innerHTML = ok ? '<i class="mdi mdi-check-circle"></i> Listo: todo está en la nube.' : '<i class="mdi mdi-alert"></i> No se pudo sincronizar. Probá de nuevo en un rato.';
  };
  $('#sBack').onclick = () => (back ? back() : api.closeModal());
}
