// MANUAL COMO LIBRITO: tapa, índice y un capítulo por página. Las hojas se dan vuelta en 3D
// (doble página en pantallas anchas, una sola en el celular). Recuerda la última página leída.
import { esc } from './util.js';

const $ = (s) => document.querySelector(s);
const FLIP_MS = 650;

// opts: { id, title, subtitle, chapters: [{ icon, title, html }], openModal, closeModal, onClose }
export function openBook(opts) {
  const { id, title, subtitle, chapters, openModal, closeModal, onClose } = opts;
  // Páginas: 0 = tapa, 1 = índice, 2.. = capítulos (y una contratapa si hace falta para cerrar la doble página)
  const pages = [
    { cover: true },
    { index: true },
    ...chapters.map((c, i) => ({ ...c, n: i + 1 })),
  ];
  if (pages.length % 2) pages.push({ back: true });
  const single = () => window.matchMedia('(max-width: 760px)').matches;
  const key = `ckBook-${id}`;
  let cur = 0; // índice de la página de la izquierda (doble) o de la única página (simple)
  try { cur = Math.max(0, Math.min(pages.length - 1, +localStorage.getItem(key) || 0)); } catch {}
  let busy = false;

  const pageHTML = (i) => {
    const p = pages[i];
    if (!p) return '<div class="pgIn blankPg"></div>';
    if (p.cover) return `<div class="pgIn coverPg">
        <img src="assets/logo-512.png" alt="" class="bookLogo" />
        <h1>${esc(title)}</h1>
        <p>${esc(subtitle || '')}</p>
        <small>Tocá la página o usá las flechas para hojear →</small>
      </div>`;
    if (p.back) return '<div class="pgIn backPg"><i class="mdi mdi-airplane-takeoff"></i><p>¡Buen turno!</p></div>';
    if (p.index) return `<div class="pgIn">
        <h2 class="pgTitle"><i class="mdi mdi-format-list-bulleted"></i> Índice</h2>
        <ol class="toc">${chapters.map((c, k) => `<li><button data-go="${k + 2}"><i class="mdi mdi-${c.icon}"></i><span>${esc(c.title)}</span><em>${k + 3}</em></button></li>`).join('')}</ol>
        <div class="pgNum">2</div>
      </div>`;
    return `<div class="pgIn">
        <h2 class="pgTitle"><i class="mdi mdi-${p.icon}"></i> ${esc(p.title)}</h2>
        <div class="pgBody">${p.html}</div>
        <div class="pgNum">${i + 1}</div>
      </div>`;
  };

  openModal(`<div class="book ${single() ? 'single' : ''}">
      <div class="spread" id="bkSpread">
        <div class="page left" id="bkL"></div>
        <div class="page right" id="bkR"></div>
        <div class="leaf hidden" id="bkLeaf"><div class="face front"></div><div class="face back"></div></div>
      </div>
      <div class="bookNav">
        <button class="btn sm ghost" id="bkPrev" title="Página anterior (←)"><i class="mdi mdi-chevron-left"></i></button>
        <button class="btn sm ghost" id="bkIdx" title="Ir al índice"><i class="mdi mdi-format-list-bulleted"></i> Índice</button>
        <span id="bkInfo"></span>
        <button class="btn sm ghost" id="bkNext" title="Página siguiente (→)"><i class="mdi mdi-chevron-right"></i></button>
        <button class="btn sm ok" id="bkClose"><i class="mdi mdi-check-bold"></i> Entendido</button>
      </div>
    </div>`, 'bookBox');

  const step = () => (single() ? 1 : 2);
  const norm = (i) => (single() ? i : i - (i % 2));
  cur = norm(cur);

  function render() {
    $('.book').classList.toggle('single', single());
    $('#bkL').innerHTML = pageHTML(cur);
    $('#bkR').innerHTML = single() ? '' : pageHTML(cur + 1);
    const last = single() ? cur + 1 : Math.min(cur + 2, pages.length);
    $('#bkInfo').textContent = single() ? `Página ${cur + 1} de ${pages.length}` : `Páginas ${cur + 1}–${last} de ${pages.length}`;
    $('#bkPrev').disabled = cur <= 0;
    $('#bkNext').disabled = cur + step() >= pages.length;
    document.querySelectorAll('#bkSpread [data-go]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); go(+b.dataset.go); }; });
    try { localStorage.setItem(key, String(cur)); } catch {}
  }

  // Ir a una página (desde el índice): sin animación larga, con un pequeño "hojeo"
  function go(i) {
    const t = norm(i);
    if (t === cur || busy) return;
    flip(t > cur ? 1 : -1, t);
  }

  function flip(dir, target) {
    if (busy) return;
    const to = target ?? cur + dir * step();
    if (to < 0 || to >= pages.length) return;
    busy = true;
    const leaf = $('#bkLeaf');
    const [front, back] = leaf.children;
    if (single()) {
      // Una sola página: hacia adelante la hoja actual se levanta y deja ver la siguiente;
      // hacia atrás, la anterior vuelve a caer sobre la actual
      back.innerHTML = '';
      if (dir > 0) { front.innerHTML = pageHTML(cur); $('#bkL').innerHTML = pageHTML(to); }
      else front.innerHTML = pageHTML(to);
      leaf.className = `leaf single ${dir > 0 ? 'fwd' : 'bwd'}`;
    } else if (dir > 0) {
      // Doble página hacia adelante: la hoja derecha gira sobre el lomo hacia la izquierda
      front.innerHTML = pageHTML(cur + 1);
      back.innerHTML = pageHTML(to);
      $('#bkR').innerHTML = pageHTML(to + 1);
      leaf.className = 'leaf fwd';
    } else {
      // Hacia atrás: la hoja izquierda gira hacia la derecha
      front.innerHTML = pageHTML(cur);
      back.innerHTML = pageHTML(to + 1);
      $('#bkL').innerHTML = pageHTML(to);
      leaf.className = 'leaf bwd';
    }
    // Forzar el estado inicial antes de animar
    void leaf.offsetWidth;
    leaf.classList.add('go');
    setTimeout(() => {
      cur = to;
      leaf.className = 'leaf hidden';
      busy = false;
      render();
    }, FLIP_MS);
  }

  const close = () => {
    document.removeEventListener('keydown', onKey);
    closeModal();
    onClose?.();
  };
  const onKey = (e) => {
    if (!$('.book')) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'ArrowRight') flip(1);
    if (e.key === 'ArrowLeft') flip(-1);
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  $('#bkPrev').onclick = () => flip(-1);
  $('#bkNext').onclick = () => flip(1);
  $('#bkIdx').onclick = () => go(1);
  $('#bkClose').onclick = close;
  // Tocar la página: la derecha avanza, la izquierda retrocede (en simple, mitad derecha/izquierda)
  $('#bkSpread').addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, select')) return;
    const r = $('#bkSpread').getBoundingClientRect();
    flip(e.clientX > r.left + r.width / 2 ? 1 : -1);
  });
  render();
}
