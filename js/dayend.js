// FIN DEL DÍA (Modo Historia): qué pasó después con tus pasajeros y repaso de errores.
import { SCENARIOS } from './generator.js';
import { KIND_LABEL } from './boarding.js';
import { esc } from './util.js';
import { EXIT_CONTROL_CODES, EXIT_CONTROL_REASON, exitControl } from './data.js';

const INAD_USD = 4000;
const MINOR_CODES = ['MINOR_AUTH', 'FILIATION', 'PARENT_DEATH', 'GUARDIAN'];
const DECISION = { accept: 'Aceptar', reject: 'No aceptar', derive: 'Derivar', volunteer: 'Voluntario', dnbd: 'DNBD' };
const GATE_DECISION = { board: 'Embarcar', wait: 'Esperar su zona', hold: 'Apartar', deny: 'No embarcar', redirect: 'Otra puerta', volunteer: 'Voluntario', dnbd: 'DNBD' };

const nameOf = (p) => `${p.first} ${p.last}`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ------------------------------------------------------------------
// Novedades del día siguiente: consecuencias (con humor) de tus decisiones
// ------------------------------------------------------------------
export function dayNews(day, ck, gate) {
  const news = [];
  const bal = { fines: 0, avoided: 0, complaints: 0, delay: 0 };
  const add = (tone, icon, from, text) => news.push({ tone, icon, from, text });
  const gateOf = (p) => gate.results.find((g) => g.pax.id === `${p.id}g`);

  ck.results.forEach((r) => {
    const p = r.pax, f = p.flight, nm = nameOf(p), dk = r.decision.kind, exp = r.ev.analysis.expected;
    const codes = r.ev.analysis.blockers.map((b) => b.code);
    const g = gateOf(p);
    const fails = r.ev.items.filter((x) => x.ok === false).map((x) => x.title);

    if (dk === 'accept' && exp === 'reject') {
      const ctlCodes = codes.filter((c) => EXIT_CONTROL_CODES.includes(c));
      if (codes.includes('LEGAL')) {
        bal.delay += 25; bal.complaints++;
        const why = r.ev.analysis.blockers.find((b) => b.code === 'LEGAL').why;
        add('bad', '🚔', `Comandante del ${f.no}`, `Se negó a llevar el traslado de ${nm}: no cumplía las condiciones (${why.split(':')[0].toLowerCase()}). Hubo que bajar al grupo y sus valijas: 25 minutos de demora y un informe a la autoridad.`);
        return;
      }
      if (ctlCodes.length) {
        // Lo frenó el control de salida: nunca llegó a la puerta
        const ctl = exitControl(f), place = ctl === 'PSA' ? 'PSA' : 'Migraciones Ezeiza';
        const onGate = f.no === day.flight;
        const offload = onGate ? 'Te avisaron por radio para bajar su equipaje.' : `El agente de la puerta ${f.gate} tuvo que bajarle el equipaje.`;
        bal.complaints++;
        if (!onGate) bal.delay += 10;
        if (ctlCodes.includes('IDENTITY')) add('bad', '🕵️', place, `Quien se presentó como ${nm} usaba un documento ajeno: quedó a disposición de la PSA. Y la tarjeta de embarque la emitiste vos. ${offload}`);
        else if (ctlCodes.some((c) => MINOR_CODES.includes(c))) add('bad', '🛂', place, `La familia ${p.last} no pudo salir del país: ${EXIT_CONTROL_REASON[ctlCodes[0]]}. Se volvieron a casa con los chicos llorando y un reclamo para Aeroplata. ${offload}`);
        else add('bad', '🛂', place, `${nm} no pasó el control de salida: ${EXIT_CONTROL_REASON[ctlCodes[0]]}. Perdió el vuelo y reclama: "¡En el counter me dijeron que estaba todo bien!". ${offload}`);
        return;
      }
      if (g && g.decision.kind === 'deny') {
        bal.delay += 10;
        add('warn', '🧯', `Puerta ${f.gate}`, `Frenaste a ${nm} en la puerta. Hubo que bajar sus valijas de la bodega: 10 minutos de demora, pero nos salvamos de algo peor. El counter es la primera barrera; la puerta, la última.`);
      } else if (codes.includes('ALCOHOL')) {
        bal.complaints++; bal.delay += 15;
        add('bad', '🍷', `Tripulación del ${f.no}`, `"${nm} pidió cuatro vinos, cantó 'Muchachos' a capela en la fila 20 y quiso abrir la puerta para tomar aire." Lo esperó la policía en ${f.city}. Reporte de pasajero disruptivo.`);
      } else if (codes.includes('RETURN')) {
        bal.fines += INAD_USD;
        add('bad', '⛔', `Migraciones de ${f.city}`, `${nm} llegó solo ida, sin pasaje de regreso ni residencia: lo rechazaron en el aeropuerto (INAD). Vuelve en el próximo vuelo, a cargo de Aeroplata. Multa: USD ${INAD_USD.toLocaleString('es-AR')}. "¡Pero si venía a probar suerte!"`);
      } else if (codes.includes('PREGNANCY')) {
        bal.complaints++;
        add('bad', '🤰', `Tripulación del ${f.no}`, `Hubo que pedir asistencia médica a bordo para ${nm}. Terminó todo bien, pero la compañía asumió un riesgo que no correspondía. Gerencia pide un informe.`);
      }
      return;
    }
    if (dk === 'accept' && exp === 'derive') {
      const t = {
        NO_TICKET: ['🧾', 'Revenue Accounting', `${nm} voló sin boleto emitido. Llegó una nota de débito (ADM) por el valor del pasaje. Contaduría pregunta quién fue.`],
        NAME: ['🪪', 'Auditoría', `${nm} voló con un boleto a nombre de otra persona. Se abrió un reporte de seguridad.`],
        DATE: ['📅', 'Revenue Accounting', `${nm} voló hoy con un boleto de otra fecha. El asiento de su fecha quedó vacío y el de hoy, sin pagar.`],
        UM: ['🧒', `Escala ${f.city}`, `${nm} viajó solo/a sin el servicio UM. Nadie lo/la esperaba al llegar: pasó dos horas comiendo galletitas en nuestra oficina hasta que apareció la tía.`],
        INF_BOOKING: ['👶', 'Ventas', `El bebé de ${nm} voló sin boleto de infante. Hubo que emitirlo de urgencia con el avión en vuelo.`],
        CLOSED: ['⏰', 'Rampa', `Aceptaste a ${nm} con el check-in cerrado: su valija no llegó a la bodega y viajó en el vuelo siguiente.`],
      }[codes.find((c) => ['NO_TICKET', 'NAME', 'DATE', 'UM', 'INF_BOOKING', 'CLOSED'].includes(c))];
      if (t) add('bad', t[0], t[1], t[2]);
      return;
    }
    if ((dk === 'reject' || dk === 'derive') && exp === 'accept') {
      bal.complaints++;
      add('bad', '📱', 'Redes sociales', `⭐☆☆☆☆ "${nm}: Aeroplata me dejó en tierra con todos los papeles en regla. NUNCA MÁS." ${(1200 + Math.floor(Math.random() * 3000)).toLocaleString('es-AR')} me gusta. Atención al Cliente pide explicaciones.`);
      return;
    }
    if (dk === 'reject' && exp === 'derive') {
      add('warn', '☎️', 'Ventas', `"${nm} llegó furioso/a diciendo que lo/la rechazaron. Era un tema del boleto: lo resolvimos en diez minutos. ¡Mandámelos a mí!"`);
      return;
    }
    if (dk === 'derive' && exp === 'reject') {
      add('warn', '☎️', 'Ventas', `"Me mandaste a ${nm}, pero no es un tema de boleto: no puede viajar por documentación. Le tuvimos que explicar todo de nuevo."`);
      return;
    }
    // Decisión correcta: logros y detalles de proceso
    if (dk === 'reject' && codes.includes('IDENTITY')) add('good', '🚓', 'PSA', `El pasajero que frenaste por la foto del pasaporte de ${nm} tenía pedido de captura. Te mandan saludos y un llavero.`);
    if (dk === 'volunteer') add('good', '🏨', `Voluntario del ${f.no}`, `${nm} manda una selfie desde el hotel: "¡El mejor voucher de mi vida! Ojalá vendan de más siempre."`);
    if (p.scenario === 'vip_angry' && r.act.conflict) {
      if (r.act.conflict.gaveIn) add('bad', '💸', 'Contaduría', `Le regalaste beneficios a ${nm}, "el primo del intendente". Dato: el intendente no tiene primos. Ahora todos los Platinum quieren lo mismo.`);
      else if (r.act.conflict.total > 0) add('good', '📸', 'Redes sociales', `${nm} subió una story: "La chica del counter de Aeroplata me atendió re bien... igual me hizo pagar el exceso 😤". 80 mil vistas y comentarios a tu favor.`);
    }
    if (p.legal && p.legal.type !== 'DEPU' && dk === 'accept' && exp === 'accept') add('good', '🚔', p.legal.type === 'DEPA' ? 'Policía Federal' : 'Extranjería', `El traslado de ${nm} a ${f.city} salió sin novedad. ${r.act.seats?.lead && parseInt(r.act.seats.lead, 10) === 30 ? 'Agradecen la ubicación en la última fila, "como corresponde".' : 'Eso sí: comentan que los sentaron lejos de la última fila.'}`);
    if (p.scenario === 'bomb_joke' && dk === 'reject') add('fun', '🐕', 'PSA', `El perro de la PSA revisó la valija de ${nm}: alfajores, medias y un libro de chistes. Labró un acta y no viajó. Dice que nunca más hace chistes.`);
    if (p.scenario === 'angry_cat2' && dk === 'reject') add('good', '🛡️', 'Seguridad', `Gracias por avisar a tiempo con ${nm}. El jefe de cabina del ${f.no} te manda saludos: "mejor en tierra que a 11.000 metros".`);
    (r.act.bags || []).filter((b) => b.manualTag?.wrong).forEach((b) => add('bad', '🧳', `Equipajes de ${f.city}`, `La valija de ${nm} no llegó: el bag tag manual decía ${b.manualTag.dest}. Apareció en la cinta de ${b.manualTag.dest}, dando vueltas sola. El pasajero, en ${f.city}, sin ropa.`));
    if (p.firearm && dk === 'accept' && r.act.firearm) {
      const fa = r.act.firearm;
      if (fa.accept && !p.firearm.accept) add('bad', '🔫', 'PSA', `Revisó el arma de ${nm} en la puerta: ${p.firearm.doc === 'copy' ? 'la credencial era una fotocopia' : 'venía en una funda blanda'}. Labró un acta y el arma quedó en Ezeiza. El pasajero, furioso; el comandante, más.`);
      else if (fa.accept && fa.route !== 'gate') add('bad', '🧳', 'PSA', `La ${p.firearm.label.split(' ')[0].toLowerCase()} de ${nm} pasó por la cinta como una valija cualquiera. Alarma en rayos X, bodega abierta y 20 minutos de demora.`);
      else if (fa.accept) add('good', '🎯', `Pasajero del ${f.no}`, `${nm} recibió su arma en destino sin un rasguño: "¡Qué organizados! La próxima vuelvo a volar con ustedes".`);
    }
    if (p.avih && dk === 'accept' && r.act.avih) {
      const av = r.act.avih;
      if (av.accept && !p.avih.accept) add('bad', '🐾', `Rampa de ${f.city}`, `${p.avih.name} (${p.avih.breed}) no debía viajar en bodega: ${p.avih.why.split(':')[0].toLowerCase()}. Llegó estresado y hubo que llamar al veterinario. Reclamo formal del dueño.`);
      else if (av.accept) add('good', '🐕', `Rampa de ${f.city}`, `${p.avih.name} llegó a ${f.city} moviendo la cola. El comandante agradece el NOTOC: "así sabemos que tenemos un pasajero de cuatro patas abajo".`);
    }
    const has = (re) => fails.find((t) => re.test(t));
    const exc = has(/^No cobró exceso/);
    if (exc) { const usd = +(exc.match(/USD (\d+)/) || [])[1] || 0; add('warn', '💸', 'Contaduría', `No cobraste USD ${usd} de exceso de equipaje a ${nm}. Con eso pagábamos el café de la máquina un mes.`); }
    if (has(/^Mercancía peligrosa/)) add('bad', '🔥', 'Seguridad de rampa', `Los rayos X detectaron un artículo peligroso en una valija de ${nm}. Hubo que abrirla al pie del avión.`);
    if (has(/más de 32 kg/)) add('warn', '🏋️', 'Rampa', `El maletero que levantó la valija de ${nm} (más de 32 kg) presentó una queja al gremio. Y a la kinesióloga.`);
    if (has(/limited release/)) { bal.complaints++; add('warn', '🧳', `Equipajes de ${f.city}`, `La valija de ${nm} llegó dañada y reclamó. Sin limited release firmado, paga la compañía.`); }
    if (has(/salida de emergencia a un pasajero no apto/i)) add('warn', '🚪', `Tripulación del ${f.no}`, `Antes de despegar hubo que mover a ${nm} de la salida de emergencia. "¿Quién le dio ese asiento?"`);
    if (has(/^Familia sentada separada/)) add('warn', '👨‍👩‍👧', `Tripulación del ${f.no}`, `La familia ${p.last} viajó separada: tres pasajeros tuvieron que cambiarse de asiento y uno terminó al lado del baño.`);
    if (has(/katana/)) add('fun', '⚔️', 'Seguridad', `En el filtro le retuvieron la katana a ${nm}. Te dejó saludos... no muy amables.`);
  });

  // Fila del counter (modo desafío)
  (ck.queue || []).forEach((q) => {
    if (q.type === 'outage') q.log.forEach((x) => {
      if (x.type === 'kit' && x.perfect) add('good', '🧰', 'Marta', 'Cuando se cayó SITA armaste el kit de contingencia sin dudar. La gerencia quiere que des la capacitación de manual al resto del equipo.');
      if (x.type === 'upload') x.res.forEach((u) => {
        if (u.why === 'never') { bal.fines += 2000; add('bad', '📤', `Migraciones de ${u.city}`, `${u.name} llegó sin API: lo atendiste en manual y nunca se cargó en el sistema. Multa a la compañía por incumplir la transmisión de API.`); }
        if (u.why === 'late') add('warn', '📤', 'Control de calidad', `La API de ${u.name} (${u.flight}) se transmitió después del cierre del vuelo. Llegó, pero por poco.`);
      });
    });
    if (q.type === 'team') {
      q.log.filter((x) => x.type === 'consult').forEach((x) => {
        if (!x.ok) {
          bal.complaints++;
          if (x.fine) bal.fines += INAD_USD;
          add('bad', '👥', `Mostrador ${x.no}`, `${x.bad} ${x.by === 'you' ? `${x.bot} había seguido tu consejo...` : `${x.bot} te había consultado, pero no llegaste a contestarle.`}`);
        } else if (x.by === 'you') add('good', '🤝', x.bot, `"Gracias por la mano con ${x.name}. ${pick(['Te debo un café.', 'Mañana las medialunas las traigo yo.', 'Ya lo anoté en mi cuadernito.'])}"`);
      });
      const tot = q.desks.reduce((s, d) => s + d.count, 0);
      if (tot) add('fun', '👥', 'Marta', `Entre los tres mostradores atendieron ${tot + ck.results.length} pasajeros: ${q.desks.map((d) => `${d.name} ${d.count}`).join(', ')} y vos ${ck.results.length}. ${tot > ck.results.length * 2 ? '¡El equipo funcionó como un reloj!' : 'Buen ritmo de equipo.'}`);
    }
    if (q.type === 'viral') { bal.complaints++; add('bad', '📱', 'Redes sociales', `Un pasajero subió un video de la fila del mostrador 22: "Dos horas en Aeroplata para despachar una valija 🐢". ${(150 + Math.floor(Math.random() * 400))} mil reproducciones. Marketing no está contento.`); }
    if (q.type === 'cut' && q.urgent && q.ok) add('good', '🏃', `Puerta del ${q.flight}`, `${q.name} llegó justo gracias a que lo adelantaste en la fila. Dejó un "¡gracias, me salvaste las vacaciones!" en la página de la compañía.`);
    if (q.type === 'cut' && q.urgent && !q.ok) { bal.complaints++; add('bad', '⏰', 'Ventas', `${q.name} perdió el cierre del ${q.flight} a ${q.city} esperando en la fila. Hubo que reprogramarlo y dejó un reclamo: "¡Le avisé que cerraba!"`); }
    if (q.type === 'cut' && !q.urgent && !q.ok) { bal.complaints++; add('warn', '😤', 'Atención al Cliente', `Tres reclamos de pasajeros que vieron cómo ${q.name} se coló en la fila "porque odiaba las filas". Su vuelo salía dos horas después.`); }
  });
  if (day.mode === 'challenge' && (ck.queue || []).length && !(ck.queue || []).some((q) => q.type === 'viral')) add('good', '🧘', 'Marta', 'La fila del mostrador 22 fue la más tranquila de la noche. ¿Cuál es tu secreto?');

  // Puerta
  const F = day.flightObj;
  gate.results.forEach((r) => {
    if (r.pax.fromCheckin) {
      if (['carry_doc', 'carry_ret', 'drunk'].includes(r.pax.kind) && r.decision.kind === 'board') return; // ya contado desde el counter
    }
    if (r.decision.kind === 'deny' && r.expected.kind === 'deny' && ['RETURN', 'IDENT'].includes(r.expected.reason) && !r.pax.fromCheckin) bal.avoided += INAD_USD;
    if (r.decision.kind === 'board' && r.expected.kind === 'deny') {
      const nm = nameOf(r.pax);
      if (r.expected.reason === 'DATE') { bal.complaints++; add('bad', '📅', 'Revenue Accounting', `${nm} voló con la tarjeta de ayer: en el sistema figuraba como no show y su asiento ya estaba vendido. Dos pasajeros, un asiento y una discusión en la fila 14.`); }
      else if (r.expected.reason === 'RETURN') { bal.fines += INAD_USD; add('bad', '⛔', `Migraciones de ${F.city}`, `${nm} viajó solo ida sin pasaje de regreso y fue rechazado/a al llegar (INAD). Multa: USD ${INAD_USD.toLocaleString('es-AR')}.`); }
      else if (r.expected.reason === 'IDENT') { bal.fines += INAD_USD; add('bad', '🕵️', `Migraciones de ${F.city}`, `La persona que embarcó como ${nm} no era la del pasaporte. Fue devuelta y llegó la multa.`); }
      else { bal.complaints++; bal.delay += 15; add('bad', '🍷', `Tripulación del ${F.no}`, `${nm} armó un escándalo a bordo. Comandante, policía al llegar y reporte de pasajero disruptivo.`); }
    }
  });
  gate.results.forEach((r) => {
    const nm = nameOf(r.pax), dk = r.decision.kind;
    if (r.pax.kind === 'gate_smoker') {
      if (dk === 'deny') add('good', '🚭', `Tripulación del ${F.no}`, `Gracias por dejar abajo a ${nm}. La última vez que alguien así subió, fumó en el baño y saltó la alarma de humo a mitad del Atlántico.`);
      else if (dk === 'board') { bal.complaints++; add('bad', '🚨', `Tripulación del ${F.no}`, `${nm} fumó en el baño del avión: saltó la alarma de humo, hubo que avisar al comandante y lo esperó la policía al aterrizar.`); }
    }
    if (r.pax.kind === 'gate_rage') {
      if (dk === 'deny') add('fun', '🪧', 'PSA', `${nm} no viajó y le van a cobrar el cartel de Aeroplata que tiró. Su señora viajó en el 14A... y dicen que se la vio muy tranquila.`);
      else if (dk === 'board') { bal.complaints++; bal.delay += 30; add('bad', '✈️', `Comandante del ${F.no}`, `${nm} siguió a los gritos a bordo: hubo que volver a la posición y bajarlo con la PSA. 30 minutos de demora.`); }
    }
    if (r.pax.kind === 'gate_carryon' && r.conflict?.gaveIn) add('warn', '🧳', `Tripulación del ${F.no}`, `La valija de ${nm} no entró en ningún compartimiento y terminó trabando el pasillo. Hubo que bajarla a bodega con el avión ya cerrado.`);
  });
  gate.proc.forEach((x) => {
    if (x.ok === false && /quedó en bodega sin su pasajero/.test(x.title)) { bal.delay += 40; add('bad', '🧳', 'Seguridad', `El ${F.no} tuvo que volver a la posición para bajar una valija sin su pasajero. 40 minutos de demora y el comandante, de muy mal humor.`); }
    const late = x.title.match(/^Cierre tardío: (\d+) min/);
    if (late) { bal.delay += +late[1]; add('warn', '🕐', 'Operaciones', `El ${F.no} salió ${late[1]} minutos tarde. Perdimos el turno de despegue y la gente de la conexión corrió por todo el aeropuerto.`); }
    if (x.ok && /^Vuelo cerrado a tiempo/.test(x.title)) add('good', '🛫', 'Operaciones', `El ${F.no} salió en horario. Puntualidad del día: 100 %. Te ganaste un aplauso en el grupo de WhatsApp.`);
  });

  const bad = news.filter((n) => n.tone === 'bad').length;
  if (!bad) add('good', '🥐', 'Marta', pick(['Te dejé una medialuna en el locker. No le digas a nadie.', 'Gerencia preguntó quién estaba en el counter ayer. Esta vez para bien.', 'Ni un reclamo. En este aeropuerto eso es casi un milagro.']));
  const order = { bad: 0, warn: 1, fun: 2, good: 3 };
  news.sort((a, b) => order[a.tone] - order[b.tone]);
  return { news: news.slice(0, 9), more: Math.max(0, news.length - 9), bal };
}

export function newsHTML({ news, more, bal }) {
  const usd = (n) => `USD ${n.toLocaleString('es-AR')}`;
  return `<div class="balance">
      <div><span>Multas pagadas</span><b class="${bal.fines ? 'err' : ''}">${usd(bal.fines)}</b></div>
      <div><span>Multas evitadas</span><b class="okc">${usd(bal.avoided)}</b></div>
      <div><span>Reclamos</span><b class="${bal.complaints ? 'err' : ''}">${bal.complaints}</b></div>
      <div><span>Demoras causadas</span><b class="${bal.delay ? 'err' : ''}">${bal.delay} min</b></div>
    </div>
    <div class="news">${news.map((n) => `<div class="newsItem ${n.tone}"><span class="ico">${n.icon}</span><div><b>${esc(n.from)}</b><p>${esc(n.text)}</p></div></div>`).join('')}</div>
    ${more ? `<p class="hint">…y ${more} novedad(es) más en el buzón.</p>` : ''}`;
}

// ------------------------------------------------------------------
// Repaso de errores
// ------------------------------------------------------------------
export function reviewData(ck, gate) {
  const counter = ck.results.filter((r) => !r.ev.correct || r.ev.items.some((x) => x.ok === false && x.pts <= -10));
  const gateBad = gate.results.filter((r) => r.notes.some((n) => n.ok === false));
  const procBad = gate.proc.filter((x) => x.ok === false);
  return { counter, gateBad, procBad };
}

export function reviewHTML({ counter, gateBad, procBad }, faceSVG) {
  if (!counter.length && !gateBad.length && !procBad.length) return '<p class="hint big">🎉 No hay nada para repasar: ni un error en todo el día.</p>';
  const card = (face, title, sub, verdict, lines) => `<div class="revCard">
    <div class="rvFace">${faceSVG(face, { w: 54, h: 68, bg: '#dce7f0' })}</div>
    <div class="rvBody"><b>${esc(title)}</b><small>${esc(sub)}</small>
      ${verdict ? `<div class="rvVerdict">${verdict}</div>` : ''}
      <ul>${lines.map((l) => `<li class="${l.cls}"><b>${esc(l.t)}</b>${l.d ? ` — ${esc(l.d)}` : ''}</li>`).join('')}</ul></div></div>`;
  const ckCards = counter.map((r) => {
    const exp = r.ev.analysis.expected, dk = r.decision.kind;
    const verdict = r.ev.correct ? '<span class="tag green">Decisión correcta</span> pero con errores de proceso'
      : `<span class="tag red">Hiciste: ${DECISION[dk]}</span> <span class="tag green">Correcto: ${DECISION[exp]}</span>`;
    const lines = [];
    if (!r.ev.correct) r.ev.analysis.blockers.forEach((b) => lines.push({ cls: 'why', t: b.label, d: b.why }));
    if (!r.ev.correct && exp === 'accept') lines.push({ cls: 'why', t: 'El pasajero cumplía todos los requisitos', d: 'Revisá qué te hizo dudar: documento, reserva y Timatic estaban en regla.' });
    r.ev.items.filter((x) => x.ok === false && !/^(Aceptó a un pasajero|Correspondía|.* a un pasajero que)/.test(x.title)).forEach((x) => lines.push({ cls: 'bad', t: x.title, d: x.detail }));
    return card(r.pax.face, nameOf(r.pax), `Counter · ${r.pax.flight.no} ${r.pax.flight.city} · ${SCENARIOS[r.pax.scenario] || ''}`, verdict, lines);
  });
  const gtCards = gateBad.map((r) => {
    const ok = r.decision.kind === r.expected.kind;
    const verdict = ok ? '<span class="tag green">Decisión correcta</span> pero con errores de proceso'
      : `<span class="tag red">Hiciste: ${GATE_DECISION[r.decision.kind]}</span> <span class="tag green">Correcto: ${GATE_DECISION[r.expected.kind]}</span>`;
    const lines = r.notes.filter((n) => n.ok !== true).map((n) => ({ cls: n.ok === false ? 'bad' : 'why', t: n.t }));
    return card(r.pax.face, nameOf(r.pax), `Puerta · ${KIND_LABEL[r.pax.kind] || ''}`, verdict, lines);
  });
  return `${ckCards.length ? `<h3>Counter (${ckCards.length})</h3>${ckCards.join('')}` : ''}
    ${gtCards.length ? `<h3>Puerta (${gtCards.length})</h3>${gtCards.join('')}` : ''}
    ${procBad.length ? `<h3>Procedimiento de puerta</h3><ul class="fb">${procBad.map((x) => `<li class="bad"><div><b>${esc(x.title)}</b>${x.detail ? `<p>${esc(x.detail)}</p>` : ''}</div></li>`).join('')}</ul>` : ''}`;
}

// Casos para practicar de nuevo (se reconstruyen con pasajeros nuevos)
export function replayDecks(rev) {
  const ck = rev.counter.map((r) => ({ scenario: r.pax.scenario, overlay: r.pax.overlay || 'none' }));
  const PRACTICABLE = ['wchr', 'inf_stroller', 'senior_zone4', 'early', 'influencer', 'wrong_flight', 'vaper', 'exit_minor', 'name_mismatch', 'no_return', 'pet_exit', 'dead_phone', 'drunk', 'impostor', 'dutyfree', 'dup_bp', 'inop_seat', 'web_yesterday', 'no_return', 'gate_carryon', 'gate_smoker', 'gate_rage', 'depa'];
  const kinds = [...new Set(rev.gateBad.map((r) => (r.pax.kind === 'partner' ? 'name_mismatch' : r.pax.kind)).filter((k) => PRACTICABLE.includes(k)))];
  return { ck, gate: kinds };
}
