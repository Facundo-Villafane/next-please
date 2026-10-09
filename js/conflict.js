// PASAJERO DIFÍCIL / INSUBORDINADO (Guía U4 · Parte IV, Seguridad · categorías CAT 1, 2 y 3).
// Un diálogo por rondas: el agente elige cómo responder y al final categoriza la conducta.
import { faceSVG } from './docs.js';
import { esc } from './util.js';
import { gtxt, playerFace } from './player.js';

const $ = (s) => document.querySelector(s);

// Supervisora (misma que en el Modo Historia)
import { SUP } from './supervisor.js';
export const MARTA = SUP.face;

export const CONFLICT_SCENARIOS = { vip_angry: 1, angry_cat2: 2, bomb_joke: 3, gate_carryon: 1, gate_smoker: 2, gate_rage: 3 };

const CATS = [
  { k: 0, label: 'Pasajero exigente, sin categoría' },
  { k: 1, label: 'CAT 1 · Disruptivo: lo resuelve el agente' },
  { k: 2, label: 'CAT 2 · Requiere supervisor o seguridad' },
  { k: 3, label: 'CAT 3 · Pone en peligro a otros / amenazas' },
];
const CAT_WHY = {
  1: 'CAT 1: tono agresivo o insultos menores, pero finalmente acata la instrucción. Lo resuelve el mismo agente, sin supervisor ni seguridad. El pasajero viaja.',
  smoker: 'CAT 2: fumador que no desiste en el embarque (camino a la aeronave). No acata las instrucciones: supervisor o seguridad, y no embarca.',
  rage: 'CAT 3: arrojó un objeto y dañó elementos de la compañía (acción violenta). Se resguarda a los demás pasajeros, interviene la PSA y no embarca.',
  2: 'CAT 2: actitud desafiante, no acata las instrucciones y afecta el buen orden del check-in. Requiere apoyo del supervisor de aeropuerto o de seguridad para contenerlo. No se acepta.',
  3: 'CAT 3: amenaza contra la seguridad de la operación (insinuar que lleva una bomba o un explosivo), aunque diga que es un chiste. Se interrumpe la atención, no se manipula el equipaje y se da aviso a la PSA. No se acepta.',
};

// Guiones: cada ronda tiene la línea del pasajero y las respuestas posibles del agente
const SCRIPTS = {
  vip_angry: {
    trigger: ['docs'],
    title: '😎 "¿Sabe quién soy yo?"',
    steps: [
      {
        pax: (p) => `¿Vos sabés quién soy yo? ${p.first} ${p.last}, socio Platinum, primo del intendente y con 80 mil seguidores. No pienso pagar exceso y quiero Business, obvio. Y apurate, que no me gusta esperar.`,
        opts: [
          { t: 'Buenas noches, señor. Con gusto lo atiendo: le explico qué puedo hacer y qué no, así lo resolvemos rápido.', ok: true, pts: 10, note: 'Empatía y cortesía sin ceder: baja la tensión desde el primer momento.', react: 'Mmm... bueno. Al menos alguien educado en este aeropuerto.' },
          { t: 'No me importa quién sea: acá todos son iguales.', ok: false, pts: -5, note: 'La idea es correcta (mismas reglas para todos), pero el tono desafiante escala el conflicto.', react: '¿Me estás hablando así a mí? ¡Quiero tu nombre y apellido!' },
          { t: '¡Por supuesto, señor! Le hago el upgrade y no le cobro el exceso.', ok: false, pts: -15, gaveIn: true, note: 'Ceder a la presión rompe las reglas de la tarifa y es injusto con el resto de los pasajeros. Además, "premia" el maltrato.', react: '¡Así me gusta! ¿Ves que cuando querés, podés?' },
          { t: 'Aguarde, que llamo a mi supervisora.', ok: false, pts: -5, sup: true, note: 'Todavía es un pasajero exigente que se puede manejar: llamar al supervisor tan rápido le quita autoridad al agente.', react: '¡Eso! ¡Que venga alguien que sepa!', marta: '¿Para esto me sacaste de la oficina? Es un pasajero exigente, no un incendio: firmeza y cortesía, lo resolvés vos. Y la próxima, pensalo dos veces.' },
        ],
      },
      {
        pax: () => '¿Y el Business? ¿Y el exceso? Mirá que publico todo en mis redes, eh. Una story mía y esta aerolínea se funde.',
        opts: [
          { t: 'El upgrade lo puede comprar en Ventas si hay disponibilidad. El equipaje va según su tarifa, como para todos. Si quiere, le detallo el cálculo.', ok: true, pts: 10, note: 'Firmeza con explicación y una alternativa concreta (Ventas): el pasajero entiende el "no" y tiene un camino.', react: 'Bueno, dale... pero que conste que me quejo. (guarda el celular)' },
          { t: 'Publique lo que quiera, a mí no me cambia nada.', ok: false, pts: -10, note: 'Provocar al pasajero no resuelve nada y expone a la compañía.', react: '¡Ah, mirá vos! Ya estoy grabando. Sonreí para mis seguidores.' },
          { t: 'Bueno... por esta vez no le cobro el exceso.', ok: false, pts: -15, gaveIn: true, note: 'Ceder ante la amenaza de "escrachar" a la compañía: la próxima vez lo va a volver a hacer.', react: '¡Gracias, genia! Te nombro en la story.' },
        ],
      },
    ],
    cat: 1,
    end: { ok: 'Se calmó y acató: seguí con el check-in normal (y si tiene exceso, se cobra).', bad: 'Seguí con el check-in normal: el pasajero viaja.' },
  },
  angry_cat2: {
    trigger: ['docs'],
    title: '😡 Pasajero furioso',
    steps: [
      {
        pax: () => '(golpea el mostrador) ¡Cuarenta minutos de fila! ¡La aplicación de ustedes es una porquería! ¡Atendeme YA!',
        opts: [
          { t: 'Lamento mucho la espera, tiene razón en estar molesto. Ya mismo lo atiendo.', ok: true, pts: 10, note: 'Primero se intenta bajar la tensión: reconocer la molestia y ofrecer solución.', react: '¡No me lamentes nada! ¡Hacé tu trabajo, que para eso te pagan!' },
          { t: 'Si me grita, no lo atiendo.', ok: false, pts: -5, note: 'Un ultimátum de entrada escala el conflicto. Primero se intenta calmar.', react: '¿¡Qué!? ¿Y quién te creés que sos?' },
          { t: 'Llamo a Seguridad ya mismo.', ok: false, pts: -3, note: 'Todavía no se intentó calmarlo. Primero diálogo; si no acata, apoyo.', react: '¡Llamá a quien quieras! ¡No me das miedo!' },
        ],
      },
      {
        pax: () => '(tira el documento sobre el mostrador) ¡No me pidas nada! ¡Bajá la voz vos! ¡Los voy a denunciar a todos, inútiles!',
        opts: [
          { t: 'Señor, le pido por favor que baje la voz y me deje atenderlo. Si no, voy a tener que pedir apoyo.', ok: true, pts: 10, note: 'Instrucción clara, con respeto, y aviso de la consecuencia.', react: '(grita más fuerte) ¡A MÍ NO ME VAS A DECIR CÓMO HABLAR!' },
          { t: '(Sigo con el check-in como si nada.)', ok: false, pts: -10, note: 'Ignorar los insultos y los gritos no corta la escalada: hay que marcar el límite.', react: '(empuja el poste separador de la fila) ¿¡Me estás ignorando!?' },
          { t: '¡Inútil será usted! ¡A mí no me grita!', ok: false, pts: -15, note: 'Responder con agresión nunca: el agente representa a la compañía y tiene que mantener la calma.', react: '¡¿QUÉ ME DIJISTE?! (se abalanza sobre el mostrador)' },
        ],
      },
      {
        pax: () => '(empuja el poste de la fila y sigue gritando. Los demás pasajeros se alejan; una nena se pone a llorar)',
        opts: [
          { t: 'Pido apoyo al supervisor de aeropuerto y a Seguridad (PSA).', ok: true, pts: 15, sup: true, note: 'No acata instrucciones y es desafiante: ya no lo puede resolver el agente solo.', react: '¡Que vengan! ¡Que vengan todos!', marta: 'Señor, acompáñeme, por favor. En estas condiciones hoy no puede viajar. (a vos) Bien, esta vez llamaste cuando correspondía: no acata, no se acepta. Ahora rechazá el check-in en el sistema. Ya.' },
          { t: 'Sigo intentando calmarlo yo.', ok: false, pts: -10, note: 'Ya se intentó: si no acata y sigue escalando, el agente no tiene que manejarlo solo.', react: '(patea la balanza) ¡NO ME CALMO NADA!' },
          { t: 'Lo chequeo rápido para que se vaya.', ok: false, pts: -20, note: 'Aceptar a un pasajero que no acata instrucciones traslada el problema al avión, donde es mucho más peligroso.', react: '¡Eso! ¡Viste que gritando se consigue todo!' },
        ],
      },
    ],
    cat: 2,
    end: { ok: 'Resolución: no se acepta. Indicá "No aceptar" con el motivo "Pasajero insubordinado".', bad: 'Resolución: este pasajero no puede ser aceptado. Indicá "No aceptar" con el motivo "Pasajero insubordinado".' },
  },
  bomb_joke: {
    trigger: ['security', 'bags'],
    title: '💣 "Es un chiste, che"',
    steps: [
      {
        pax: () => '¿Si llevo algo peligroso? ¡Sí, una bomba! ¡Jajaja! Es un chiste, che, no pongas esa cara.',
        opts: [
          { t: 'Interrumpo la atención, no toco la valija y doy aviso inmediato a la PSA y al supervisor.', ok: true, pts: 20, sup: true, note: 'Cualquier mención de una bomba o un explosivo se toma en serio, aunque sea "en chiste": se corta la atención y se avisa a la PSA.', react: '¿En serio? ¿Por un chiste?' },
          { t: 'Le pido que no haga esos chistes y sigo con el check-in.', ok: false, pts: -10, note: 'No alcanza con un reto: una amenaza contra la seguridad de la operación se informa siempre.', react: 'Ay, qué amargos que son... bueno, sigamos.' },
          { t: '¡Jaja, buenísimo! A ver, la valija a la balanza.', ok: false, pts: -20, note: 'Nunca minimizar una amenaza de bomba ni manipular el equipaje.', react: '¡Al fin alguien con humor en este aeropuerto!' },
        ],
      },
      {
        pax: () => '¡Pero era un chiste! ¡No exageren! ¿Me van a hacer perder el vuelo por un chiste? ¡Si en la valija tengo alfajores!',
        opts: [
          { t: 'Lo entiendo, pero cualquier mención de un explosivo se toma en serio. Seguridad va a evaluar la situación: aguarde acá, por favor.', ok: true, pts: 10, note: 'Calma y firmeza: se explica el porqué sin discutir y se espera a la PSA.', react: '(se sienta, resignado) Mi señora me va a matar...' },
          { t: 'Bueno, si era un chiste, sigamos con el check-in.', ok: false, pts: -15, note: 'Una vez dicho, ya no hay vuelta atrás: decide la PSA, no el agente.', react: '¡Eso! ¡Viste que no era para tanto!' },
        ],
      },
    ],
    cat: 3,
    end: { ok: 'Resolución: la PSA inspecciona el equipaje y el pasajero no viaja. Indicá "No aceptar" con el motivo "Pasajero insubordinado".', bad: 'Resolución: la PSA toma intervención y el pasajero no viaja. Indicá "No aceptar" con el motivo "Pasajero insubordinado".' },
  },
};

// ---------------------------- Puerta de embarque ----------------------------
SCRIPTS.gate_carryon = {
  trigger: ['carry', 'docs'],
  title: '🧳 "¡Mi valija no va a bodega!"',
  steps: [
    {
      pax: () => '¿Gate Dispatch? ¡Ni loca! Mi valija va arriba conmigo, como siempre. Adentro tengo la notebook, los remedios y la planchita de pelo.',
      opts: [
        { t: 'Entiendo que le preocupe. Le propongo: saque la notebook y los remedios, y la valija va con etiqueta Gate Dispatch; se la entregan en la puerta del avión al llegar.', ok: true, pts: 10, note: 'Empatía y solución concreta: los objetos de valor y los remedios van con el pasajero; la valija, en bodega.', react: 'Mmm... ¿y si me la rompen? ¡Es nueva!' },
        { t: 'Son las reglas: va a bodega y punto.', ok: false, pts: -5, note: 'La regla es correcta, pero sin explicar el porqué ni ofrecer opciones, el pasajero se cierra.', react: '¡Qué mala onda! ¡No la suelto!' },
        { t: 'Bueno, súbala igual, ya verá la tripulación dónde entra.', ok: false, pts: -15, gaveIn: true, note: 'Con los compartimientos llenos, una valija de más termina en el pasillo o en una salida: es un problema de seguridad y demora la salida.', react: '¡Gracias! Sabía que eras de los buenos.' },
      ],
    },
    {
      pax: () => '¿Y si me la rompen? ¿Y si me la pierden? ¡Es nueva, me la regaló mi suegra!',
      opts: [
        { t: 'Va etiquetada a su nombre y se la entregan al bajar, en la puerta del avión. Si llegara con un daño, se reclama en el aeropuerto de destino.', ok: true, pts: 10, note: 'Información clara sobre el proceso y el reclamo: el pasajero acepta.', react: 'Bueno, dale... saco la notebook. Pero si se rompe, la llamo a mi suegra para que te reclame ella.' },
        { t: 'Eso no es problema mío.', ok: false, pts: -10, note: 'Desentenderse de la preocupación del pasajero escala la situación.', react: '¿Ah, no? ¡Entonces de quién! (abraza la valija)' },
      ],
    },
  ],
  cat: 1,
  end: { ok: 'Acató. Colocá la etiqueta 🏷 Gate Dispatch y embarcalo.', bad: 'El pasajero viaja: colocá la etiqueta 🏷 Gate Dispatch y embarcalo.' },
};
SCRIPTS.gate_smoker = {
  trigger: ['docs', 'vape'],
  title: '🚬 Fumando en el embarque',
  steps: [
    {
      pax: () => '(echa humo a medio metro del podio) ¿Qué pasa? Es el último antes de doce horas de vuelo. Dejame terminarlo.',
      opts: [
        { t: 'Le pido que lo apague ahora, por favor: en la sala y en el embarque no se puede fumar.', ok: true, pts: 10, note: 'Instrucción clara y respetuosa: primero se le pide que desista.', react: 'Ya va, ya va... dos pitadas más.' },
        { t: 'Bueno, termínelo rápido y embarca.', ok: false, pts: -15, gaveIn: true, note: 'Fumar en la sala o camino a la aeronave está prohibido: no se negocia.', react: '¡Así me gusta! (enciende otro)' },
        { t: 'Llamo a Seguridad.', ok: false, pts: -3, note: 'Primero se le da la instrucción: si desiste, es CAT 1 y lo resuelve el agente.', react: '¡Llamá a quien quieras!' },
      ],
    },
    {
      pax: () => '(sigue fumando y le tira el humo en la cara) ¿Y qué me vas a hacer? ¿Me vas a dejar abajo por un pucho?',
      opts: [
        { t: 'Si no lo apaga, no puede embarcar. Es la última vez que se lo pido.', ok: true, pts: 10, note: 'Límite claro con la consecuencia: el pasajero tiene la última oportunidad de acatar.', react: '(da otra pitada, desafiante) No.' },
        { t: '(Lo ignoro y escaneo su tarjeta.)', ok: false, pts: -15, note: 'Ignorarlo es permitir que siga fumando en el embarque.', react: '(camina hacia la manga, fumando)' },
      ],
    },
    {
      pax: () => '(camina hacia la manga con el cigarrillo encendido)',
      opts: [
        { t: 'Lo detengo y pido apoyo al supervisor y a Seguridad.', ok: true, pts: 15, sup: true, note: 'Fumador que no desiste camino a la aeronave: requiere supervisor o seguridad.', react: '¡Esto es un abuso! ¡Por un pucho!', marta: 'Señor, así no viaja. (a vos) Bien: un fumador que no desiste en el embarque es CAT 2. Ahora "No embarcar" con aviso. Y abrí una ventana, que ya me duele la cabeza.' },
        { t: 'Le aviso a la tripulación para que lo controlen a bordo.', ok: false, pts: -20, note: 'Si no acata en tierra, en el avión es peor: el problema no se traslada a bordo.', react: '(entra a la manga, todavía fumando)' },
      ],
    },
  ],
  cat: 'smoker',
  end: { ok: 'Resolución: no embarca. Indicá ✖ No embarcar, motivo "Pasajero insubordinado", con aviso al supervisor / PSA.', bad: 'Resolución: no puede embarcar. Indicá ✖ No embarcar, motivo "Pasajero insubordinado", con aviso al supervisor / PSA.' },
};
SCRIPTS.gate_rage = {
  trigger: ['docs'],
  title: '💥 "¡Esto es una estafa!"',
  steps: [
    {
      pax: () => '¡¿Cómo que me separaron de mi señora?! ¡Pagamos los asientos juntos y el sistema nos mandó a filas distintas!',
      opts: [
        { t: 'Lamento la situación. Déjeme revisar: si hay dos asientos juntos libres, se los asigno; si no, le pido a la tripulación que gestione un cambio a bordo.', ok: true, pts: 10, note: 'Empatía y una solución concreta: es lo que corresponde ante un reclamo.', react: '¡No quiero que me revises nada! ¡Quiero MI asiento!' },
        { t: 'El sistema asigna como puede, yo no puedo hacer nada.', ok: false, pts: -10, note: 'Siempre hay algo para ofrecer (reasignar o pedir un cambio a bordo): el "no puedo hacer nada" enciende al pasajero.', react: '¿¡Nada!? ¡Ahora vas a ver!' },
      ],
    },
    {
      pax: () => '(agarra el poste separador y lo revolea contra el cartel de Aeroplata, que se viene abajo) ¡¡ESTO ES UNA ESTAFA!!',
      opts: [
        { t: 'Me alejo, resguardo a los pasajeros y pido intervención inmediata de la PSA y del supervisor.', ok: true, pts: 20, sup: true, note: 'Acción violenta con daños: primero la seguridad de las personas, después la PSA.', react: '(lo rodean dos agentes de la PSA) ¡Suéltenme! ¡Yo pagué!', marta: 'Respirá, ya está la PSA. Esto es CAT 3: no embarca, y punto. Registrá "No embarcar" con aviso. Yo me encargo del informe... como siempre.' },
        { t: 'Le pido que se calme y sigo con el embarque.', ok: false, pts: -15, note: 'Después de arrojar objetos ya no alcanza con pedirle calma: interviene la PSA.', react: '(patea el cartel caído) ¡NO ME CALMO NADA!' },
        { t: 'Lo embarco rápido para que se calme arriba.', ok: false, pts: -25, note: 'Embarcar a un pasajero violento pone en riesgo a la tripulación y al resto del pasaje.', react: '¡Eso! ¡Viste que gritando se consigue todo!' },
      ],
    },
  ],
  cat: 'rage',
  end: { ok: 'Resolución: no embarca. Indicá ✖ No embarcar, motivo "Pasajero insubordinado", con aviso al supervisor / PSA.', bad: 'Resolución: no puede embarcar. Indicá ✖ No embarcar, motivo "Pasajero insubordinado", con aviso al supervisor / PSA.' },
};

// key: escenario del counter o tipo de pasajero de la puerta
export function conflictTrigger(key, k) {
  const s = SCRIPTS[key];
  return s && s.trigger.includes(k) ? s : null;
}

// Abre el conflicto. onDone recibe { items, total, cat, gaveIn }
export function runConflict(p, key, ui, onDone) {
  const s = SCRIPTS[key];
  const catN = typeof s.cat === 'number' ? s.cat : { smoker: 2, rage: 3 }[s.cat];
  const res = { items: [], total: 0, cat: null, gaveIn: false, supEarly: false };
  const log = [];
  let i = 0;
  const box = (body) => {
    ui.openModal(`<div class="conflict">
      <h2>${s.title}</h2>
      <div class="cfLog">${log.join('')}</div>
      ${body}
    </div>`, 'wide');
    const l = $('.cfLog');
    if (l) l.scrollTop = l.scrollHeight;
  };
  const bubble = (who, face, text, cls = '') => `<div class="cfLine ${cls}"><div class="cfFace">${faceSVG(face, { w: 44, h: 55, bg: '#dce7f0' })}</div><div><b>${esc(who)}</b><p>${esc(text)}</p></div></div>`;

  const step = () => {
    const st = s.steps[i];
    const line = st.pax(p);
    log.push(bubble(p.first, p.face, line, 'pax'));
    box(`<p class="hint">¿Cómo respondés?</p><div class="cfOpts">${st.opts.map((o, j) => `<button class="btn cfOpt" data-o="${j}">${esc(o.t)}</button>`).join('')}</div>`);
    document.querySelectorAll('[data-o]').forEach((b) => {
      b.onclick = () => {
        const o = st.opts[+b.dataset.o];
        res.items.push({ ok: o.ok, title: `${o.ok ? 'Buena respuesta' : 'Respuesta a mejorar'}: "${o.t}"`, detail: o.note, pts: o.pts });
        res.total += o.pts;
        if (o.gaveIn) res.gaveIn = true;
        log.push(bubble('Vos', playerFace(), o.t, 'agent'));
        log.push(`<div class="cfNote ${o.ok ? 'ok' : 'bad'}">${o.ok ? '✔' : '✖'} ${esc(o.note)} <span class="pts">${o.pts > 0 ? '+' : ''}${o.pts}</span></div>`);
        log.push(bubble(p.first, p.face, o.react, 'pax'));
        if (o.marta) log.push(bubble('Viviana (supervisora)', MARTA, gtxt(o.marta), 'marta'));
        i++;
        if (i < s.steps.length) step(); else classify();
      };
    });
  };

  const classify = () => {
    box(`<h3>¿Cómo categorizás la conducta de ${esc(p.first)}?</h3><div class="cfOpts">${CATS.map((c) => `<button class="btn cfOpt" data-c="${c.k}">${esc(c.label)}</button>`).join('')}</div>`);
    document.querySelectorAll('[data-c]').forEach((b) => {
      b.onclick = () => {
        const c = +b.dataset.c;
        res.cat = c;
        const ok = c === catN;
        const pts = ok ? 10 : -10;
        res.items.push({ ok, title: ok ? `Categorizó bien la conducta (CAT ${catN})` : `Categoría incorrecta: correspondía CAT ${catN}`, detail: CAT_WHY[s.cat], pts });
        res.total += pts;
        summary(ok);
      };
    });
  };

  const summary = (catOk) => {
    const good = res.total > 0;
    box(`<div class="cfSum ${good ? 'ok' : 'bad'}"><b>${catOk ? '✔' : '✖'} ${esc(CAT_WHY[s.cat])}</b><span class="pts">${res.total > 0 ? '+' : ''}${res.total}</span></div>
      <p class="hint">${esc(good ? s.end.ok : s.end.bad)}</p>
      <div class="row end"><button class="btn ok" id="cfDone">Continuar ▶</button></div>`);
    $('#cfDone').onclick = () => { ui.closeModal(); onDone(res); };
  };

  step();
}
