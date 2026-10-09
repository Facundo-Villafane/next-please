// TURNO DEL DÍA: el mismo turno para todos los alumnos cada día real (se arma con la fecha
// como semilla). Counter solo (sin compañeros, para que sea parejo), contra reloj, sin imprevistos.
// Vale el primer intento: se guarda en el ranking de la nube. Suma al presentismo.
import { FLIGHTS } from './data.js';
import { buildSmartDeck } from './generator.js';
import { randomShift, markPresence, presence, load, save } from './progress.js';
import { cloudUser, cloudReady, openLogin, submitDaily, fetchDaily } from './cloud.js';
import { getPlayer, gtxt } from './player.js';
import { faceSVG } from './docs.js';
import { SUP } from './supervisor.js';
import { esc, dateKey, seedRandom } from './util.js';

const $ = (s) => document.querySelector(s);
const KEY = 'ckDaily';
const LEVELS = ['intermedio', 'basico', 'intermedio', 'intermedio', 'avanzado', 'intermedio', 'avanzado']; // domingo..sábado
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
let api;
export function initDaily(a) { api = a; }

// El plan de hoy: igual para todos (vuelos, hora, casos y pasajeros salen de la fecha)
export function dailyPlan(day = dateKey()) {
  const unseed = seedRandom(`next-please-${day}`);
  try {
    const level = LEVELS[new Date(`${day}T12:00:00`).getDay()];
    const rs = randomShift(3);
    const n = { basico: 10, intermedio: 12, avanzado: 14 }[level];
    const deck = buildSmartDeck(level, n);
    return { day, level, n, start: rs.start, flights: rs.flights, deck, seed: `next-please-${day}-pax` };
  } finally { unseed(); }
}

// Resultado guardado en este navegador (por nombre): el primer intento de hoy y el mejor
function loadLocal() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function mine(day = dateKey()) { return (loadLocal()[getPlayer().name || 'Agente'] || {})[day] || null; }
function saveMine(day, r) {
  const all = loadLocal(), n = getPlayer().name || 'Agente';
  all[n] = all[n] || {};
  // Sólo se guarda el día de hoy y los últimos días (para no crecer sin fin)
  Object.keys(all[n]).sort().slice(0, -14).forEach((k) => delete all[n][k]);
  all[n][day] = r;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
}
export function dailyDone() { return !!mine(); }

const fmtDay = (day) => { const d = new Date(`${day}T12:00:00`); return `${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
const viv = (text) => `<div class="story"><div class="who">${faceSVG(SUP.face, { w: 60, h: 75, bg: '#dce7f0' })}<b>${SUP.short}</b></div><div class="says"><p>${gtxt(text)}</p></div></div>`;

// ------------------------------------------------------------------
// Pantalla del turno del día: qué toca hoy, tu resultado y el ranking
// ------------------------------------------------------------------
export function showDaily() {
  const plan = dailyPlan();
  const me = mine();
  const pr = presence();
  const fl = (plan.flights || []).map((no) => FLIGHTS.find((f) => f.no === no)).filter(Boolean);
  api.openModal(`<div class="home daily">
    <h1><i class="mdi mdi-calendar-today"></i> Turno del día · ${fmtDay(plan.day)}</h1>
    ${viv(me ? pickLine(me) : 'Hoy todos atienden el mismo turno: mismos vuelos, mismos pasajeros, mismo reloj. Vale el <b>primer intento</b>, así que nada de "lo hago de nuevo hasta que me salga". En la vida real tampoco hay segunda vuelta.')}
    <div class="dailyPlan">
      <div><span>Pasajeros</span><b>${plan.n}</b></div>
      <div><span>Nivel</span><b>${{ basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' }[plan.level]}</b></div>
      <div><span>Vuelos</span><b>${fl.length ? fl.map((f) => esc(f.city)).join(' · ') : 'Todos'}</b></div>
      <div><span>Modo</span><b>Contra reloj · solo/a</b></div>
    </div>
    <div class="presence ${pr.today ? 'done' : ''}"><i class="mdi mdi-fire"></i><div><b>Presentismo: ${pr.streak === 1 ? '1 día' : `${pr.streak} días seguidos`}</b><small>${pr.today ? 'Hoy ya contó.' : 'Jugar el turno de hoy mantiene tu racha.'}</small></div></div>
    ${me ? `<div class="dailyMine"><span class="icoTile g"><i class="mdi mdi-check-decagram"></i></span><div><small>Tu turno de hoy</small><b>${me.score} puntos · ${me.ok}/${me.total} correctas · ${fmtSecs(me.secs)}</b>${me.sent ? '<small>En el ranking.</small>' : '<small>No quedó en el ranking (sin cuenta en la nube).</small>'}</div></div>` : ''}
    <h3>Ranking de hoy</h3>
    <div id="dRank" class="rankList"><p class="hint">${cloudUser() ? 'Cargando…' : cloudReady() ? 'Entrá con tu cuenta para ver el ranking y aparecer en él.' : (showDaily.tries || 0) >= 19 ? 'Sin conexión con la nube: el ranking no está disponible.' : 'Conectando con la nube…'}</p></div>
    <div class="row end gap wrap">
      <button class="btn ghost" id="dBack">← Volver</button>
      ${!cloudUser() && cloudReady() ? '<button class="btn" id="dLogin"><i class="mdi mdi-cloud-upload"></i> Entrar con mi cuenta</button>' : ''}
      <button class="btn ${me ? '' : 'ok big'}" id="dGo">${me ? 'Volver a jugar (no cuenta)' : 'Jugar el turno de hoy ▶'}</button>
    </div></div>`, 'wide');
  $('#dBack').onclick = () => api.showPlay();
  if ($('#dLogin')) $('#dLogin').onclick = () => openLogin(showDaily);
  $('#dGo').onclick = () => startDaily(plan, !me);
  if (cloudUser()) loadRanking(plan.day);
  // La nube tarda un momento en conectar al cargar la página: cuando esté, se redibuja
  else if (!cloudReady() && (showDaily.tries = (showDaily.tries || 0) + 1) < 20) setTimeout(() => { if ($('#dGo')) showDaily(); }, 500);
}

async function loadRanking(day, highlight = null) {
  const list = await fetchDaily(day);
  const el = $('#dRank');
  if (!el) return null;
  if (!list) { el.innerHTML = '<p class="hint">No se pudo cargar el ranking. Probá más tarde.</p>'; return null; }
  if (!list.length) { el.innerHTML = '<p class="hint">Todavía no jugó nadie hoy. ¡Podés ser el primer puesto!</p>'; return list; }
  el.innerHTML = list.map((r, i) => `<div class="rk ${r.me ? 'me' : ''} ${i < 3 ? `top${i + 1}` : ''}"><span class="pos">${i < 3 ? `<i class="mdi mdi-medal"></i>` : i + 1}</span><b>${esc(r.name || 'Agente')}${r.me ? ' (vos)' : ''}</b><small>${r.ok}/${r.total} · ${fmtSecs(r.secs)}</small><span class="pts">${r.score}</span></div>`).join('');
  if (highlight) el.querySelector('.me')?.scrollIntoView({ block: 'nearest' });
  return list;
}
const fmtSecs = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
function pickLine(me) {
  if (me.ok === me.total) return 'Ya jugaste hoy. Perfecto, ni un error. No te acostumbres a que te felicite.';
  if (me.ok / me.total >= 0.8) return 'Ya jugaste hoy. Bastante bien. Mirá el ranking y fijate quién te ganó, que siempre hay alguien.';
  return 'Ya jugaste hoy, y no fue tu mejor día. Podés repetirlo para practicar, pero el ranking ya está. Mañana hay otro.';
}

// ------------------------------------------------------------------
// Jugar
// ------------------------------------------------------------------
function startDaily(plan, counts) {
  const t0 = Date.now();
  api.closeModal();
  api.setStudent(getPlayer().name || 'Agente');
  api.startCheckin({
    deck: plan.deck, flights: plan.flights, start: plan.start, seed: plan.seed, mode: 'challenge', level: plan.level,
    team: false, consults: false, events: false, outage: null,
    counterLabel: `Mostrador 22 · Turno del día`, signLabel: `TURNO DEL DÍA · ${fmtDay(plan.day).toUpperCase()}`,
    onEnd: (results, score) => finishDaily(plan, counts, results, score, Math.round((Date.now() - t0) / 1000)),
  });
}

async function finishDaily(plan, counts, results, score, secs) {
  const ok = results.filter((r) => r.ev.correct).length;
  const r = { score: Math.round(score), ok, total: results.length, secs, sent: false };
  // Presentismo y el primer intento (si en el medio cambió el día, cuenta para el día del plan)
  const pres = markPresence();
  let note = '', list = null;
  if (counts && !mine(plan.day)) {
    if (cloudUser()) {
      const res = await submitDaily(plan.day, { name: (getPlayer().name || 'Agente').slice(0, 40), score: r.score, ok: r.ok, total: r.total, secs: r.secs });
      r.sent = res.ok || res.why === 'dup';
      if (res.why === 'dup') note = 'Ya tenías un puntaje cargado hoy desde otra compu: vale ese.';
      else if (!res.ok) note = 'No se pudo cargar en el ranking (¿internet?).';
    } else note = 'No tenés cuenta en la nube: tu puntaje queda sólo en esta compu y no entra en el ranking.';
    saveMine(plan.day, r);
    const p = load();
    if (!p.career.milestones.daily_first) { p.career.milestones.daily_first = Date.now(); save(p); }
  } else note = 'Este intento no cuenta para el ranking: vale el primero del día.';
  api.openModal(`<div class="home daily">
    <h1><i class="mdi mdi-flag-checkered"></i> Turno del día terminado</h1>
    <div class="kpis">
      <div><span>Puntaje</span><b>${r.score}</b></div>
      <div><span>Correctas</span><b>${r.ok}/${r.total}</b></div>
      <div><span>Tiempo</span><b>${fmtSecs(secs)}</b></div>
      <div><span>Presentismo</span><b><i class="mdi mdi-fire"></i> ${pres.streak} ${pres.streak === 1 ? 'día' : 'días'}</b>${pres.newDay ? '<small>¡Hoy contó!</small>' : ''}</div>
    </div>
    ${note ? `<p class="hint">${note}</p>` : ''}
    <h3>Ranking de hoy</h3>
    <div id="dRank" class="rankList"><p class="hint">${cloudUser() ? 'Cargando…' : 'Entrá con tu cuenta para aparecer en el ranking.'}</p></div>
    <div class="row end gap"><button class="btn ok" id="dEnd">Volver al menú</button></div></div>`, 'wide');
  $('#dEnd').onclick = () => api.backTo('daily');
  if (cloudUser()) list = await loadRanking(plan.day, true);
  // Podio
  const pos = list ? list.findIndex((x) => x.me) : -1;
  if (pos >= 0 && pos < 3) {
    const p = load();
    if (!p.career.milestones.daily_podium) { p.career.milestones.daily_podium = Date.now(); save(p); api.toast?.('<i class="mdi mdi-podium-gold"></i> Hito: <b>Al podio</b>. Terminaste entre los 3 primeros del turno del día.'); }
  }
}
