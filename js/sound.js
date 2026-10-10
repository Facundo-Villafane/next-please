// Sonido: todo sintetizado con Web Audio (sin archivos). Efectos del mostrador y la puerta
// (llamado, impresora, escáner, error del sistema, anuncios) y ambiente de aeropuerto (murmullo).
// Volúmenes en Configuración, guardados en este navegador (ckSettings).
const KEY = 'ckSettings';
const DEF = { master: 0.8, sfx: 0.8, amb: 0.4, voice: 0.9, mute: false, voices: true, english: true, voiceEs: '', voiceEn: '', rate: 1, bubbles: true, quality: 'high' };
let S = { ...DEF };
try { S = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}

export const settings = () => S;
export function setSetting(k, v) {
  S[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
  applyVolumes();
}

let ctx = null, master, sfxBus, ambBus, noiseBuf, amb = null, ambWanted = false;
function ac() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  ambBus = ctx.createGain(); ambBus.connect(master);
  // Ruido de 2 s para impresora, cinta, murmullo
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // ruido marrón
  applyVolumes();
  return ctx;
}
function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(S.mute ? 0 : S.master, t, 0.05);
  sfxBus.gain.setTargetAtTime(S.sfx, t, 0.05);
  ambBus.gain.setTargetAtTime(S.amb * 0.5, t, 0.3);
}
// El navegador sólo deja sonar después de un gesto del usuario
// iPhone: el sonido de la página va como "reproducción" (no como timbre), así suena aunque el
// celu esté en silencio (iOS 17+). Y el audio sólo se habilita con un toque completo (touchend/click).
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
let unlocked = false;
const unlock = () => {
  const c = ac();
  if (!c) return;
  if (!unlocked) {
    unlocked = true;
    // Un sonido mudo dentro del toque "despierta" el audio en Safari
    try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch {}
    // Y una frase vacía despierta la voz de los anuncios
    try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } } catch {}
  }
  if (c.state !== 'running') c.resume?.();
  if (ambWanted) startAmb();
};
['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));
// Al volver a la pestaña (o desbloquear el celu) el navegador puede haber pausado el audio
document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume?.(); });

// ------------------------------------------------------------------
// Bloques
// ------------------------------------------------------------------
function tone(freq, start, dur, { type = 'sine', vol = 0.3, to = null, bus } = {}) {
  const c = ac(); if (!c || S.mute) return;
  const t = c.currentTime + start;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(start, dur, { vol = 0.3, freq = 2000, q = 1, type = 'bandpass', bus } = {}) {
  const c = ac(); if (!c || S.mute) return;
  const t = c.currentTime + start;
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus || sfxBus);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

// ------------------------------------------------------------------
// Efectos
// ------------------------------------------------------------------
const FX = {
  click: () => tone(1800, 0, 0.03, { type: 'square', vol: 0.04 }),
  // "¡Siguiente!": dos notas tipo llamador de fila
  next: () => { tone(988, 0, 0.35, { vol: 0.18 }); tone(784, 0.16, 0.5, { vol: 0.18 }); },
  // Sistema: confirmación y error
  ok: () => tone(1320, 0, 0.08, { type: 'square', vol: 0.06 }),
  err: () => { tone(220, 0, 0.14, { type: 'sawtooth', vol: 0.1 }); tone(196, 0.15, 0.2, { type: 'sawtooth', vol: 0.1 }); },
  // Escáner de tarjeta / documento
  scan: () => tone(2400, 0, 0.09, { type: 'square', vol: 0.07 }),
  scanBad: () => { tone(400, 0, 0.12, { type: 'square', vol: 0.08 }); tone(400, 0.16, 0.12, { type: 'square', vol: 0.08 }); },
  // Impresora térmica (tarjeta, etiqueta)
  print: () => { for (let i = 0; i < 9; i++) noise(i * 0.055, 0.04, { vol: 0.16, freq: 3200, q: 3 }); noise(0.52, 0.06, { vol: 0.12, freq: 1500, q: 2 }); },
  // Cinta de equipaje
  belt: () => { noise(0, 0.9, { vol: 0.12, freq: 180, q: 0.7, type: 'lowpass' }); tone(70, 0, 0.9, { type: 'triangle', vol: 0.08 }); },
  // Gong de anuncio del aeropuerto (tres notas)
  pa: () => { [523, 659, 784].forEach((f, i) => { tone(f, i * 0.32, 1.1, { vol: 0.16 }); tone(f * 2, i * 0.32, 0.6, { vol: 0.03 }); }); },
  good: () => { tone(660, 0, 0.12, { type: 'triangle', vol: 0.15 }); tone(880, 0.1, 0.12, { type: 'triangle', vol: 0.15 }); tone(1320, 0.2, 0.3, { type: 'triangle', vol: 0.14 }); },
  bad: () => { tone(330, 0, 0.18, { type: 'triangle', vol: 0.16 }); tone(262, 0.18, 0.35, { type: 'triangle', vol: 0.16 }); },
  // Alarma de imprevisto
  alarm: () => { for (let i = 0; i < 4; i++) { tone(880, i * 0.4, 0.18, { type: 'square', vol: 0.07 }); tone(660, i * 0.4 + 0.2, 0.18, { type: 'square', vol: 0.07 }); } },
  // Caja registradora (sueldo)
  cash: () => { noise(0, 0.08, { vol: 0.2, freq: 4000, q: 2 }); tone(2093, 0.08, 0.5, { vol: 0.12 }); tone(2637, 0.12, 0.6, { vol: 0.1 }); },
  radio: () => { noise(0, 0.12, { vol: 0.1, freq: 1800, q: 1.5 }); tone(1200, 0.12, 0.05, { type: 'square', vol: 0.03 }); },
  stamp: () => { noise(0, 0.07, { vol: 0.35, freq: 300, q: 0.8, type: 'lowpass' }); tone(90, 0, 0.12, { vol: 0.2 }); },
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, { type: 'triangle', vol: 0.15 })),
};
export function sfx(name) { try { FX[name]?.(); } catch {} }

// ------------------------------------------------------------------
// Ambiente: murmullo de gente + algún gong lejano de vez en cuando
// ------------------------------------------------------------------
function startAmb() {
  const c = ac(); if (!c || amb) return;
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 0.6;
  // El murmullo sube y baja despacio
  const g = c.createGain(); g.gain.value = 0.35;
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 0.13; lg.gain.value = 0.12; lfo.connect(lg); lg.connect(g.gain);
  src.connect(f); f.connect(g); g.connect(ambBus);
  src.start(); lfo.start();
  const far = setInterval(() => {
    if (Math.random() < 0.5 || S.mute) return;
    [523, 659, 784].forEach((fq, i) => tone(fq, i * 0.32, 1.2, { vol: 0.05, bus: ambBus }));
  }, 45000);
  amb = { src, lfo, far };
}
function stopAmb() {
  if (!amb) return;
  try { amb.src.stop(); amb.lfo.stop(); } catch {}
  clearInterval(amb.far);
  amb = null;
}
export function ambience(on) {
  ambWanted = on;
  if (!on) { stopAmb(); return; }
  if (ctx) startAmb();
}

// Clic suave en todos los botones
document.addEventListener('click', (e) => { if (e.target.closest?.('.btn, .homeCard, button')) sfx('click'); }, { capture: true });

// ------------------------------------------------------------------
// Voces de los anuncios (síntesis de voz del navegador): gong + castellano + inglés
// ------------------------------------------------------------------
const synth = window.speechSynthesis || null;
let VOICES = [];
const loadVoices = () => { VOICES = synth ? synth.getVoices() : []; };
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }
// Las voces "naturales" / en línea suenan mucho mejor que las clásicas
const score = (v, pref) => (pref.indexOf(v.lang) >= 0 ? 40 - pref.indexOf(v.lang) * 4 : v.lang.slice(0, 2) === pref[0].slice(0, 2) ? 10 : -99)
  + (/natural|online|neural/i.test(v.name) ? 20 : 0) + (/google/i.test(v.name) ? 8 : 0);
const PREF = { es: ['es-AR', 'es-419', 'es-US', 'es-MX', 'es-CL', 'es-UY', 'es-ES'], en: ['en-US', 'en-GB', 'en-AU', 'en-CA'] };
export function voicesFor(lang) {
  if (!VOICES.length) loadVoices();
  return VOICES.filter((v) => v.lang.slice(0, 2) === lang).sort((a, b) => score(b, PREF[lang]) - score(a, PREF[lang]));
}
// El navegador no dice si una voz es de hombre o de mujer: se deduce por el nombre
const FEM = /female|mujer|helena|laura|elena|sabina|paloma|dalia|elvira|irene|luc[ií]a|m[oó]nica|paulina|valentina|camila|salom[eé]|ximena|abril|larissa|estrella|triana|vera|tania|catalina|renata|beatriz|andrea|marisol|zira|aria|jenny|michelle|emma|ava|jessa|sonia|libby|hazel|susan|linda|samantha|victoria|karen|moira|tessa|fiona|serena|allison|nora|joanna|clara|natasha|sara|google español|google us english/i;
const MASC = /male|hombre|pablo|ra[uú]l|jorge|tom[aá]s|[aá]lvaro|gerardo|gonzalo|lorenzo|emilio|federico|diego|rodrigo|alonso|arnau|dar[ií]o|el[ií]as|esteban|sa[uú]l|teo|mateo|liam|alex|andrew|brian|christopher|eric|guy|roger|steffan|ryan|thomas|george|david|mark|daniel|fred|aaron|arthur|oliver|guillermo|carlos|juan/i;
export const voiceGender = (v) => (MASC.test(v.name) && !/female/i.test(v.name) ? 'M' : FEM.test(v.name) ? 'F' : null);
const playerGender = () => { try { return localStorage.getItem('ckGender') || null; } catch { return null; } };
// who: 'agent' = la voz sos vos (anuncios de la puerta): tu género, o la voz elegida en Configuración.
//      'airport' = otra persona (la empresa, la PSA): la voz del otro género, para que se note.
const pickVoice = (lang, who = 'agent') => {
  const list = voicesFor(lang);
  const chosen = S[lang === 'es' ? 'voiceEs' : 'voiceEn'];
  if (who === 'agent' && chosen) { const v = list.find((x) => x.name === chosen); if (v) return v; }
  const pg = playerGender();
  const want = pg ? (who === 'agent' ? pg : pg === 'F' ? 'M' : 'F') : null;
  return (want && list.find((v) => voiceGender(v) === want)) || list[0] || null;
};
export const canSpeak = () => !!synth;

// Texto para leer en voz alta: "AP1250" → "A P 1250", sin etiquetas ni emojis
function forSpeech(t) {
  return String(t)
    .replace(/<[^>]+>/g, '')
    .replace(/\b([A-Z]{2})(\d{2,4})\b/g, (m, a, n) => `${a.split('').join(' ')} ${n}`)
    .replace(/\bPSA\b/g, 'P S A')
    .replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '');
}
function say(text, lang, who = 'agent') {
  return new Promise((res) => {
    const u = new SpeechSynthesisUtterance(forSpeech(text));
    const v = pickVoice(lang, who);
    if (v) u.voice = v;
    u.lang = v?.lang || (lang === 'es' ? 'es-AR' : 'en-US');
    u.rate = S.rate * (lang === 'es' ? 1 : 0.95);
    u.pitch = 1;
    u.volume = Math.min(1, S.master * S.voice);
    u.onend = u.onerror = () => res();
    synth.speak(u);
    setTimeout(res, 30000); // por si el navegador nunca avisa el final
  });
}
let annSeq = 0;
// Anuncio por altoparlante: corta el anterior, suena el gong y después la voz
export async function announce(es, en = null, who = 'agent') {
  sfx('pa');
  if (!synth || S.mute || !S.voices) return;
  const my = ++annSeq;
  synth.cancel();
  await new Promise((r) => setTimeout(r, 1300));
  if (my !== annSeq) return;
  await say(es, 'es', who);
  if (en && S.english && my === annSeq) { await new Promise((r) => setTimeout(r, 350)); if (my === annSeq) await say(en, 'en', who); }
}
export function stopVoices() { annSeq++; synth?.cancel(); }
// Una frase dicha en vivo (sin gong): por ejemplo, la PSA ordenando desalojar
export function voiceLine(text, lang = 'es', who = 'airport') {
  if (!synth || S.mute || !S.voices) return;
  annSeq++;
  synth.cancel();
  say(text, lang, who);
}
window.addEventListener('pagehide', () => synth?.cancel());
// Para Configuración: qué voz usa "Automática" (la de tu género, si hay)
export function autoVoiceName(lang) {
  const pg = playerGender(), list = voicesFor(lang);
  return ((pg && list.find((v) => voiceGender(v) === pg)) || list[0])?.name || '';
}
