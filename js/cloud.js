// NUBE (Firebase): cuenta con Google o correo, y el progreso guardado en Firestore.
//  · Sin cuenta, todo funciona como antes (en el navegador).
//  · Al entrar por primera vez, lo que había en el navegador se sube a la nube.
//  · Si la nube y este navegador tienen progresos distintos, se pregunta cuál conservar.
//  · Con sesión iniciada, la nube es la fuente de verdad: el navegador queda como copia
//    de trabajo y cada cambio se sube solo. Al salir de la cuenta se borra la copia local
//    (importante en las compus compartidas del laboratorio).
// El SDK se carga recién al iniciar: si no hay internet, el juego sigue funcionando sin nube.
import { esc } from './util.js';

const $ = (s) => document.querySelector(s);
const V = '10.12.2';
const CONFIG = {
  apiKey: 'AIzaSyA2ZBcrCoh2iF_r2u_tPGJ3VMZvAzQ0dWk',
  authDomain: 'next-please-tuga.firebaseapp.com',
  projectId: 'next-please-tuga',
  storageBucket: 'next-please-tuga.firebasestorage.app',
  messagingSenderId: '819527064140',
  appId: '1:819527064140:web:a0b5c918eafa8076d532e9',
};
// Lo que se guarda en la nube (claves del navegador)
const KEYS = ['ckName', 'ckGender', 'ckCareer', 'ckProgress', 'ckCheckpoint', 'ckShift', 'ckGate', 'ckTeam', 'ckEvents', 'ckBook-checkin', 'ckBook-gate'];
const OWNER = 'ckCloudUid', DIRTY = 'ckCloudDirty';

let api, fb = null, user = null, applying = false, pushT = null, justIn = false;
const C = { ready: false, error: null };

export const cloudUser = () => user;
export const cloudReady = () => C.ready;

// ------------------------------------------------------------------
// Copia local <-> nube
// ------------------------------------------------------------------
const rawSet = Storage.prototype.setItem;
const rawRemove = Storage.prototype.removeItem;
function snapshot() {
  const o = {};
  KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v != null) o[k] = v; });
  return o;
}
function applyLocal(data) {
  applying = true;
  try {
    KEYS.forEach((k) => { if (data && data[k] != null) rawSet.call(localStorage, k, data[k]); else rawRemove.call(localStorage, k); });
  } finally { applying = false; }
}
function clearLocal() {
  applying = true;
  try { [...KEYS, OWNER, DIRTY].forEach((k) => rawRemove.call(localStorage, k)); } finally { applying = false; }
}
// Cada cambio en las claves guardadas, con sesión iniciada, se sube a la nube (agrupado)
function watchStorage() {
  const mark = (store, k) => {
    if (store !== window.localStorage || applying || !user || !KEYS.includes(k)) return;
    rawSet.call(localStorage, DIRTY, '1');
    clearTimeout(pushT);
    pushT = setTimeout(push, 1500);
  };
  Storage.prototype.setItem = function (k, v) { rawSet.call(this, k, v); mark(this, k); };
  Storage.prototype.removeItem = function (k) { rawRemove.call(this, k); mark(this, k); };
}
async function push() {
  if (!user || !fb) return;
  clearTimeout(pushT);
  try {
    await fb.setDoc(fb.doc(fb.db, 'users', user.uid), { data: snapshot(), name: localStorage.getItem('ckName') || '', email: user.email || '', updatedAt: fb.serverTimestamp() });
    rawRemove.call(localStorage, DIRTY);
    setBadge();
  } catch (e) { C.error = e.code || e.message; setBadge(); }
}

// Resumen de un progreso, para elegir cuál conservar
function summary(data) {
  const name = data.ckName || '—';
  let days = 0, stars = 0, rank = null, money = null;
  try { const car = JSON.parse(data.ckCareer || '{}')[name] || {}; days = Object.keys(car).length; stars = Object.values(car).reduce((s, x) => s + x, 0); } catch {}
  try {
    const pr = JSON.parse(data.ckProgress || '{}')[name];
    if (pr?.career) { money = pr.career.money; rank = pr.career.xp; }
  } catch {}
  return { name, days, stars, xp: rank, money };
}
const meaningful = (d) => !!(d.ckName || d.ckCareer || d.ckProgress);
const same = (a, b) => KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null));

// ------------------------------------------------------------------
// Inicio y sesión
// ------------------------------------------------------------------
export async function initCloud(a) {
  api = a;
  watchStorage();
  try {
    const base = `https://www.gstatic.com/firebasejs/${V}`;
    const [app, auth, fs] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)]);
    const fApp = app.initializeApp(CONFIG);
    const fAuth = auth.getAuth(fApp);
    fb = { ...auth, ...fs, auth: fAuth, db: fs.getFirestore(fApp) };
    C.ready = true;
    auth.onAuthStateChanged(fAuth, onUser);
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && localStorage.getItem(DIRTY)) push(); });
  } catch (e) {
    C.error = 'offline';
    setBadge();
  }
}

async function onUser(u) {
  user = u;
  if (!u) { setBadge(); return; }
  try {
    const ref = fb.doc(fb.db, 'users', u.uid);
    const snap = await fb.getDoc(ref);
    const local = snapshot();
    const ownedByMe = localStorage.getItem(OWNER) === u.uid;
    if (!snap.exists()) {
      // Primera vez con esta cuenta: lo de este navegador pasa a la nube
      if (!local.ckName && u.displayName) rawSet.call(localStorage, 'ckName', u.displayName.split(' ')[0]);
      rawSet.call(localStorage, OWNER, u.uid);
      await push();
      api.toast?.('☁ Listo: tu progreso quedó guardado en la nube.');
    } else {
      const cloud = snap.data().data || {};
      if (ownedByMe && localStorage.getItem(DIRTY)) await push(); // cambios hechos sin conexión
      else if (!ownedByMe && meaningful(local) && !same(local, cloud)) await chooseCopy(local, cloud);
      else applyLocal(cloud);
      if (justIn) api.toast?.(`☁ Sesión iniciada como ${esc(u.email || 'tu cuenta')}: tu progreso está sincronizado.`);
      rawSet.call(localStorage, OWNER, u.uid);
    }
    C.error = null;
  } catch (e) {
    C.error = e.code || e.message;
    api.toast?.(`☁ No se pudo sincronizar (${esc(C.error)}). Seguís jugando en este navegador.`);
  }
  justIn = false;
  setBadge();
  api.refresh?.();
}

// La nube y este navegador tienen progresos distintos: que elija
function chooseCopy(local, cloud) {
  return new Promise((resolve) => {
    const card = (id, title, d) => {
      const s = summary(d);
      return `<button class="homeCard" id="${id}"><span class="icoTile ${id === 'ccCloud' ? 'b' : 'y'}"><i class="mdi mdi-${id === 'ccCloud' ? 'cloud' : 'laptop'}"></i></span><h2>${title}</h2>
        <p><b>${esc(s.name)}</b> · Historia: ${s.days} día(s), ${s.stars} ★${s.money != null ? ` · Carrera: $ ${Math.round(s.money).toLocaleString('es-AR')}` : ''}</p></button>`;
    };
    api.openModal(`<div class="home"><h1>☁ ¿Qué progreso conservás?</h1>
      <p class="lead">Tu cuenta ya tiene un progreso guardado en la nube, y en esta compu hay otro distinto. Elegí con cuál seguir: <b>el otro se reemplaza</b>.</p>
      <div class="homeGrid">${card('ccCloud', 'El de la nube', cloud)}${card('ccLocal', 'El de esta compu', local)}</div></div>`, 'wide');
    // Con la copia de la nube recargamos: así nombre, perfil y partidas arrancan con esos datos
    $('#ccCloud').onclick = () => { applyLocal(cloud); rawSet.call(localStorage, OWNER, user.uid); location.reload(); };
    $('#ccLocal').onclick = async () => { await push(); api.closeModal(); resolve(); };
  });
}

// ------------------------------------------------------------------
// Pantallas: entrar / salir
// ------------------------------------------------------------------
const ERR = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'auth/wrong-password': 'Contraseña incorrecta.', 'auth/user-not-found': 'No hay una cuenta con ese correo.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo: probá "Entrar".', 'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
  'auth/invalid-email': 'Ese correo no parece válido.', 'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
  'auth/unauthorized-domain': 'Este sitio todavía no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).',
  'auth/network-request-failed': 'Sin conexión a internet.', 'auth/too-many-requests': 'Demasiados intentos. Esperá un rato y probá de nuevo.',
};
const errMsg = (e) => ERR[e.code] || `No se pudo (${e.code || e.message}).`;

export function openLogin(back) {
  if (!C.ready) { api.toast?.('☁ La nube no está disponible ahora (¿hay internet?). Podés seguir jugando en este navegador.'); return; }
  api.openModal(`<div class="home login">
    <h1>☁ Guardá tu progreso en la nube</h1>
    <p class="lead">Con una cuenta, tu historia, tu carrera y tus estadísticas quedan guardadas y podés seguir desde cualquier compu o el celu. Lo que tenés en este navegador se sube solo.</p>
    <button class="btn big gBtnLogin" id="lgGoogle"><svg viewBox="0 0 48 48" width="22" height="22"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C40.9 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Entrar con Google</button>
    <div class="orLine"><span>o con tu correo</span></div>
    <div class="start">
      <label>Correo<input id="lgMail" type="email" autocomplete="email" placeholder="nombre@ejemplo.com"></label>
      <label>Contraseña<input id="lgPass" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres"></label>
    </div>
    <p class="hint err hidden" id="lgErr"></p>
    <div class="row gap wrap"><button class="btn ok" id="lgIn">Entrar</button><button class="btn" id="lgNew">Crear cuenta</button><button class="btn ghost sm" id="lgForgot">Olvidé mi contraseña</button></div>
    <div class="row end"><button class="btn ghost" id="lgBack">← Volver</button></div>
  </div>`, 'wide');
  const err = (m) => { $('#lgErr').textContent = m; $('#lgErr').classList.remove('hidden'); };
  const done = () => { api.closeModal(); (back || api.showHome)(); };
  $('#lgBack').onclick = done;
  $('#lgGoogle').onclick = async () => {
    try { justIn = true; await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()); done(); } catch (e) { err(errMsg(e)); }
  };
  const mail = () => $('#lgMail').value.trim(), pass = () => $('#lgPass').value;
  $('#lgIn').onclick = async () => { try { justIn = true; await fb.signInWithEmailAndPassword(fb.auth, mail(), pass()); done(); } catch (e) { err(errMsg(e)); } };
  $('#lgNew').onclick = async () => { try { await fb.createUserWithEmailAndPassword(fb.auth, mail(), pass()); done(); } catch (e) { err(errMsg(e)); } };
  $('#lgForgot').onclick = async () => {
    if (!mail()) { err('Escribí tu correo arriba y tocá de nuevo.'); return; }
    try { await fb.sendPasswordResetEmail(fb.auth, mail()); err('Te mandamos un correo para cambiar la contraseña.'); } catch (e) { err(errMsg(e)); }
  };
}

export async function logout() {
  if (!fb || !user) return;
  if (localStorage.getItem(DIRTY)) await push();
  await fb.signOut(fb.auth);
  clearLocal();
  location.reload();
}

// Estado de la nube para mostrar en el inicio
export function cloudBadgeHTML() {
  if (user) return `<span class="cloudBadge on" title="${esc(user.email || '')}"><i class="mdi mdi-cloud-check"></i> En la nube</span><button class="btn sm ghost" id="hLogout" title="Salir de la cuenta (se borra la copia de esta compu)"><i class="mdi mdi-logout"></i></button>`;
  if (C.error === 'offline') return '<span class="cloudBadge off"><i class="mdi mdi-cloud-off-outline"></i> Sin nube</span>';
  return '<button class="btn sm" id="hLogin"><i class="mdi mdi-cloud-upload"></i> Guardar en la nube</button>';
}
export function bindBadge() {
  $('#hLogin') && ($('#hLogin').onclick = () => openLogin());
  $('#hLogout') && ($('#hLogout').onclick = async () => {
    const ok = await api.confirm({ title: 'Salir de la cuenta', text: 'Tu progreso queda guardado en la nube y se borra la copia de esta compu. ¿Salir?', ok: 'Salir', cancel: 'Quedarme', icon: 'logout' });
    if (ok) logout();
  });
}
function setBadge() { const el = $('#cloudSlot'); if (el) { el.innerHTML = cloudBadgeHTML(); bindBadge(); } }
