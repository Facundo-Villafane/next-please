// Compartir el resultado como imagen: una tarjeta cuadrada (1080 × 1080) con el logo, el agente,
// el modo y los números. En el celu abre el menú de compartir; en la compu se descarga la imagen.
import { faceSVG } from './docs.js';
import { getPlayer, playerFace } from './player.js';

const SITE = 'facundo-villafane.github.io/next-please';
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const svgImg = (svg) => loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fit(g, text, max, size, font) {
  let s = size;
  do { g.font = `${font} ${s}px ${font.includes('800') ? 'Nunito' : 'Fredoka'}, sans-serif`; s -= 2; } while (g.measureText(text).width > max && s > 20);
}
// Texto en varias líneas (como mucho maxLines; si no entra, termina en «…»)
function wrap(g, text, x, y, max, lh, maxLines = 99) {
  const words = String(text).split(' ');
  let line = '', n = 1;
  for (let i = 0; i < words.length; i++) {
    const t = line ? `${line} ${words[i]}` : words[i];
    if (g.measureText(t).width > max && line) {
      if (n === maxLines) { while (g.measureText(`${line}…”`).width > max) line = line.slice(0, -1); g.fillText(`${line.trim()}…”`, x, y); return y; }
      g.fillText(line, x, y); line = words[i]; y += lh; n++;
    } else line = t;
  }
  if (line) g.fillText(line, x, y);
  return y;
}

// o = { title, subtitle, stats: [[etiqueta, valor], …] (hasta 4), stars (0–3, opcional), line (frase opcional) }
export async function resultCard(o) {
  await Promise.all([document.fonts.load('600 60px Fredoka'), document.fonts.load('800 30px Nunito')]).catch(() => {});
  const W = 1080, c = document.createElement('canvas');
  c.width = W; c.height = W;
  const g = c.getContext('2d');
  // Fondo: azul de la marca con un avión grande de fondo y la franja amarilla abajo
  const bg = g.createRadialGradient(W * 0.75, W * 0.2, 60, W * 0.5, W * 0.5, W * 0.9);
  bg.addColorStop(0, '#2f6fd1'); bg.addColorStop(0.5, '#1a4a96'); bg.addColorStop(1, '#0e2c62');
  g.fillStyle = bg; g.fillRect(0, 0, W, W);
  g.fillStyle = 'rgba(255,255,255,.06)';
  g.font = '520px "Material Design Icons"';
  try { g.save(); g.translate(W * 0.78, W * 0.36); g.rotate(-0.35); g.fillText('\u{F001D}', -260, 200); g.restore(); } catch {}
  g.fillStyle = '#ffc72c'; g.fillRect(0, W - 26, W, 26);
  g.fillStyle = '#0e2c62'; g.fillRect(0, W - 34, W, 8);
  // Logo
  try { const logo = await loadImg('assets/logo-512.png'); g.drawImage(logo, W / 2 - 150, 24, 300, 300 * logo.height / logo.width); } catch {}
  // Tarjeta clara
  const top = 296, H = 684;
  g.fillStyle = '#0e2c62'; rr(g, 60, top + 10, W - 120, H, 40); g.fill();
  g.fillStyle = '#fffaf0'; rr(g, 60, top, W - 120, H, 40); g.fill();
  // Agente
  try { const face = await svgImg(faceSVG(playerFace(), { w: 120, h: 150, bg: '#dce7f0' })); g.save(); rr(g, 100, top + 36, 120, 150, 24); g.clip(); g.drawImage(face, 100, top + 36, 120, 150); g.restore(); } catch {}
  g.fillStyle = '#5c6e88'; g.font = '800 26px Nunito, sans-serif'; g.fillText('AGENTE', 250, top + 78);
  g.fillStyle = '#0e2c62'; fit(g, getPlayer().name || 'Agente', W - 120 - 250 - 40, 52, '600'); g.fillText(getPlayer().name || 'Agente', 250, top + 134);
  // Título del resultado
  g.fillStyle = '#1a4a96'; fit(g, o.title, W - 220, 46, '600'); g.fillText(o.title, 100, top + 240);
  if (o.subtitle) { g.fillStyle = '#5c6e88'; g.font = '800 28px Nunito, sans-serif'; g.fillText(o.subtitle, 100, top + 280); }
  // Estrellas
  let y = top + 306;
  if (o.stars != null) {
    g.font = '64px "Material Design Icons"';
    for (let i = 0; i < 3; i++) { g.fillStyle = i < o.stars ? '#f2a900' : '#d5dce6'; g.fillText('\u{F04CE}', W - 100 - (3 - i) * 72, top + 120); }
  }
  // Números (2 × 2)
  const st = (o.stats || []).slice(0, 4);
  const bw = (W - 220 - 24) / 2, bh = 112;
  st.forEach(([label, val], i) => {
    const bx = 100 + (i % 2) * (bw + 24), by = y + Math.floor(i / 2) * (bh + 18);
    g.fillStyle = '#ffffff'; rr(g, bx, by, bw, bh, 22); g.fill();
    g.strokeStyle = '#c6d3e4'; g.lineWidth = 4; rr(g, bx, by, bw, bh, 22); g.stroke();
    g.fillStyle = '#5c6e88'; g.font = '800 24px Nunito, sans-serif'; g.fillText(String(label).toUpperCase(), bx + 24, by + 40);
    g.fillStyle = '#0e2c62'; fit(g, String(val), bw - 48, 50, '600'); g.fillText(String(val), bx + 24, by + 92);
  });
  y += Math.ceil(st.length / 2) * (bh + 18);
  if (o.line) { g.fillStyle = '#2a3d5c'; g.font = 'italic 800 26px Nunito, sans-serif'; wrap(g, `“${o.line}”`, 100, y + 32, W - 220, 34, 2); }
  // Pie
  g.fillStyle = '#ffffff'; g.font = '600 34px Fredoka, sans-serif';
  const foot = `¿Te animás? ${SITE}`;
  g.fillText(foot, (W - g.measureText(foot).width) / 2, W - 62);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

// Comparte (celu) o descarga (compu) la tarjeta
export async function shareResult(o) {
  const blob = await resultCard(o);
  if (!blob) return 'error';
  const file = new File([blob], 'next-please-resultado.png', { type: 'image/png' });
  const text = `${o.title}${o.subtitle ? ` · ${o.subtitle}` : ''} en Next, please! ¿Te animás? https://${SITE}/`;
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text, title: 'Next, please!' }); return 'shared'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancel'; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'next-please-resultado.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}

// Botón estándar para las pantallas de resultado
export const shareBtnHTML = (id = 'shareRes') => `<button class="btn" id="${id}"><i class="mdi mdi-share-variant"></i> Compartir resultado</button>`;
export function bindShare(id, getData, toast) {
  const b = document.getElementById(id);
  if (!b) return;
  b.onclick = async () => {
    b.disabled = true;
    const r = await shareResult(getData());
    b.disabled = false;
    if (r === 'downloaded') toast?.('<i class="mdi mdi-download"></i> Imagen descargada: compartila donde quieras.');
  };
}
