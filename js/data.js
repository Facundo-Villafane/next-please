// =====================================================================
//  DATOS DEL JUEGO — editable por el instructor
//  Las reglas documentarias están SIMPLIFICADAS con fines didácticos.
//  En la operación real siempre se consulta Timatic / IATA Travel Centre.
// =====================================================================

export const AIRLINE = { code: 'AP', name: 'Aeroplata', ticketPrefix: '960' };

export const STATION = {
  code: 'EZE',
  name: 'Aeropuerto Internacional Ministro Pistarini',
  city: 'Buenos Aires',
  country: 'AR',
};

// Hora de inicio del turno (hora del juego) y velocidad del reloj.
export const SHIFT_START = '18:15';
export const REAL_SECONDS_PER_GAME_MINUTE = 15;

// Tiempos según la Guía de Atención al Pasajero (Unidad 4): internacional abre −180 y cierra −70 STD.
// open / close = minutos antes del STD.
export const FLIGHTS = [
  { no: 'AP1250', dest: 'GRU', city: 'São Paulo', country: 'BR', dep: '19:40', gate: 'A5', aircraft: 'Boeing 737-800', open: 180, close: 70 },
  { no: 'AP1180', dest: 'SCL', city: 'Santiago de Chile', country: 'CL', dep: '20:50', gate: 'A9', aircraft: 'Boeing 737 MAX 8', open: 180, close: 70 },
  { no: 'AP1050', dest: 'MAD', city: 'Madrid', country: 'ES', dep: '21:05', gate: 'B12', aircraft: 'Airbus A330-200', open: 180, close: 70 },
  { no: 'AP1100', dest: 'MIA', city: 'Miami', country: 'US', dep: '21:25', gate: 'B7', aircraft: 'Airbus A330-200', open: 180, close: 70 },
  { no: 'AP1254', dest: 'GRU', city: 'São Paulo', country: 'BR', dep: '22:30', gate: 'A3', aircraft: 'Boeing 737-800', open: 180, close: 70 },
  { no: 'AP1184', dest: 'SCL', city: 'Santiago de Chile', country: 'CL', dep: '23:00', gate: 'A7', aircraft: 'Boeing 737 MAX 8', open: 180, close: 70 },
  { no: 'AP1104', dest: 'MIA', city: 'Miami', country: 'US', dep: '23:50', gate: 'B9', aircraft: 'Boeing 787-9', open: 180, close: 70 },
  // Cabotaje (Guía U4: apertura −120, cierre −50)
  { no: 'AP2730', dest: 'BRC', city: 'Bariloche', country: 'AR', dep: '20:10', gate: 'C2', aircraft: 'Airbus A320', open: 120, close: 50 },
  { no: 'AP2760', dest: 'IGR', city: 'Puerto Iguazú', country: 'AR', dep: '21:40', gate: 'C4', aircraft: 'Airbus A320', open: 120, close: 50 },
];
// Documentos de excepción que se aceptan sólo en vuelos de cabotaje (extravío o robo del DNI)
export const DOMESTIC_DOCS = ['DRIVER_LICENSE', 'POLICE_REPORT', 'DNI_TRAMITE'];

export const COUNTRIES = {
  AR: { iso3: 'ARG', name: 'Argentina', idName: 'DNI (tarjeta)', lang: 'es' },
  BR: { iso3: 'BRA', name: 'Brasil', idName: 'RG – Cédula de Identidade', lang: 'pt' },
  UY: { iso3: 'URY', name: 'Uruguay', idName: 'Cédula de Identidad', lang: 'es' },
  CL: { iso3: 'CHL', name: 'Chile', idName: 'Cédula de Identidad', lang: 'es' },
  ES: { iso3: 'ESP', name: 'España', idName: 'DNI español', lang: 'es' },
  US: { iso3: 'USA', name: 'Estados Unidos', idName: null, lang: 'en' },
};

// Requisitos de ingreso por país de DESTINO (versión didáctica tipo Timatic).
//  idCardOk : nacionalidades que pueden viajar con documento de identidad (no pasaporte)
//  visa     : nacionalidad -> tipo de documento de visa requerido
//  esta     : nacionalidades que requieren autorización electrónica (ESTA)
//  validity : 'stay'        -> documento vigente durante toda la estadía (hasta el regreso)
//             'afterReturn' -> vigente N meses posteriores a la fecha de regreso
export const ENTRY_RULES = {
  AR: {
    name: 'Argentina (cabotaje)',
    idCardOk: ['AR', 'BR', 'UY', 'CL'],
    visa: {},
    esta: [],
    validity: { kind: 'stay' },
    notes: [
      'Vuelo NACIONAL: el pasajero presenta su documento de viaje vigente en el counter y al embarcar. Sin documento no puede embarcar.',
      'Excepciones por extravío o robo: licencia de conducir VIGENTE, denuncia policial o certificado de trámite del documento.',
      'Extranjeros: pasaporte o documento de identidad del Mercosur vigente.',
      'Menores de 14 años viajan acompañados; de 14 a 17 solos, con su documento y un poder simple de al menos uno de los padres.',
      'El agente ingresa obligatoriamente los datos del documento en el sistema (todos los pasajeros de la reserva, incluidos los infantes). Control previo al embarque: PSA.',
    ],
  },
  BR: {
    name: 'Brasil',
    idCardOk: ['AR', 'UY', 'CL', 'BR'],
    visa: { US: 'EVISA_BR' },
    esta: [],
    validity: { kind: 'stay' },
    notes: [
      'Nacionales de Argentina, Uruguay y Chile (Mercosur y asociados) pueden ingresar con documento de identidad vigente. Para Argentina: DNI tarjeta (no se acepta constancia de DNI en trámite).',
      'Ciudadanos de Estados Unidos requieren e-Visa (exigencia vigente desde el 10/04/2025).',
      'Españoles: exentos de visa hasta 90 días.',
      'El documento debe estar vigente durante toda la estadía.',
    ],
  },
  CL: {
    name: 'Chile',
    idCardOk: ['AR', 'UY', 'BR', 'CL'],
    visa: {},
    esta: [],
    validity: { kind: 'stay' },
    notes: [
      'Nacionales de Argentina, Uruguay y Brasil pueden ingresar con documento de identidad vigente.',
      'Españoles y estadounidenses: exentos de visa como turistas (hasta 90 días).',
      'El documento debe estar vigente durante toda la estadía.',
    ],
  },
  ES: {
    name: 'España (Espacio Schengen)',
    idCardOk: ['ES'],
    visa: {},
    esta: [],
    validity: { kind: 'afterReturn', months: 3 },
    returnTicket: true, residence: 'Tarjeta de Identidad de Extranjero (TIE)',
    notes: [
      'Pasaporte con validez mínima de 3 MESES posteriores a la fecha prevista de salida del Espacio Schengen.',
      'Argentina, Brasil, Uruguay, Chile y EE.UU.: exentos de visa para estancias de hasta 90 días en un período de 180.',
      'Visitantes NO residentes: pasaje de regreso o de continuación de viaje (además, Migraciones puede pedir reserva de alojamiento y medios económicos). Los residentes presentan su permiso de residencia (TIE).',
      'Ciudadanos españoles: DNI o pasaporte vigente.',
    ],
  },
  US: {
    name: 'Estados Unidos',
    idCardOk: [],
    visa: { AR: 'VISA_US', BR: 'VISA_US', UY: 'VISA_US' },
    esta: ['ES', 'CL'],
    validity: { kind: 'stay' },
    returnTicket: true, residence: 'Permanent Resident Card (Green Card)',
    notes: [
      'Por vía aérea se requiere PASAPORTE en todos los casos (no se aceptan documentos de identidad).',
      'Argentina, Brasil y Uruguay NO integran el Programa de Exención de Visas (VWP): requieren visa (p. ej. B1/B2) vigente.',
      'Una visa vigente en un pasaporte VENCIDO sigue siendo válida si el pasajero presenta AMBOS pasaportes (el vencido con la visa + el nuevo vigente) y los datos personales coinciden.',
      'España y Chile integran el VWP: requieren ESTA aprobado. Verificar la respuesta APIS/iAPI (OK TO BOARD / DO NOT BOARD).',
      'Pasaporte vigente durante la estadía (los países de este juego integran el "six-month club").',
      'APIS obligatorio antes de emitir la tarjeta de embarque.',
      'Visitantes NO residentes: pasaje de regreso o de continuación de viaje. Los residentes permanentes presentan su Green Card (y no necesitan visa).',
    ],
  },
};

// Reglas de salida desde Argentina (menores).
export const EXIT_RULES_AR = [
  'Menores de 18 años residentes en Argentina que viajan SIN alguno de sus padres (o sin ambos) necesitan Autorización de Viaje firmada por el/los progenitor/es que no viajan, ante escribano público, Registro Civil o autoridad competente.',
  'La autorización debe nombrar al menor, indicar destino ("todos los países" o país específico) y estar vigente.',
  'Además de la autorización, el menor debe presentar documento de viaje válido para el destino.',
];

// Tarifas y franquicia de equipaje
export const FARES = {
  LIGHT: { label: 'Light', cabin: 'Y', pieces: 0, kg: 23 },
  STANDARD: { label: 'Standard', cabin: 'Y', pieces: 1, kg: 23 },
  FLEX: { label: 'Flex', cabin: 'Y', pieces: 2, kg: 23 },
  BUSINESS: { label: 'Business', cabin: 'J', pieces: 2, kg: 32 },
};
export const BAG_FEES = { overweight: 100, extraPiece: 120, maxKg: 32, currency: 'USD' };

// Menores no acompañados (política de la aerolínea ficticia)
export const UM_POLICY = { mandatoryFrom: 5, mandatoryTo: 13, optionalTo: 17, minAge: 5 };

// Salidas de emergencia (Guía U4 · Asignación de asientos)
export const EXIT_ROW = {
  minAge: 15,
  languages: ['es', 'en'],
  bannedSsr: {
    WCHR: 'tiene movilidad reducida (WCHR)', WCHS: 'tiene movilidad reducida (WCHS)', WCHC: 'tiene movilidad reducida (WCHC)',
    WCBD: 'viaja con silla de ruedas propia (WCBD)', WCBW: 'viaja con silla de ruedas propia (WCBW)',
    PETC: 'viaja con mascota en cabina (PETC)', BLND: 'es no vidente (BLND)', DEAF: 'tiene audición reducida (DEAF)',
    PPOC: 'usa concentrador de oxígeno portátil (PPOC)',
  },
};

// Pasajeras gestantes (Guía U4 · Seguridad)
export const PREGNANCY = { freeUntil: 28, certUntil: 38, certMaxDays: 10, specialty: 'Ginecología y Obstetricia' };

// Cabina (mapa de asientos simplificado, igual para todos los vuelos)
export const SEATMAP = {
  businessRows: [1, 2, 3],
  businessCols: ['A', 'C', 'D', 'F'],
  economyRows: [4, 30],
  economyCols: ['A', 'B', 'C', 'D', 'E', 'F'],
  exitRows: [14, 15],
};

// Penalidades orientativas por pasajero inadmisible (INAD)
export const INAD_FINE = 'USD 3.000 – 5.000 + costo del vuelo de retorno';

// ------------------------------------------------------------------
//  Nombres
// ------------------------------------------------------------------
export const NAMES = {
  AR: {
    M: ['Juan Pablo', 'Martín', 'Lucas', 'Facundo', 'Diego', 'Santiago', 'Matías', 'Nicolás', 'Gonzalo', 'Federico', 'Ezequiel', 'Tomás', 'Ricardo', 'Carlos Alberto', 'Hernán'],
    F: ['María Laura', 'Lucía', 'Valentina', 'Florencia', 'Camila', 'Agustina', 'Sofía', 'Carolina', 'Gabriela', 'Romina', 'Paula', 'Silvia', 'Mariana', 'Julieta', 'Ana Clara'],
    last: ['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Pérez', 'Gómez', 'Sánchez', 'Romero', 'Díaz', 'Álvarez', 'Torres', 'Ruiz', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Aguirre', 'Pereyra', 'Sosa', 'Giménez', 'Ferrari', 'Rossi', 'Bianchi'],
  },
  BR: {
    M: ['João', 'Pedro', 'Gabriel', 'Rafael', 'Lucas', 'Thiago', 'Bruno', 'Felipe'],
    F: ['Ana Beatriz', 'Mariana', 'Juliana', 'Fernanda', 'Larissa', 'Camila', 'Beatriz', 'Letícia'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Carvalho', 'Almeida', 'Ribeiro'],
  },
  UY: {
    M: ['Joaquín', 'Rodrigo', 'Sebastián', 'Andrés', 'Pablo'],
    F: ['Natalia', 'Victoria', 'Lorena', 'Micaela', 'Andrea'],
    last: ['Rodríguez', 'Pereira', 'Silva', 'Martínez', 'Fernández', 'Núñez', 'Cabrera'],
  },
  CL: {
    M: ['Cristóbal', 'Benjamín', 'Vicente', 'Ignacio', 'Felipe'],
    F: ['Javiera', 'Constanza', 'Catalina', 'Francisca', 'Antonia'],
    last: ['Muñoz', 'Rojas', 'Soto', 'Contreras', 'Silva', 'Araya', 'Espinoza'],
  },
  ES: {
    M: ['Alejandro', 'Javier', 'Pablo', 'Sergio', 'Álvaro', 'Daniel'],
    F: ['Lucía', 'Marta', 'Elena', 'Paula', 'Irene', 'Carmen'],
    last: ['García', 'Martín', 'Jiménez', 'Navarro', 'Moreno', 'Ruiz', 'Iglesias', 'Ortega'],
  },
  US: {
    M: ['Michael', 'James', 'Robert', 'David', 'Kevin', 'Brian'],
    F: ['Jennifer', 'Emily', 'Sarah', 'Jessica', 'Ashley', 'Megan'],
    last: ['Smith', 'Johnson', 'Brown', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor'],
  },
};

// Problemas documentales que frena el control previo al embarque:
// Migraciones en vuelos internacionales, PSA en cabotaje. Esos pasajeros nunca llegan a la puerta.
export const EXIT_CONTROL_CODES = ['DOC_EXPIRED', 'DOC_VALIDITY', 'DOC_TYPE', 'VISA', 'ESTA', 'IDENTITY', 'MINOR_AUTH', 'FILIATION', 'PARENT_DEATH', 'GUARDIAN'];
export const exitControl = (flight) => (flight.country === STATION.country ? 'PSA' : 'Migraciones');
export const EXIT_CONTROL_REASON = {
  DOC_EXPIRED: 'documento de viaje vencido', DOC_VALIDITY: 'validez del documento insuficiente para el destino', DOC_TYPE: 'documento no válido para el destino',
  VISA: 'sin visa vigente para el destino', ESTA: 'sin ESTA aprobada', IDENTITY: 'la persona no coincide con el documento que presentó',
  MINOR_AUTH: 'falta la autorización de viaje de los menores', FILIATION: 'no acreditan el vínculo con los menores', PARENT_DEATH: 'falta el certificado de defunción del otro progenitor', GUARDIAN: 'no acredita la tutela de los menores',
};
