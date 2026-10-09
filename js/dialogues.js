// Diálogos de los pasajeros en su idioma (español, inglés o portugués).
// Cada pasajero habla SIEMPRE en un solo idioma, según su nacionalidad.
import { ENTRY_RULES } from './data.js';
import { pick, fmtDate } from './util.js';

// Idioma en que habla el pasajero
export function paxLang(p) {
  if (p.nationality === 'US') return 'en';
  if (p.nationality === 'BR') return 'pt';
  return 'es';
}

// Traducciones de objetos que aparecen en las frases
const ITEMS = {
  'un power bank (batería externa)': { en: 'a power bank', pt: 'um power bank (bateria externa)' },
  'un cigarrillo electrónico': { en: 'an e-cigarette', pt: 'um cigarro eletrônico' },
  'dos baterías de litio de repuesto de la cámara': { en: 'two spare lithium batteries for my camera', pt: 'duas baterias de lítio reserva da câmera' },
  'un encendedor y un aerosol grande': { en: 'a lighter and a big can of hairspray', pt: 'um isqueiro e um aerossol grande' },
  'una garrafita de gas butano para el camping': { en: 'a little butane gas canister for camping', pt: 'um botijãozinho de gás butano para acampar' },
  'una notebook': { en: 'a laptop', pt: 'um notebook' },
  'una cámara de fotos profesional': { en: 'a professional camera', pt: 'uma câmera profissional' },
  'joyas y algo de efectivo': { en: 'some jewelry and cash', pt: 'joias e um pouco de dinheiro' },
  gata: { en: 'cat', pt: 'gata' }, caniche: { en: 'poodle', pt: 'poodle' }, 'perro labrador': { en: 'labrador', pt: 'labrador' },
  iguana: { en: 'iguana', pt: 'iguana' }, 'halcón': { en: 'falcon', pt: 'falcão' },
};
const tr = (s, lang) => (lang === 'es' ? s : ITEMS[s]?.[lang] || s);

// Preguntas del agente en inglés (con pasajeros angloparlantes el agente cambia de idioma)
export const AGENT_EN = {
  docs: 'Good evening. May I have your travel document and booking, please?',
  reason: 'What is the purpose of your trip?',
  ret: 'When are you coming back?',
  visa: 'Do you have a visa or travel authorization for your destination?',
  minor: 'Are you traveling alone?',
  health: 'Do you have any medical condition we should know about, or are you pregnant?',
  bags: 'Are you checking any bags? Please place them on the scale.',
  security: 'Did you pack your bags yourself and keep them with you at all times? Did anyone give you anything to carry? Are you carrying aerosols, butane, lighters, spare lithium batteries, power banks, e-cigarettes, flammable or corrosive items in your checked bag?',
  valuables: 'Are you carrying any valuables in your checked bag? If so, please take them in your carry-on: the airline is not responsible for valuables in the hold.',
  seat: 'Do you have a seat preference? I have exit row seats available.',
  companion: 'Are you traveling with someone?',
  carry: 'What are you carrying as hand luggage?',
  vape: "Just a reminder: smoking and vaping aren't allowed in the boarding area or on board.",
  gdocs: 'Good evening, may I see your boarding pass and passport?',
  gvisa: 'Your destination requires a visa: may I see it, please?',
  gret: 'Do you have a return or onward ticket?',
};

// ------------------------------------------------------------------
// COUNTER DE CHECK-IN
// ------------------------------------------------------------------
export function checkinLines(p) {
  const lang = paxLang(p);
  const S = (es, en, pt) => ({ es, en, pt })[lang];
  const city = p.flight.city;
  const o = p.sex === 'F' ? 'a' : 'o';
  const L = {};

  L.greet = S(
    pick([`¡Buenas tardes! Vengo a hacer el check-in para ${city}.`, `Hola, ¿qué tal? Para el vuelo a ${city}, por favor.`, `Buenas, ¿acá es para ${city}?`]),
    pick([`Hi! Good evening. Checking in for ${city}, please.`, `Hello! I'm on the flight to ${city}.`, `Hey there! Is this the check-in for ${city}?`]),
    pick([`Boa tarde! Check-in para ${city}, por favor.`, `Oi, tudo bem? Voo para ${city}.`, `Olá! É aqui o check-in para ${city}?`]),
  );
  if (p.nationality === 'ES') L.greet = `¡Hola, buenas! Vengo a facturar para ${city}, vale.`;
  if (p.nationality === 'CL') L.greet = `¡Hola! Buenas tardes, vengo para el vuelo a ${city}, po.`;
  if (p.scenario === 'late') L.greet = S(`¡Llegué! Perdón, ¿todavía estoy a tiempo para ${city}? Había un tráfico en la autopista...`, `Made it! Sorry, am I still on time for ${city}? The traffic on the highway was insane...`, `Cheguei! Desculpa, ainda dá tempo para ${city}? O trânsito estava horrível...`);
  if (p.isMinor) L.greet = S(`Hola... vengo a hacer el check-in para ${city}.`, `Hi... I'm here to check in for ${city}.`, `Oi... vim fazer o check-in para ${city}.`);

  // Documentación
  L.docs = S(pick(['Sí, acá tiene.', 'Claro, tome.', 'Acá está todo.']), pick(['Sure, here you go.', 'Here you are.']), pick(['Claro, aqui está.', 'Pois não, aqui.']));
  if (p.scenario === 'visa_oldpp') L.docs = S('Tome: el pasaporte nuevo y también el viejo, que tiene la visa adentro.', 'Here: my new passport and the old one, which has the visa in it.', 'Aqui: o passaporte novo e o antigo, que tem o visto.');
  if (p.scenario === 'dni_wrong') L.docs = S('Acá tiene mi DNI. El pasaporte lo tengo vencido, pero con el DNI alcanza, ¿no?', "Here's my ID card. My passport is expired, but the ID is enough, right?", 'Aqui está meu RG. O passaporte está vencido, mas o RG serve, né?');
  if (p.scenario === 'no_ticket') L.docs = S('Acá tiene. La reserva la hice ayer por la web, creo que se pagó...', 'Here you go. I booked it online yesterday, I think the payment went through...', 'Aqui. Fiz a reserva ontem pelo site, acho que o pagamento passou...');
  if (p.isMinor) L.docs = S(`Acá están mis documentos${p.docs.some((d) => d.type === 'AUTH_MINOR') ? ' y el papel que firmaron mis papás' : ''}.`, `Here are my documents${p.docs.some((d) => d.type === 'AUTH_MINOR') ? ' and the paper my parents signed' : ''}.`, `Aqui estão meus documentos${p.docs.some((d) => d.type === 'AUTH_MINOR') ? ' e o papel que meus pais assinaram' : ''}.`);

  // Motivo y regreso
  L.reason = S(
    pick(['Vacaciones, por fin.', 'Voy por trabajo, una reunión de tres días.', 'A visitar a mi familia.', 'Turismo, con amigos que ya están allá.', 'Voy a un congreso de odontología... bueno, a la playa, el congreso es un día.', 'Me caso allá. Bueno, si ella dice que sí. Todavía no le pregunté.', 'Voy a ver a la Selección. Si perdemos, vuelvo antes.']),
    pick(['Vacation, finally!', 'Business trip, three days of meetings. Yay.', 'Visiting family.', "Going home. I loved Buenos Aires, but I can't eat one more empanada.", "A friend's wedding. I'm the best man and I haven't written the speech yet."]),
    pick(['Férias, finalmente!', 'Trabalho, uma reunião de três dias.', 'Volto para casa, estava visitando amigos.', 'Vim pelo alfajor, volto com três quilos a mais.', 'Vou num show. Se eu não conseguir ingresso, choro no aeroporto mesmo.']),
  );
  if (p.scenario === 'impostor') L.reason = S(pick(['Eh... turismo. Vacaciones.', 'Turismo... sí, turismo.']), pick(['Uh... tourism. Vacation.', 'Tourism... yes, tourism.']), pick(['Ah... turismo. Férias.', 'Turismo... é, turismo.']));
  if (p.isMinor) L.reason = S(`Voy a visitar a mi tía, ella me espera en ${city}.`, `I'm visiting my aunt, she's waiting for me in ${city}.`, `Vou visitar minha tia, ela me espera em ${city}.`);
  const ret = p.booking.returnDate ? fmtDate(p.booking.returnDate) : null;
  L.ret = ret ? S(`Vuelvo el ${ret}.`, `I'm back on ${ret}.`, `Volto no dia ${ret}.`) : S('Es solo ida.', "It's one way.", 'É só ida.');
  if (p.scenario === 'no_return') {
    L.ret = S('¿La vuelta? Todavía no sé... voy a probar suerte. Si me gusta, me quedo. ¡La vuelta la compro allá!', "Coming back? Not sure yet... I'm trying my luck. If I like it, I'll stay. I'll buy the return ticket there!", 'A volta? Ainda não sei... vou tentar a sorte. Se gostar, fico. A volta eu compro lá!');
    L.reason = S('Turismo... y si sale algún laburito, mejor.', 'Tourism... and if some work comes up, even better.', 'Turismo... e se aparecer um trabalhinho, melhor.');
  }
  if (p.scenario === 'return_resident') {
    L.ret = S(`No tengo vuelta: vivo en ${city} hace años. Acá tiene mi residencia.`, `No return ticket: I've lived in ${city} for years. Here's my residence card.`, `Não tenho volta: moro em ${city} há anos. Aqui está minha residência.`);
    L.reason = S('Vuelvo a casa. Vine a visitar a mi vieja.', "Going home. I came to visit my mom.", 'Volto pra casa. Vim visitar minha mãe.');
  }

  // Visa
  const rule = ENTRY_RULES[p.flight.country];
  const vt = rule.visa[p.nationality];
  if (p.flight.country === 'AR') L.visa = S('Es un vuelo nacional, ¿no? No necesito visa.', "It's a domestic flight, right? No visa needed.", 'É um voo doméstico, né? Não preciso de visto.');
  else if (p.scenario === 'return_resident') L.visa = S('No necesito: soy residente, tengo la tarjeta de residencia.', "I don't need one: I'm a permanent resident, here's my card.", 'Não preciso: sou residente, tenho o cartão de residência.');
  else if (p.nationality === p.flight.country) L.visa = S('Soy de allá, vuelvo a casa.', "I'm a citizen, I'm going home!", `Sou brasileir${o}, estou voltando para casa.`);
  else if (vt === 'VISA_US') {
    L.visa = {
      no_visa: S('¿Visa? No... una amiga me dijo que con el pasaporte alcanzaba.', 'A visa? No... a friend told me the passport was enough.', 'Visto? Não... uma amiga disse que só o passaporte bastava.'),
      visa_expired: S('Sí, la tengo, está en el pasaporte. La saqué hace bastante.', "Yes, it's in my passport. I got it a while ago.", 'Sim, está no passaporte. Tirei faz tempo.'),
      visa_oldpp: S('Sí, está en el pasaporte viejo. Por eso le di los dos.', "Yes, it's in the old passport. That's why I gave you both.", 'Sim, está no passaporte antigo. Por isso te dei os dois.'),
    }[p.scenario] || S('Sí, está en el pasaporte.', "Yes, it's in my passport.", 'Sim, está no passaporte.');
  } else if (vt === 'EVISA_BR') {
    L.visa = p.scenario === 'us_br_noevisa' ? S('¿Visa para Brasil? ¡Pensé que no hacía falta!', "A visa for Brazil? I thought Americans didn't need one!", 'Visto para o Brasil? Achei que não precisava!') : S('Sí, tengo la e-Visa, acá está.', 'Yes, I have the e-visa, here it is.', 'Sim, tenho o e-Visa, aqui está.');
  } else if (rule.esta.includes(p.nationality)) {
    L.visa = p.hasEsta ? S('Sí, tramité el ESTA por internet, salió aprobado.', 'Yes, I applied for the ESTA online and it was approved.', 'Sim, fiz o ESTA pela internet e foi aprovado.') : S('El ESTA... creo que lo hizo mi pareja. No sé si salió, la verdad.', "The ESTA... I think my partner did it. Honestly, no idea if it went through.", 'O ESTA... acho que meu parceiro fez. Sinceramente, não sei se saiu.');
  } else L.visa = S(pick(['No, para allá no necesito visa.', 'No hace falta visa, ¿no?']), "No, I don't need a visa there, right?", 'Não, para lá não preciso de visto, né?');

  // Seguridad (cartilla de mercancías peligrosas)
  if (!p.bags.length) L.security = S('No despacho nada, solo llevo la mochila.', "I'm not checking anything, just my backpack.", 'Não vou despachar nada, só a mochila.');
  else if (p.dgItem) L.security = S(`Sí, la armé yo. Ah... tengo ${p.dgItem} en la valija, ¿hay algún problema?`, `Yes, I packed it myself. Oh... I have ${tr(p.dgItem, 'en')} in the suitcase, is that a problem?`, `Sim, eu mesm${o} arrumei. Ah... tenho ${tr(p.dgItem, 'pt')} na mala, tem problema?`);
  else L.security = S(
    pick(['Sí, la armé yo y la tuve siempre conmigo. No llevo nada de lo que figura en la cartilla.', 'La hice yo, nadie me dio nada para llevar. Nada de aerosoles, encendedores ni baterías.']),
    pick(['Yes, I packed it myself and it never left my sight. Nothing from that list.', 'I packed it, nobody gave me anything. No aerosols, lighters or batteries.']),
    pick(['Sim, eu arrumei e ficou sempre comigo. Nada dessa lista.', 'Eu mesm' + o + ' fiz a mala, ninguém me deu nada. Sem aerossol, isqueiro nem bateria.']),
  );

  // Equipaje
  const n = p.bags.length;
  L.bags = n === 0 ? S('No, no despacho valija. Solo equipaje de mano.', 'No checked bags, just my carry-on.', 'Não, só bagagem de mão.')
    : n === 1 ? S('Una valija, la pongo en la balanza.', "One suitcase, I'll put it on the scale.", 'Uma mala, vou colocar na balança.')
      : S(`Tengo ${n} valijas. Le pongo la primera.`, `I have ${n} bags. Here's the first one.`, `Tenho ${n} malas. Coloco a primeira.`);
  if (p.bags.some((b) => b.weight > 32)) L.bags += S(' Uy, creo que vino bastante cargada...', ' Oops, I think it might be a little heavy...', ' Ih, acho que está bem pesada...');

  L.seat = {
    window: S('Si puede ser, ventanilla.', 'Window, if possible.', 'Janela, se possível.'),
    aisle: S('Pasillo, por favor, que me levanto mucho.', 'Aisle, please. I get up a lot.', 'Corredor, por favor, eu levanto muito.'),
    exit: S('Si hay, en la salida de emergencia, que tiene más lugar para las piernas.', 'An exit row, if you have one. More legroom!', 'Se tiver, na saída de emergência, que tem mais espaço para as pernas.'),
  }[p.seatPref] || S('Me da igual, donde haya lugar.', "Anywhere is fine, I'm easy.", 'Tanto faz, onde tiver lugar.');

  // Menores
  if (p.isMinor) {
    const auth = p.docs.find((d) => d.type === 'AUTH_MINOR');
    if (p.scenario === 'minor_noauth' && !auth) L.minor = S(`Sí, viajo sol${o}. Mi mamá me trajo pero ya se fue... ¿qué autorización?`, 'Yes, alone. My mom dropped me off but she left... what authorization?', `Sim, viajo sozinh${o}. Minha mãe me trouxe mas já foi... que autorização?`);
    else if (p.scenario === 'minor_noauth') L.minor = S(`Sí, viajo sol${o}. Tengo la autorización, es la que usé el año pasado.`, "Yes, alone. I have the authorization, it's the one I used last year.", `Sim, sozinh${o}. Tenho a autorização, é a do ano passado.`);
    else if (p.scenario === 'um_missing') L.minor = S(`Sí, viajo sol${o}. Mi mamá está allá atrás. ¿Necesito algo más?`, 'Yes, alone. My mom is over there. Do I need anything else?', `Sim, sozinh${o}. Minha mãe está ali atrás. Preciso de mais alguma coisa?`);
    else L.minor = S(`Sí, viajo sol${o}. Mis papás firmaron la autorización${p.booking.ssr.includes('UMNR') ? ' y contrataron el servicio de menor no acompañado' : ''}.`, `Yes, alone. My parents signed the authorization${p.booking.ssr.includes('UMNR') ? ' and booked the unaccompanied minor service' : ''}.`, `Sim, sozinh${o}. Meus pais assinaram a autorização${p.booking.ssr.includes('UMNR') ? ' e contrataram o serviço de menor desacompanhado' : ''}.`);
  } else L.minor = S(`Viajo sol${o}, sí.`, "Yes, I'm traveling alone.", `Viajo sozinh${o}, sim.`);

  // Reacciones
  L.repack = S('Uf... bueno, paso algunas cosas al bolso de mano.', 'Ugh... fine, I\'ll move some things to my carry-on.', 'Ufa... tá bom, passo umas coisas para a bagagem de mão.');
  L.dgRemove = S('Ah, perfecto, lo saco y lo llevo en la mochila.', "Oh, okay, I'll take it out.", 'Ah, beleza, eu tiro da mala.');
  L.charge = S('Bueno... ¿se puede pagar con tarjeta?', 'Okay... can I pay by card?', 'Tá bom... posso pagar no cartão?');
  L.accept = S('¡Muchas gracias! Buen turno.', 'Thank you so much! Have a good one.', `Muito obrigad${o}! Bom trabalho!`);
  L.reject = S('¿Cómo que no puedo viajar? ... Bueno, ¿qué tengo que hacer?', "What do you mean I can't fly? ...Okay, what do I need to do?", 'Como assim não posso viajar? ...Tá, o que eu tenho que fazer?');
  L.derive = S('Ok, voy al mostrador que me indica.', "Okay, I'll go to that counter.", 'Tá bom, vou no balcão que você indicou.');
  L.valuablesMove = S('Tiene razón, mejor lo paso a la mochila.', "You're right, I'll put it in my backpack.", 'Tem razão, vou passar para a mochila.');
  L.limited = S('Sí, sí, firmo. Ya sé que está medio golpeada.', "Sure, I'll sign. I know it's a bit beat up.", 'Sim, eu assino. Sei que está meio amassada.');
  L.exitDeny = S('Ah, bueno, entiendo. No hay problema.', 'Oh, okay, I understand. No problem.', 'Ah, tudo bem, sem problema.');

  // Salud / embarazo
  const cert = p.docs.find((d) => d.type === 'MED_CERT');
  L.health = S('No, todo bien, gracias.', "No, I'm fine, thanks.", 'Não, tudo bem, obrigad' + o + '.');
  if (p.weeks) {
    L.health = S(
      `Sí, estoy embarazada de ${p.weeks} semanas.${cert ? ' Le dejé también el certificado de mi médico.' : p.weeks > 28 ? ' ¿Hace falta algún papel?' : ''}`,
      `Yes, I'm ${p.weeks} weeks pregnant.${cert ? " I've included my doctor's certificate." : p.weeks > 28 ? ' Do I need any paperwork?' : ''}`,
      `Sim, estou grávida de ${p.weeks} semanas.${cert ? ' Deixei também o atestado do meu médico.' : p.weeks > 28 ? ' Preciso de algum papel?' : ''}`,
    );
    if (p.weeks > 28) L.docs += S(` Estoy de ${p.weeks} semanas${cert ? ', acá está el certificado médico' : ''}.`, ` I'm ${p.weeks} weeks pregnant${cert ? ", here's the medical certificate" : ''}.`, ` Estou de ${p.weeks} semanas${cert ? ', aqui está o atestado médico' : ''}.`);
  }

  // Objetos de valor
  L.valuables = !p.bags.length ? S('No despacho valija, todo va conmigo.', "I'm not checking a bag, everything's with me.", 'Não despacho mala, está tudo comigo.')
    : p.valuables ? S(`Sí, llevo ${p.valuables} en la valija.`, `Yes, I have ${tr(p.valuables, 'en')} in the suitcase.`, `Sim, tenho ${tr(p.valuables, 'pt')} na mala.`)
      : S('No, lo de valor lo llevo en la mochila.', 'No, my valuables are in my backpack.', 'Não, as coisas de valor estão na mochila.');

  // Salida de emergencia: pasajeros no aptos
  if (p.exitVariant === 'lang') {
    L.seat = 'Se tiver, quero na saída de emergência... tem mais espaço para as pernas! (no habla español ni inglés)';
    L.security = p.bags.length ? 'Desculpa, não entendi... a mala? Sim, eu fiz a mala.' : 'Não despacho nada.';
  }
  if (p.exitVariant === 'DEAF') L.seat = S('(Le habla un poco más fuerte, mirándole los labios) ¿Me repite? ...Ah, sí, si hay, en la salida de emergencia.', "(Speaks a bit loudly, reading your lips) Sorry, could you repeat? ...Oh, yes, an exit row if you have one.", '(Fala um pouco alto, lendo seus lábios) Pode repetir? ...Ah, sim, na saída de emergência, se tiver.');
  if (p.exitVariant === 'PETC') L.seat = S('Si hay, en la salida de emergencia, así mi perrita en el bolso va más cómoda.', "An exit row, if possible, so my little dog in her bag has more room.", 'Na saída de emergência, se tiver, assim minha cachorrinha vai mais confortável.');

  // Mascota, katana y asado con hielo seco
  if (p.pet) {
    const sp = tr(p.pet.species, lang);
    const fem = p.pet.species === 'gata';
    L.greet += S(` Ah, y viajo con ${p.pet.name}, mi ${sp}. Viaja conmigo en la cabina, ¿no?`, ` Oh, and this is ${p.pet.name}, my ${sp}. ${fem ? 'She' : 'He'} flies with me in the cabin, right?`, ` Ah, e viajo com ${p.pet.name}, ${fem ? 'minha' : 'meu'} ${sp}. Vai comigo na cabine, né?`);
    L.petOk = S(`¡Bien, ${p.pet.name}! Escuchaste, vas arriba conmigo.`, `Yay, ${p.pet.name}! You heard that, you're flying with me.`, `Eba, ${p.pet.name}! Ouviu? Você vai comigo.`);
    L.petNo = {
      iguana: S('Pero Ramón es re tranquilo... bueno, se queda con mi suegra. Ella lo odia.', 'But Ramón is so chill... fine, he stays with my mother-in-law. She hates him.', 'Mas o Ramón é tão tranquilo... tá, ele fica com a minha sogra. Ela odeia ele.'),
      'halcón': S('Thor va a estar muy ofendido. Lo llamo a mi primo que lo venga a buscar.', "Thor is going to be very offended. I'll call my cousin to pick him up.", 'O Thor vai ficar muito ofendido. Vou ligar pro meu primo buscar ele.'),
      'perro labrador': S('¿31 kilos? Bueno, es de hueso grande... Llamo a mi hermano.', "31 kilos? Well, he's big-boned... I'll call my brother.", '31 quilos? Bom, ele tem ossos grandes... Vou ligar pro meu irmão.'),
    }[p.pet.species] || S('Bueno, lo resuelvo con mi familia.', "Okay, I'll sort it out with my family.", 'Tá bom, resolvo com a minha família.');
  }
  if (p.sword) {
    L.greet += S(' ¡Mire lo que me compré! Una katana de colección. La llevo en la mano, ¿no? Así no se raya.', " Look what I bought! A collector's katana. I'll carry it on, right? So it doesn't get scratched.", ' Olha o que eu comprei! Uma katana de coleção. Levo na mão, né? Para não riscar.');
    L.sword = S('Ah, ¿va en una bolsa especial a bodega? Bueno, pero cuídenmela, ¿eh? Es de un samurái... de Once.', "Oh, it goes in a special bag in the hold? Fine, but take care of it! It belonged to a real samurai... from a shop downtown.", 'Ah, vai numa bolsa especial no porão? Tá, mas cuidem dela, hein? É de um samurai... da 25 de Março.');
  }
  if (p.dryIce) {
    const kg = String(p.dryIce).replace('.', ',');
    L.security = S(
      `La valija la armé yo. Y la conservadora tiene un asado para mi cumple en ${city}, con ${kg} kg de hielo seco para que llegue frío. ¡Vacío y chorizos!`,
      `I packed it myself. And the cooler has meat for a barbecue in ${city}, with ${p.dryIce} kg of dry ice to keep it cold. Argentine beef, baby!`,
      `Eu arrumei a mala. E o isopor tem carne para um churrasco em ${city}, com ${kg} kg de gelo seco para chegar gelado. Picanha argentina!`,
    );
    L.dryIce = S('Bueno, saco un poco de hielo... El vacío va a llegar tibio, pero llega.', "Fine, I'll take some ice out... The steak will arrive lukewarm, but it'll arrive.", 'Tá, tiro um pouco de gelo... A carne vai chegar morna, mas chega.');
  }

  // Familias (siempre argentinas: hablan en español)
  if (p.party) {
    const P = p.party;
    const kids = P.members.filter((m) => m.isMinor);
    const kidNames = kids.map((k) => (k.isInfant ? `${k.first} (el bebé)` : k.first)).join(' y ');
    const n = 1 + P.members.length;
    const kid = kids.find((k) => !k.isInfant);
    L.greet = {
      both: `¡Hola! Somos ${n} para ${city}. ${kid ? `¡${kid.first}, dejá la cinta de la fila!` : 'Perdón, el bebé no durmió nada.'} Perdón... ¿empezamos?`,
      one: `Hola, buenas. Viajo con ${kidNames} a ${city}. ${P.hasInfant ? 'Traigo el bolso del bebé, la mochila y el cochecito: me falta una mano.' : 'Su papá... bueno, el otro progenitor, se queda trabajando.'}`,
      guardian: `Hola, buenas noches. Viajo con ${kidNames}. Soy ${p.age >= 55 ? (p.sex === 'F' ? 'la abuela' : 'el abuelo') : (p.sex === 'F' ? 'la tía' : 'el tío')}, pero en la práctica soy todo: chofer, cocinero/a y árbitro de peleas.`,
      relative: `¡Hola, querido/a! Me llevo a ${kidNames} de paseo a ${city}. Los padres trabajan y ${p.sex === 'F' ? 'la abuela' : 'el abuelo'} se va de vacaciones. ¡Pero con el nieto de guardaespaldas!`,
    }[P.relation];
    L.docs = 'Acá están los documentos de todos. Y los papeles de los chicos... creo que están todos. ¿Me falta alguno?';
    L.minor = {
      both: `Viajamos todos juntos: ${P.members.filter((m) => !m.isMinor).map((m) => m.first).join(', ')}, yo y ${kidNames}.`,
      one: `Viajamos ${kidNames} y yo. ${p.sex === 'F' ? 'El papá' : 'La mamá'} no viaja${p.docs.some((d) => d.type === 'AUTH_MINOR') ? ', firmó la autorización ante escribano' : '... ¿hacía falta algún papel?'}.`,
      guardian: `Los chicos viven conmigo, tengo la tutela. ${p.docs.some((d) => d.type === 'GUARDIANSHIP') ? 'Acá está el papel del juzgado, que me costó dos años.' : '¿El papel del juzgado? Está en trámite... ¡pero todo el barrio sabe que viven conmigo!'}`,
      relative: `Viajo yo con ${kidNames}. Los padres se quedan trabajando. ${p.docs.some((d) => d.type === 'AUTH_MINOR') ? 'Me firmaron una autorización.' : ''}`,
    }[P.relation];
    const other = p.sex === 'F' ? 'el papá' : 'la mamá';
    if (P.absent === 'deceased') {
      L.greet = `Hola. Viajo con ${kidNames} a ${city}. Es el primer viaje que hacemos sin ${p.sex === 'F' ? 'él' : 'ella'}, así que paciencia si estamos un poco desorganizados.`;
      L.minor = `${other.charAt(0).toUpperCase() + other.slice(1)}${kids.length > 1 ? ' de los chicos' : ''} falleció hace unos años. ${p.docs.some((d) => d.type === 'DEATH_CERT') ? 'Por las dudas traje el acta de defunción, me dijeron que la piden.' : '¿Hace falta algún papel? Nadie me dijo nada...'}`;
    } else if (P.absent === 'court') {
      L.greet = `Buenas. Viajo con ${kidNames} a ${city}. Traigo una carpeta así de gorda, preguntame lo que quieras.`;
      L.minor = `De ${other} no sabemos nada hace años, así que tramité la autorización en el juzgado de familia. Tardó, pero acá está.`;
    } else if (P.absent === 'abroad') {
      L.greet = `¡Hola! Viajo con ${kidNames} a ${city}. ¡Vamos a ver ${p.sex === 'F' ? 'al papá' : 'a la mamá'}, que vive afuera!`;
      L.minor = `${other.charAt(0).toUpperCase() + other.slice(1)} trabaja en el exterior. ${p.docs.some((d) => d.type === 'AUTH_MINOR' && d.mode === 'consular') ? 'Fue al consulado argentino y firmó la autorización ahí.' : 'Me mandó la autorización firmada por WhatsApp, la imprimí recién en un locutorio. Sirve igual, ¿no?'}`;
    }
    L.seat = P.hasInfant ? 'Juntos, por favor. El bebé va en mis brazos. ¡Y lejos del baño, que el último vuelo fue un drama!' : 'Juntos, por favor, que si no se pelean por la ventanilla. Bah, se pelean igual.';
    L.bags = `Traemos ${p.bags.length} valijas${P.hasInfant ? ' y el cochecito' : ''}. Ya sé, viajamos livianos...`;
    L.security = 'Las armamos nosotros, nadie nos dio nada. Bueno, la abuela mandó alfajores. Nada de baterías ni aerosoles.';
    L.stroller = 'Ah, ¿el cochecito no se paga? ¡Por fin una buena noticia hoy!';
  }

  // Cabotaje: documentos de excepción
  if (p.scenario.startsWith('dom_')) {
    L.docs = {
      dom_license: 'Ay, perdí el DNI ayer en el subte... Tengo la licencia de conducir, ¿sirve?',
      dom_license_expired: 'Perdí el DNI la semana pasada. Tengo la licencia de conducir... creo que está vigente, ¿no?',
      dom_police: 'Me robaron la billetera con el DNI. Hice la denuncia en la comisaría, acá está.',
      dom_tramite: 'El DNI está en trámite: me dieron esta constancia en el Registro Civil.',
      dom_nodoc: 'Me olvidé el DNI en casa... pero tengo una foto en el celular, ¡mirá! Es igualito.',
    }[p.scenario];
    L.greet = '¡Hola! Me voy a ' + city + ' unos días. ¡Qué ganas!';
  }

  // Arma de fuego declarada (siempre argentinos) y mascota en bodega
  if (p.firearm) {
    L.reason = `Me voy a ${p.firearm.purpose}. ¡Por fin vacaciones!`;
    L.bags = `Despacho la valija y la ${p.firearm.label.split(' ')[0].toLowerCase()}, que va ${p.firearm.caseKind === 'rigid' ? 'en su estuche rígido, con candado' : 'en su funda, bien envuelta'}. Tengo los papeles.`;
    L.security = `¿Armas? Sí, ya le dije: la ${p.firearm.label.split(' ')[0].toLowerCase()}, descargada. La munición va aparte, en su caja: ${String(p.firearm.ammoKg).replace('.', ',')} kg. Nada más.`;
  }
  if (p.avih) {
    const A = p.avih;
    L.bags = S(`Despacho ${p.bags.length ? 'mi valija y ' : ''}a ${A.name}, que viaja en bodega en su canil. Lo reservé hace un mes.`, `I'm checking ${p.bags.length ? 'my bag and ' : ''}${A.name}, who travels in the hold in a crate. I booked it a month ago.`, `Vou despachar ${p.bags.length ? 'minha mala e ' : ''}${A.name}, que vai no porão na caixa de transporte. Reservei há um mês.`);
    L.reason = S(`Me mudo. Y ${A.name} viene conmigo, obvio.`, `I'm moving. And ${A.name} is coming with me, of course.`, `Estou me mudando. E ${A.name} vem comigo, claro.`);
  }

  // Condiciones legales: con custodia hablan los escoltas (en español)
  if (p.legal && p.party) {
    const E = p.party.members, depa = p.legal.type === 'DEPA', la = p.sex === 'F';
    const ag = /PRIVADA/.test(E[0].agency) ? 'Seguridad Escudo S.R.L.' : E[0].agency.split(' · ')[0].toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    L.greet = depa
      ? `(un escolta muestra la credencial) Buenas noches. ${ag}: traslado de ${la ? 'una detenida' : 'un detenido'} con ${E.length === 1 ? 'un escolta' : `${E.length} escoltas`}, vuelo a ${city}. Acá tiene el oficio judicial y nuestras credenciales.`
      : `Buenas noches. Departamento Extranjería: ${la ? 'una deportada' : 'un deportado'} que vuelve a ${city}, con escolta. Acá está la disposición de expulsión.`;
    L.docs = `Pasaportes de todos, credenciales y ${depa ? 'el oficio' : 'la disposición'}. ${la ? 'Ella' : 'Él'} no habla: por indicación nuestra.`;
    L.minor = `Viajamos ${E.length + 1}: ${p.first} y ${E.map((e) => `${e.first} (${e.sex === 'F' ? 'escolta mujer' : 'escolta'})`).join(' y ')}.`;
    L.reason = depa ? 'Traslado judicial. No puedo dar más detalles.' : 'Cumplimiento de una orden de expulsión.';
    L.ret = 'Nosotros volvemos mañana. ' + (la ? 'Ella' : 'Él') + ' se queda allá.';
    L.visa = 'Todo en regla, con la documentación del traslado.';
    L.health = 'Sin novedades.';
    L.seat = 'Donde corresponda según el procedimiento, por favor.';
    L.bags = `Despachamos ${p.bags.length} valija(s), de los escoltas. ${la ? 'La' : 'El'} ${depa ? 'detenid' : 'deportad'}${la ? 'a' : 'o'} no lleva equipaje.`;
    L.security = 'Las valijas las armamos nosotros y no las perdimos de vista. Nada peligroso.';
    L.valuables = 'No, nada.';
    L.accept = 'Gracias. Embarcamos primero, como siempre.';
    L.reject = 'Entendido. Lo informamos a la superioridad y reprogramamos el traslado.';
  }
  if (p.legal?.type === 'DEPU') {
    L.greet = S('Hola... Migraciones me dio estos papeles. Tengo que volver a mi país hoy.', 'Hi... Immigration gave me these papers. I have to go back home today.', 'Oi... a Migração me deu esses papéis. Tenho que voltar pro meu país hoje.');
    L.reason = S('Me expulsaron. Se me venció la residencia hace dos años... larga historia.', 'I was deported. My residence permit expired two years ago... long story.', 'Fui expulso. Minha residência venceu faz dois anos... longa história.');
    L.ret = S('No vuelvo. Me voy a casa.', "I'm not coming back. I'm going home.", 'Não volto. Vou pra casa.');
  }

  // Pasajeros difíciles (argentinos: hablan en español)
  if (p.scenario === 'vip_angry') {
    L.greet = '(anteojos de sol, de noche) Hola. Supongo que me reconocés, ¿no?';
    L.reason = 'Negocios. Y un evento. Bah, soy el evento.';
    L.seat = 'Business. Y si no hay, que alguien se baje.';
    L.accept = 'Bueno... gracias. Igual voy a dejar una reseña. Capaz que buena, eh.';
    L.reject = '¿¡A MÍ!? ¡Esto lo va a saber el intendente!';
  }
  if (p.scenario === 'angry_cat2') {
    L.greet = '(resoplando, con el celular en la mano) ¡Por fin! ¿Sabés hace cuánto que estoy en esta fila?';
    L.reject = '¡Esto no termina acá! ¡Los voy a denunciar a todos! (se lo llevan, gritando)';
    L.accept = '¡Era hora!';
  }
  if (p.scenario === 'bomb_joke') {
    L.greet = '¡Buenas, buenas! ¿Todo bien? ¡Qué noche, eh! Vengo con todo el humor.';
    L.security = '¿Si llevo algo peligroso? ¡Sí, una bomba! ¡Jajaja! Es un chiste, che, no pongas esa cara.';
    L.bags = '¿La valija? Cuidado al levantarla, que tiene una bomba adentro... ¡Jajaja! Es un chiste, che.';
    L.reject = '¿Todo esto por un chiste? ...Bueno, la próxima me quedo callado.';
  }

  // Sobreventa: ¿acepta ser voluntario?
  L.volYes = S(
    pick(['¿Me pagan por viajar más tarde? ¡Hecho! Total estoy de vacaciones.', 'Si me dan el voucher, me quedo. Mi jefe no se va a enterar.', '¿Transferible? ¡Se lo regalo a mi suegra para que se vaya lejos! Acepto.']),
    pick(["Wait, you'll pay me to fly later? Deal! I'm on vacation anyway.", "A voucher? Sure, I'm in no rush. Sign me up!"]),
    pick(['Vocês me pagam pra viajar mais tarde? Fechado! Tô de férias mesmo.', 'Voucher? Opa, aceito! Ninguém me espera lá mesmo.']),
  );
  L.volNo = S(
    pick(['¡Ni loco! Mañana a la mañana me caso.', 'No puedo, tengo una reunión que no se puede mover.', 'Mi perro me espera... bueno, mi vecino, que lo está cuidando y me odia.', 'No, no, mi vieja me espera en el aeropuerto con milanesas.']),
    pick(['No way, I have a meeting first thing tomorrow.', "Sorry, my mom is picking me up and she's already at the airport. Two hours early."]),
    pick(['Nem pensar, amanhã é o aniversário da minha mãe.', 'Não dá, tenho reunião cedo amanhã.']),
  );
  L.dnbd = S(
    '¿Cómo que no hay lugar si tengo pasaje? ...Bueno, ¿y el voucher es transferible? Por lo menos eso.',
    "What do you mean there's no seat? I have a ticket! ...Fine. Is the voucher at least transferable?",
    'Como assim não tem lugar se eu tenho passagem? ...Tá. Pelo menos o voucher é transferível?',
  );
  L.volunteer = S('¡Perfecto! Me voy a tomar un café con mi voucher... ah, no, llega en 48 horas.', 'Perfect! I\'ll grab a coffee with my voucher... oh wait, it arrives in 48 hours.', 'Perfeito! Vou tomar um café com meu voucher... ah, chega em 48 horas.');

  // Pasajero alcoholizado: varias señales a la vez (habla trabada, incoherencia, actitud)
  if (p.drunk) {
    Object.assign(L, lang === 'en' ? {
      greet: `Heyyy! Iss this the fligh' to ${city}? Hehe... sorry, sorry... (leans on the counter)`,
      docs: "Here... where'd I put it? Oh, here. Is that mine? Hahaha.",
      reason: 'Vacashun! What else? I deserve a vacashun... what did you ask me?',
      ret: 'Come back? No idea, buddy... when do I come back? You check.',
      visa: "Viiisa? Hahaha... what visa? I don't understand a word you're saying.",
      security: "What? The list? (looks away) Yeah, yeah... all good, come on, hurry up, I gotta go to the duty free.",
      bags: 'There\'s the bag... (pushes it and almost falls) Whoa! Hahaha.',
      seat: 'Next to the window... or the bathroom! Hahaha. Whatever.',
      health: "Me? Perfect! Just had a couple of beers, for the flight nerves... okay, four.",
      valuables: "I dunno... why do you care what I'm carrying? (raises his voice)",
      minor: 'Alone, all alone. Well, my buddies are at the bar.',
      reject: "What do you mean I can't fly? Get me your supervisor! This is robbery!",
      derive: "Where? I don't get it... okay, I'm going.",
    } : lang === 'pt' ? {
      greet: `Oiiii! É aqui o voo pra ${city}? Hehe... desculpa, desculpa... (se apoia no balcão)`,
      docs: 'Toma... onde eu coloquei? Ah, aqui. Esse é o meu? Kkkkk.',
      reason: 'Férias! O que mais? Eu mereço umas fériash... o que você perguntou?',
      ret: 'Voltar? Sei lá, cara... quando eu volto? Olha aí você.',
      visa: 'Vistooo? Kkkk... que visto? Não entendo nada do que você fala.',
      security: 'Quê? A lista? (olha para o lado) Sim, sim... tudo certo, vai, rápido que eu vou no free shop.',
      bags: 'Taí a mala... (empurra e quase cai) Opa! Kkkkk.',
      seat: 'Do lado da janela... ou do banheiro! Kkkk. Tanto faz.',
      health: 'Eu? Perfeito! Tomei só umas cervejinhas, pro medo de avião... tá, quatro.',
      valuables: 'Sei lá... o que te importa o que eu levo? (levanta a voz)',
      minor: 'Sozinho, sozinho. Bom, meus amigos estão no bar.',
      reject: 'Como assim não posso viajar? Chama o seu supervisor! Isso é um roubo!',
      derive: 'Pra onde? Não entendi... tá, eu vou.',
    } : {
      greet: `¡Holaaa! ¿E' acá pa'l vuelo a ${city}? Jeje... perdón, perdón... (se apoya en el mostrador)`,
      docs: 'Tomá... ¿dónde lo puse? Ah, acá estaba. ¿Ese era el mío? Jajaja.',
      reason: "¡Vacacione'! ¿Qué otra cosa? Me merezco unas vacacione'... ¿qué me preguntaste?",
      ret: '¿Volver? Ni idea, flaco... ¿cuándo vuelvo? Fijate vos ahí.',
      visa: '¿Viiisa? Jajaja... ¿qué visa? No entiendo nada lo que me decís.',
      security: '¿Qué? ¿La cartilla? (mira para otro lado) Sí, sí... todo bien, dale, apurate que tengo que ir al free shop.',
      bags: 'Ahí está la valija... (la empuja y casi se cae) ¡Uy! Jajaja.',
      seat: '¡Al lado de la ventanilla... o del baño! Jajaja. Lo que sea.',
      health: '¿Yo? ¡Perfecto! Tomé un par de cervezas nomás, para los nervios del avión... bueno, cuatro.',
      valuables: 'No sé... ¿qué te importa lo que llevo? (sube el tono)',
      minor: 'Solo, solito. Bah, con mis amigos que están en el bar.',
      reject: '¿Cómo que no puedo viajar? ¡Llamame al supervisor! ¡Esto es un robo!',
      derive: '¿A dónde? No entiendo... bueno, voy.',
    });
  }
  return L;
}

// ------------------------------------------------------------------
// PUERTA DE EMBARQUE
// ------------------------------------------------------------------
export function gateLines(p, { city, otherCity, country }) {
  const lang = paxLang(p);
  const S = (es, en, pt) => ({ es, en, pt })[lang];
  const o = p.sex === 'F' ? 'a' : 'o';
  const L = {
    greet: S(pick([`Buenas noches, ¿acá es ${city}?`, 'Hola, ¿ya están embarcando?', 'Buenas noches.']), pick([`Hi! Is this the line for ${city}?`, 'Good evening! Are we boarding yet?']), pick([`Boa noite! ${city} é aqui?`, 'Oi! Já está embarcando?'])),
    docs: p.web ? S(pick(['Tome, el pasaporte. La tarjeta la tengo en el celular: hice el check-in por la web, viajo sin valija.', 'Acá tiene. Hice todo por la app, ni pasé por el mostrador. ¡Re práctico!']), "Here's my passport. The boarding pass is on my phone: I checked in online, no checked bags.", 'Aqui o passaporte. O cartão está no celular: fiz o check-in pela internet, sem mala despachada.')
      : S(pick(['Sí, acá tiene.', 'Tome, acá está todo.']), pick(['Sure, here you go.', 'Here you are.']), pick(['Claro, aqui está.', 'Aqui, tudo certinho.'])),
    companion: S(`No, viajo sol${o}.`, "No, I'm traveling alone.", `Não, viajo sozinh${o}.`),
    carry: S('Solo esta mochila, va debajo del asiento.', 'Just this backpack, it goes under the seat.', 'Só esta mochila, vai embaixo do assento.'),
    visa: p.nationality === 'US' ? "I'm American, I'm going home." : S('Sí, la visa está en el pasaporte.', "Yes, the visa's in my passport.", 'Sim, o visto está no passaporte.'),
    gvisa: null,
    ret: p.nationality === country ? S('¿Regreso? Soy de allá, vuelvo a casa.', "I'm a citizen, I'm going home!", 'Sou de lá, estou voltando para casa.')
      : p.booking && !p.booking.returnDate && p.docs?.some((d) => d.type === 'RESIDENCE') ? S('No tengo vuelta, vivo allá. Acá está mi residencia.', "No return, I live there. Here's my residence card.", 'Não tenho volta, moro lá. Aqui está minha residência.')
        : S(pick(['Sí, vuelvo en dos semanas, lo tengo en el mail.', 'Sí, ida y vuelta, ¿quiere ver la reserva?']), 'Yes, round trip, I have it in my email.', 'Sim, ida e volta, está no meu e-mail.'),
    vape: S(pick(['¿Fumar? No, no fumo, tranqui.', 'No, nada, ni chicle tengo.']), "Smoking? No, I don't smoke, don't worry.", 'Fumar? Não, eu não fumo, relaxa.'),
    board: S('¡Gracias!', 'Thanks!', `Obrigad${o}!`),
    wait: S('Ah, perdón, espero entonces.', "Oh, sorry, I'll wait then.", 'Ah, desculpa, eu espero então.'),
    hold: S('Bueno, espero acá al costado.', "Okay, I'll wait over here.", 'Tá bom, espero aqui do lado.'),
    deny: S('¿Cómo que no puedo subir? ...', "What do you mean I can't board? ...", 'Como assim não posso embarcar? ...'),
    redirect: S('¡Uy! ¿Me equivoqué de puerta? ¡Gracias, voy corriendo!', 'Oh no! Wrong gate? Thanks, running!', 'Nossa! Portão errado? Obrigad' + o + ', vou correndo!'),
    vapeOk: null, gd: S('Perfecto, gracias.', 'Perfect, thanks.', 'Perfeito, obrigad' + o + '.'), reseat: S('Ah, bueno, no hay problema.', 'Oh, okay, no problem.', 'Ah, tudo bem, sem problema.'),
  };
  switch (p.kind) {
    case 'wchr': Object.assign(L, {
      greet: S('Buenas noches, me trae el asistente en la silla. Me dijeron que subo primero.', 'Good evening, the assistant brought me in the wheelchair. They said I board first.', 'Boa noite, o assistente me trouxe na cadeira de rodas. Disseram que embarco primeiro.'),
      companion: S(`Viajo sol${o}, pero pedí la silla de ruedas.`, 'Alone, but I requested the wheelchair.', `Sozinh${o}, mas pedi a cadeira de rodas.`),
    }); break;
    case 'inf_stroller': Object.assign(L, {
      greet: S('Hola, ¿puedo pasar con el bebé? Hace una hora que no duerme, ¡ayuda!', "Hi, can I go ahead with the baby? He hasn't slept in an hour, help!", 'Oi, posso passar com o bebê? Faz uma hora que ele não dorme, socorro!'),
      companion: S('Con mi bebé de 8 meses, viaja en brazos.', 'With my 8-month-old, he flies on my lap.', 'Com meu bebê de 8 meses, vai no colo.'),
      carry: S('El bolso del bebé y el cochecito. ¿El cochecito lo dejo acá o me lo llevo?', 'The diaper bag and the stroller. Do I leave the stroller here or take it?', 'A bolsa do bebê e o carrinho. Deixo o carrinho aqui ou levo?'),
    }); break;
    case 'senior_zone4': L.greet = S('Buenas noches. Tengo zona 4 pero me dijeron que los mayores pasamos primero, ¿es así? Tengo 74 y la rodilla de 90.', "Good evening. I have zone 4, but I was told seniors board first, is that right? I'm 74 with the knees of a 90-year-old.", 'Boa noite. Tenho zona 4, mas disseram que os idosos passam primeiro, é isso? Tenho 74 e o joelho de 90.'); break;
    case 'early': Object.assign(L, {
      greet: S('Hola, ¿puedo ir pasando? Así me aseguro lugar para la valija de mano.', 'Hi, can I go ahead? I want to make sure there\'s room for my carry-on.', 'Oi, posso ir passando? Para garantir lugar para a mala de mão.'),
      wait: S('Uf... bueno, espero que llamen mi zona.', "Ugh... fine, I'll wait for my zone.", 'Ufa... tá, espero chamarem minha zona.'),
    }); break;
    case 'influencer': Object.assign(L, {
      greet: S('¡Hola! Soy @lu.viaja, 300 mil seguidores 💅 ¿Me hacés pasar primero? Te etiqueto en la story.', "Hiii! I'm @lu.travels, 300K followers 💅 Can I board first? I'll tag you in my story.", 'Oiê! Sou @lu.viaja, 300 mil seguidores 💅 Me deixa passar primeiro? Te marco nos stories.'),
      wait: S('¿En serio? Bueno... igual te etiqueto. Pero con cara triste. 😢', "Seriously? Fine... I'll still tag you. With a sad face. 😢", 'Sério? Tá... vou te marcar mesmo assim. Com carinha triste. 😢'),
      companion: S('Con mi ring light y mi trípode, nada más.', 'Just me, my ring light and my tripod.', 'Só eu, meu ring light e meu tripé.'),
    }); break;
    case 'vaper': Object.assign(L, {
      greet: S('(exhala una nube de vapor con olor a sandía) ¡Holis! ¿Ya embarcamos?', '(blows a watermelon-scented cloud) Heyy! Are we boarding?', '(solta uma nuvem com cheiro de melancia) Oi! Já vamos embarcar?'),
      vape: S('Ay, perdón, perdón, ya lo guardo. Es de sandía, ¿querés probar? ...No, claro, no.', "Oops, sorry, sorry, putting it away. It's watermelon, wanna try? ...No, of course not.", 'Ai, desculpa, já guardo. É de melancia, quer provar? ...Não, claro que não.'),
      deny: S('¿Por un vapeador no me dejás subir? ¡Si ya lo guardé!', "You won't let me board over a vape? I already put it away!", 'Não vai me deixar embarcar por causa de um vape? Já guardei!'),
    }); break;
    case 'dutyfree': Object.assign(L, {
      carry: S('Dos bolsas del free shop: whisky, perfumes, alfajores para mi tía... ¡y un Toblerone gigante! Y la valija de mano, claro. Entra todo, ¿no?', "Two duty-free bags: whisky, perfume, alfajores for my aunt... and a giant Toblerone! Plus my carry-on, of course. It all fits, right?", 'Duas sacolas do free shop: uísque, perfume, alfajores pra minha tia... e um Toblerone gigante! E a mala de mão, claro. Cabe tudo, né?'),
      gd: S('¡Pero cuidado con el Toblerone, eh!', 'Careful with the Toblerone, okay?!', 'Cuidado com o Toblerone, hein!'),
    }); break;
    case 'dead_phone': Object.assign(L, {
      greet: S('¡Se me murió el celular! Tenía la tarjeta de embarque ahí... ¿me la podés imprimir? Prometo cargar el celu.', 'My phone died! My boarding pass was on it... can you print it? I promise I\'ll charge it.', 'Meu celular morreu! O cartão de embarque estava nele... pode imprimir? Prometo carregar o celular.'),
      docs: S('Tengo el pasaporte, la tarjeta estaba en el celu... que está muerto. Descanse en paz.', 'I have my passport. The boarding pass was on my phone... which is dead. Rest in peace.', 'Tenho o passaporte, o cartão estava no celular... que morreu. Descanse em paz.'),
    }); break;
    case 'wrong_flight': L.greet = S(`Hola, ¿embarca acá el vuelo a ${otherCity}?... ah, no sé, me dijeron esta puerta.`, `Hi, is this where the ${otherCity} flight boards? ...Not sure, they told me this gate.`, `Oi, é aqui o embarque para ${otherCity}? ...Sei lá, me disseram este portão.`); break;
    case 'exit_minor': Object.assign(L, {
      greet: S('Hola, mi mamá ya pasó. Ella está en la fila 27, a mí me tocó otro asiento.', 'Hi, my mom already boarded. She\'s in row 27, I got a different seat.', 'Oi, minha mãe já entrou. Ela está na fila 27, eu fiquei em outro lugar.'),
      companion: S('Con mi mamá, pero nos sentaron separados. Tengo 14.', "With my mom, but we're not sitting together. I'm 14.", 'Com minha mãe, mas sentamos separados. Tenho 14.'),
    }); break;
    case 'pet_exit': Object.assign(L, {
      carry: S('Mi perrita en su bolso, son 6 kilos con el transportín.', 'My little dog in her bag, 6 kilos with the carrier.', 'Minha cachorrinha na bolsa, são 6 quilos com a caixa.'),
      companion: S('Con mi perrita, Luna. Ella también quiere ventanilla.', 'With my dog, Luna. She wants the window too.', 'Com minha cachorrinha, Luna. Ela também quer janela.'),
    }); break;
    case 'name_mismatch': case 'partner': Object.assign(L, {
      docs: S('Acá tiene... (le entrega una tarjeta y su pasaporte)', 'Here you go... (hands you a boarding pass and passport)', 'Aqui... (entrega um cartão e o passaporte)'),
      companion: p.kind === 'partner'
        ? S('Con mi pareja, pasó hace un rato por acá.', 'With my partner, they came through a little while ago.', 'Com meu parceiro, passou por aqui faz pouco.')
        : S('Con mi pareja, viene más atrás, fue al baño. Las tarjetas las imprimimos juntas.', 'With my partner, they went to the restroom. We printed our passes together.', 'Com meu parceiro, foi ao banheiro. Imprimimos os cartões juntos.'),
      hold: S('Ah, ¿me cambié la tarjeta con mi pareja? ¡Típico! Bueno, espero acá al costado.', "Wait, I swapped passes with my partner? Typical! Okay, I'll wait over here.", 'Ué, troquei o cartão com meu parceiro? Típico! Tá, espero aqui do lado.'),
      returnOk: S('Ya está, nos habíamos cambiado las tarjetas. Ahora cada uno tiene la suya. Perdón, es que somos iguales... de despistados.', "All sorted, we'd swapped passes. Now we each have our own. Sorry, we're equally... scatterbrained.", 'Pronto, tínhamos trocado os cartões. Agora cada um tem o seu. Desculpa, somos iguais... de distraídos.'),
      returnBad: S('Mi pareja ya subió... y yo me quedé con una tarjeta que no es mía.', "My partner already boarded... and I'm stuck with a pass that isn't mine.", 'Meu parceiro já embarcou... e eu fiquei com um cartão que não é meu.'),
    }); break;
    case 'dup_bp': Object.assign(L, {
      greet: S('Hola, mi pareja ya embarcó. Imprimimos las tarjetas en casa... creo que la impresora se trabó.', 'Hi, my partner already boarded. We printed the passes at home... I think the printer jammed.', 'Oi, meu parceiro já embarcou. Imprimimos os cartões em casa... acho que a impressora travou.'),
      docs: S('Tome, mi tarjeta y el pasaporte.', "Here's my pass and passport.", 'Aqui, meu cartão e o passaporte.'),
      companion: S('Con mi pareja, que ya subió al avión.', 'With my partner, who already boarded.', 'Com meu parceiro, que já embarcou.'),
    }); break;
    case 'gate_volunteer': Object.assign(L, {
      greet: S('Escuché el anuncio: ¿todavía buscan voluntarios? Yo puedo viajar más tarde.', "I heard the announcement: still looking for volunteers? I can fly later.", 'Ouvi o anúncio: ainda precisam de voluntários? Eu posso viajar mais tarde.'),
      volunteer: S('¡Genial! Con el voucher me voy de nuevo en marzo.', "Awesome! With that voucher I'm flying again in March.", 'Ótimo! Com o voucher eu viajo de novo em março.'),
    }); break;
    case 'standby': Object.assign(L, {
      greet: S('¡Me llamaron del stand-by! ¿Entonces viajo hoy? ¡Y yo que ya estaba gastando el voucher en mi cabeza!', "They called me from stand-by! So I'm flying tonight? I was already spending that voucher in my head!", 'Me chamaram do stand-by! Então eu viajo hoje? E eu já estava gastando o voucher na cabeça!'),
      comp: S('Bueno, no hubo lugar... pero con el voucher me tomo revancha. ¡Gracias!', 'Well, no seat... but the voucher makes up for it. Thanks!', 'Bom, não teve lugar... mas com o voucher eu me vingo. Obrigado!'),
    }); break;
    case 'no_seat': Object.assign(L, {
      greet: S('Hola, en el counter me dijeron que el asiento me lo daban en la puerta... ¿ya tienen?', "Hi, at check-in they said I'd get my seat at the gate... do you have one?", 'Oi, no check-in disseram que o assento eu recebia no portão... já tem?'),
      reseat: S('¡Uf, qué alivio! Gracias.', 'Phew, what a relief! Thanks.', 'Ufa, que alívio! Obrigado.'),
      dnbd: S('¿Cómo que me quedo? ...Bueno, al menos el próximo vuelo y la compensación. Mañana te traigo el reclamo enmarcado.', "I'm staying behind? ...Okay, at least I get the next flight and compensation.", 'Vou ficar? ...Tá, pelo menos tem o próximo voo e a compensação.'),
    }); break;
    case 'inop_seat': Object.assign(L, {
      greet: S('Hola. Hice el check-in por la web, me tocó el 20A. ¡Ventanilla!', 'Hi! I checked in online, I got 20A. Window seat!', 'Oi! Fiz o check-in pelo site, fiquei no 20A. Janela!'),
      reseat: S('¿El asiento está roto? Mejor cambiarlo que viajar acostado... gracias.', "The seat is broken? Better to change it than fly lying down... thanks.", 'O assento está quebrado? Melhor trocar do que viajar deitado... obrigado.'),
    }); break;
    case 'depa': Object.assign(L, {
      greet: `(un escolta muestra la credencial) Buenas noches. Policía: traslado de ${p.sex === 'F' ? 'una detenida' : 'un detenido'} con dos escoltas. Embarcamos primero, ¿no?`,
      docs: 'Las tres tarjetas, los pasaportes y el oficio judicial.',
      companion: `Somos dos escoltas con ${p.sex === 'F' ? 'la detenida' : 'el detenido'}. Fila 30, como corresponde.`,
      carry: 'Una mochila cada uno. El detenido no lleva nada.',
      board: 'Gracias. (embarcan los tres)',
    }); break;
    case 'gate_carryon': Object.assign(L, {
      greet: '¡Hola! Zona 4, ¿ya subo? (arrastra una valija enorme, una mochila y una almohada de viaje)',
      carry: '¿La valija? Va arriba conmigo, como siempre. ¿Por qué?',
      gd: 'Bueno... cuidámela, eh. Es nueva.',
    }); break;
    case 'gate_smoker': Object.assign(L, {
      greet: '(fumando un cigarrillo en la fila, a metros del podio) Buenas. ¿Ya subimos?',
      docs: '(con el cigarrillo en la boca) Tomá, acá tenés.',
      vape: 'Es el último, dejame terminarlo...',
      deny: '¡Por un pucho! ¡Esto es un abuso! ¡Los voy a denunciar!',
    }); break;
    case 'gate_rage': Object.assign(L, {
      greet: '(llega resoplando, con la tarjeta arrugada en la mano) ¡Necesito hablar con alguien YA!',
      docs: '¡Tomá! ¡Y explicame por qué estoy en el 27B y mi señora en el 14A!',
      companion: 'Con mi señora... ¡que el sistema mandó a otra fila!',
      deny: '¡ESTO NO QUEDA ASÍ! ¡Yo pagué!',
    }); break;
    case 'web_yesterday': Object.assign(L, {
      greet: S('¡Hola! Ayer me quedé dormido y perdí el vuelo... pero es el mismo vuelo, a la misma hora. La tarjeta sirve igual, ¿no?', "Hi! I overslept yesterday and missed my flight... but it's the same flight, same time. The boarding pass still works, right?", 'Oi! Ontem perdi a hora e o voo... mas é o mesmo voo, no mesmo horário. O cartão vale igual, né?'),
      deny: S('¿Cómo que no? ¡Si es el mismo avión! ...Bueno, ¿dónde queda Ventas?', "What? It's the same plane! ...Fine, where's the ticket office?", 'Como não? É o mesmo avião! ...Tá, onde fica a venda de passagens?'),
    }); break;
    case 'no_return': case 'carry_ret': L.ret = S('¿La vuelta? No, la compro allá cuando vea cómo me va. ¡Me voy a probar suerte!', "Return ticket? No, I'll buy it there once I see how it goes. I'm trying my luck!", 'A volta? Não, compro lá quando ver como vai. Vou tentar a sorte!'); break;
    case 'drunk': Object.assign(L, lang === 'en' ? {
      greet: 'Heyyy! Iss the plane leaving yet? Hahaha... (leans on the podium)',
      docs: "Here... where is it? Oh, here. Oops, dropped it. Haha.",
      companion: 'Alone! Well, my buddies are at the duty free... STILL! Hahaha.',
      carry: "Why d'you care what I'm carrying? (raises his voice)",
      visa: "The visa? Here, you look, I don't remember...",
      vape: 'And who are YOU to tell me what to do? Hahaha, just kidding... or am I?',
      deny: "What d'you mean I can't board?! Get me your boss! I paid for this ticket!",
    } : lang === 'pt' ? {
      greet: 'Boa noiteee! O avião já vai sair? Kkkk... (se apoia no balcão)',
      docs: 'Toma... cadê? Ah, aqui. Opa, caiu. Kkk.',
      companion: 'Sozinho! Bom, meus amigos estão no free shop... AINDA! Kkkk.',
      carry: 'O que te importa o que eu levo? (levanta a voz)',
      visa: 'O visto? Toma, olha você, não lembro...',
      vape: 'E quem é você pra me dizer o que fazer? Kkkk, brincadeira... ou não?',
      deny: 'Como assim não embarco?! Chama o seu chefe! Eu paguei a passagem!',
    } : {
      greet: '¡Buenaaas! ¿Ya sale el avión? Jajaja... (se apoya en el podio)',
      docs: 'Tomá... ¿dónde está? Ah, acá. Uy, se me cayó. Jaja.',
      companion: '¡Solo! Bah, mis amigos están en el free shop... ¡TODAVÍA! Jajaja.',
      carry: '¿Qué te importa lo que llevo? (sube el tono)',
      visa: '¿La visa? Tomá, fijate vos, no me acuerdo...',
      vape: '¿Y vos quién sos para decirme qué hacer? Jajaja, mentira... ¿o no?',
      deny: '¡¿Cómo que no subo?! ¡Llamame a tu jefe! ¡Pagué el pasaje!',
    }); break;
  }
  // Con familia o acompañantes, nunca "viajo solo/a": nombra a los que viajan con él o ella
  const comp = (p.party?.members || []).filter((m) => m.role !== 'escort');
  if (comp.length && p.party.relation !== 'custody') {
    const names = comp.map((m) => m.first);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0];
    const listEn = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    L.companion = S(`No, viajamos juntos: yo, ${list}.`, `No, we're traveling together: me, ${listEn}.`, `Não, viajamos juntos: eu, ${list.replace(' y ', ' e ')}.`);
  }
  return L;
}

// Saludos especiales en la puerta (pasajeros que vienen del check-in, dormidos, demorados)
export function gateGreeting(p, kind) {
  const lang = paxLang(p);
  const S = (es, en, pt) => ({ es, en, pt })[lang];
  switch (kind) {
    case 'carry': return S(pick(['¡Hola de nuevo! Usted me hizo el check-in, ¿se acuerda?', '¡Otra vez usted! ¿Hace todo en este aeropuerto?', '¡Qué suerte, la misma persona del mostrador! Así ya me conoce.']), pick(['Hi again! You checked me in, remember?', 'You again! Do you run this whole airport?']), pick(['Oi de novo! Foi você que fez meu check-in, lembra?', 'Você de novo! Você faz tudo neste aeroporto?']));
    case 'drunk': return S('¡Eeeh, mi agente favorito! ¿Te acordás de mí? Pasé por el bar a festejar que me hiciste el check-in. Jajaja.', "Heyyy, my favorite agent! Remember me? I hit the bar to celebrate my check-in. Hahaha.", 'Ôôô, meu atendente favorito! Lembra de mim? Passei no bar pra comemorar o check-in. Kkkk.');
    case 'sleeper': return S('(bostezando, con marca de la mochila en la cara) ¿Ya embarcamos? Me recosté un minutito nomás...', '(yawning, with a backpack print on his face) Are we boarding? I just closed my eyes for a minute...', '(bocejando, com a marca da mochila no rosto) Já vamos embarcar? Só fechei os olhos um minutinho...');
    case 'late_runner': return S('¡Llegué! (agitado) Escuché mi nombre por los parlantes... ¡estaba eligiendo un perfume!', "I'm here! (out of breath) I heard my name on the speakers... I was picking a perfume!", 'Cheguei! (ofegante) Ouvi meu nome no alto-falante... estava escolhendo um perfume!');
    default: return null;
  }
}
