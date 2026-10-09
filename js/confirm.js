// Ventana de confirmación con el estilo del juego (reemplaza al window.confirm del navegador).
// Va por encima de cualquier otra ventana abierta. Devuelve una promesa: true = confirmó.
import { esc } from './util.js';

export function askConfirm({ title = '¿Confirmás?', text = '', ok = 'Confirmar', cancel = 'Cancelar', icon = 'help-circle', tone = 'warn' } = {}) {
  return new Promise((resolve) => {
    document.querySelector('#cfm')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div id="cfm" class="cfm">
        <div class="cfmBox" role="dialog" aria-modal="true">
          <div class="cfmHead"><i class="mdi mdi-airplane"></i> ${esc(title)}</div>
          <div class="cfmBody"><span class="cfmIco ${tone}"><i class="mdi mdi-${icon}"></i></span><p>${esc(text)}</p></div>
          <div class="cfmBtns"><button class="btn ghost" id="cfmNo">${esc(cancel)}</button><button class="btn ${tone === 'bad' ? 'bad' : 'warn'}" id="cfmYes">${esc(ok)}</button></div>
        </div>
      </div>`);
    const el = document.querySelector('#cfm');
    const done = (v) => { document.removeEventListener('keydown', onKey, true); el.remove(); resolve(v); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); done(true); }
    };
    document.addEventListener('keydown', onKey, true);
    el.querySelector('#cfmNo').onclick = () => done(false);
    el.querySelector('#cfmYes').onclick = () => done(true);
    el.onclick = (e) => { if (e.target === el) done(false); };
    el.querySelector('#cfmYes').focus();
  });
}
