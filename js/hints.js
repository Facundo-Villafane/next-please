// "Preguntale a Viviana": la supervisora mira lo que estás haciendo y te dice el próximo paso
// del procedimiento (nunca la decisión). Gratis en Aprendizaje; en Desafío cuesta puntos.
import { SUP } from './supervisor.js';
import { faceSVG } from './docs.js';
import { gtxt } from './player.js';
import { pick } from './util.js';

export const HINT_COST = 5;

// Cómo arranca cada respuesta, según cuántas veces le preguntaste en el turno
const OPENERS = [
  ['A ver...', 'Mirá.', 'Te ayudo, pero que no se haga costumbre.'],
  ['¿Otra vez vos?', 'Sí, te escucho. Más o menos.', 'Por el sueldo que tengo, esto debería cobrarlo aparte.'],
  ['¿Ya me extrañabas?', 'Tercera vez. Lo anoto.', 'Tengo cuatro vuelos y un café frío, pero dale.'],
  ['Te voy a hacer un llavero con el manual.', 'Esto ya es una relación.', 'Mirá que no soy tu mamá, eh.'],
];

let count = 0;
export const resetHints = () => { count = 0; };
export const hintCount = () => count;

// Muestra a Viviana con la pista. cost: puntos descontados (0 si es gratis)
export function vivSay(text, cost = 0) {
  const opener = pick(OPENERS[Math.min(count, OPENERS.length - 1)]);
  count++;
  document.querySelector('#viv')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div id="viv" class="viv">
      ${faceSVG(SUP.face, { w: 54, h: 68, bg: '#dce7f0' })}
      <div><b>${SUP.short}</b>${cost ? `<span class="vivCost">−${cost} pts</span>` : ''}<p><i>${gtxt(opener)}</i> ${gtxt(text)}</p></div>
      <button class="x" title="Cerrar">✕</button>
    </div>`);
  const el = document.querySelector('#viv');
  el.querySelector('.x').onclick = () => el.remove();
  clearTimeout(vivSay.t);
  vivSay.t = setTimeout(() => el.remove(), 16000);
}
