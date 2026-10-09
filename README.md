# Next, please! · Simulador de Check-in EZE

Juego web educativo: el alumno es agente de check-in en Ezeiza y atiende pasajeros
verificando documentación, requisitos de ingreso, reserva, APIS, equipaje, mercancías
peligrosas y asiento, y decide **Aceptar / No aceptar / Derivar**. Cada atención se
evalúa con una explicación, y al final del turno se genera un informe imprimible.

## Modo Historia

"Tu primer mes en Aeroplata": sos agente recién ingresado/a. Cada día: diálogo con la supervisora
(Marta), **briefing** del vuelo (ocupación, SSR, asientos inoperativos, novedades), **check-in** de ese
vuelo y **embarque** del mismo vuelo con los pasajeros que aceptaste (si se te pasó alguien en el
counter, tenés otra oportunidad en la puerta). El Día 1 incluye un tutorial guiado. Los días se
desbloquean y se puntúan con estrellas. Días configurables en `js/career.js` (`DAYS`):

1. Bienvenida a Aeroplata · São Paulo (un vuelo, tutorial)
2. Rumbo a Miami · visas, ESTA, katana, asado con hielo seco, tarjetas cruzadas, **sobreventa en el counter** (voluntarios con opción de stand-by que se resuelve en la puerta) y asiento inoperativo
3. Doble mostrador · Santiago + Madrid, contra reloj
4. Hora pico · tres vuelos, contra reloj, **sobreventa en el embarque** (pasajeros sin asiento)

## Puestos de trabajo (Práctica libre)

- **Counter de check-in**: atención de pasajeros en el mostrador (ver casos abajo).
- **Puerta de embarque** (vuelo AP1100 a Miami): apertura de puerta (sistema, materiales, layout,
  PMR), autorización de la tripulación, anuncios de preembarque / embarque / llamado final / llamado
  por nombre (textos de la guía), embarque por zonas, control en el podio (escaneo BGR, identificación
  positiva, foto, visa, salida de emergencia, Gate Dispatch, alcohol, discrepancias de tarjeta:
  cruzadas → apartar y embarcar juntos al final; duplicadas → reimprimir si el sistema lo permite y hay
  tiempo, hasta el −10; si no, queda abajo), minuto −15 (búsqueda de
  equipaje y des-chequeo) y cierre del vuelo por sistema.

## Trabajo en equipo

En el counter no estás solo/a: en los mostradores 21 y 23 atienden tus compañeros (bots) la misma fila
única, y sus aceptados ocupan asientos del mismo vuelo. Arriba a la derecha ves qué está haciendo cada uno;
tocá su tarjeta para girar y mirar su mostrador. A veces te consultan un caso ("¿lo acepto?"): un buen consejo
suma, uno malo resta y tiene consecuencias en "Qué pasó después". En Práctica libre se puede jugar solo/a.

### Sala online (🌐 Jugar en sala)

Hasta tres compañeros atienden el mismo turno, cada uno en su mostrador (21, 22, 23): misma fila, mismos
vuelos y asientos compartidos. Quien crea la sala recibe un código de 4 letras; los demás entran con
ese código. Los mostradores vacíos (o de alguien que se desconecta) los atiende un bot. Hay mensajes
rápidos predefinidos (sin chat libre) y al final cada uno ve el resultado de los demás.

Funciona sin servidor propio: los navegadores se conectan directamente (WebRTC, librería PeerJS desde
CDN, con su servidor público gratuito para encontrarse). Requiere internet. Algunas redes muy
restrictivas pueden bloquear la conexión directa; en ese caso habría que sumar un servidor TURN.

## Imprevistos (Práctica libre)

En medio del turno pueden pasar cosas, y se ven en el hall (no son sólo preguntas):

- **Equipaje desatendido**: una valija sola en el sector. Quien la detecta avisa a la PSA; la PSA ordena
  evacuar, acordona con tensabarriers y llega la brigada de explosivos con su traje. El protocolo se activa
  igual aunque el agente se equivoque (lo activa otro); la decisión suma o resta. El sector queda cerrado
  25–35 minutos de reloj, y los vuelos siguen acercándose al cierre.
- **Vuelo cancelado**: el tablero marca CANCELADO y los pasajeros van al mostrador. Hay que informar,
  ofrecer protección o reembolso y la asistencia que corresponde según la Res. ANAC 1532/98. Si se
  responde mal o tarde, se arma un piquete con carteles, cantos y bombo frente a los mostradores.

- **Vuelo demorado**: DEMORADO con nueva hora estimada; informar a la fila, asistencia según la espera
  (Res. 1532/98) y proteger al pasajero que pierde su conexión. En el hall, uno se acuesta en el piso y
  un nene corre con su avioncito. Si se maneja mal, piquete.
- **Un famoso en el hall**: ronda de fans con celulares y flashes. No se lo saltea en la fila (la
  prioridad la da la tarifa, no la fama), sin documento no viaja aunque "todos lo conozcan", y los datos
  de los pasajeros son confidenciales.
- **Egresados a Bariloche** (cabotaje): grupo con camperas iguales, bandera y cantos. Cada uno presenta su
  documento original (no fotocopias), la denuncia policial por extravío sirve en cabotaje y la
  pirotecnia no viaja ni en bodega ni en cabina.

Uno por turno (dos en avanzado), elegido entre los que sean posibles con los vuelos abiertos en ese momento. Se pueden desactivar en la pantalla de Práctica libre.

## Modos de juego

- **Aprendizaje**: el reloj se detiene mientras se atiende (avanza con cada acción). Sin puntaje por velocidad.
- **Desafío**: reloj en tiempo real todo el tiempo; la velocidad suma puntos y los cierres (−70 en check-in,
  −15 / −10 / −5 en la puerta) presionan de verdad.

## Cómo ejecutarlo

Requiere Node.js (cualquier versión reciente). Sin dependencias.

```bash
node server.cjs
```

Abrir http://localhost:5173. También funciona en cualquier hosting estático
(GitHub Pages, Netlify, servidor del instituto): basta subir la carpeta.

## Estructura

| Archivo | Contenido |
|---|---|
| `js/data.js` | **Datos editables por el instructor**: vuelos, horarios, reglas de ingreso (tipo Timatic), tarifas y franquicias, política UM, mapa de asientos, nombres. |
| `js/generator.js` | Escenarios y mazos por nivel (`DECKS`), generación de pasajeros, documentos y diálogos. |
| `js/rules.js` | Motor de reglas: qué corresponde con cada pasajero y puntaje/feedback de la atención. |
| `js/docs.js` | Pasaportes, DNI, visas, e-Visa, autorización de menores y reserva (con MRZ ICAO 9303 real). |
| `js/scene3d.js` | Hall de check-in en 3D (Three.js). |
| `js/main.js` | Interfaz de check-in: diálogo, DCS, equipaje, asientos, Timatic, decisión e informe. |
| `js/dialogues.js` | Diálogos de pasajeros en español, inglés y portugués (cada pasajero habla en un solo idioma; con angloparlantes el agente habla en inglés). |
| `js/overbooking.js` | Sobreventa: matriz de compensación (USD 160/200), protección, servicios, formulario VDBC/DNBD y su corrección. |
| `js/career.js` | Modo Historia: días, supervisora, briefing, tutorial guiado y progreso. |
| `js/events.js` | Imprevistos de Práctica libre: equipaje desatendido (protocolo PSA con cinemática: evacuación, vallado, brigada de explosivos) y vuelo cancelado (Res. ANAC 1532/98, piquete si se maneja mal). |
| `js/online.js` | Sala online: crear/unirse con código, sala de espera, anfitrión que reparte mostradores, corre los bots y reenvía los eventos; latido para detectar desconexiones. |
| `js/team.js` | Trabajo en equipo: compañeros bot en los mostradores 21 y 23 (veterano/a, nuevo/a, charlatana) que atienden la misma fila única y el mismo vuelo (asientos y aceptados compartidos), panel del equipo, mirar el mostrador vecino y consultas entre compañeros con consecuencias. Pensado para que luego un puesto lo maneje un compañero conectado. |
| `js/queue.js` | Paciencia de la fila (modo desafío): indicador, murmullos, fila 3D impaciente, aviso a la fila, colados (prioridad por cierre próximo vs. "haga la fila") y video viral. |
| `js/conflict.js` | Pasajeros difíciles / insubordinados (CAT 1, 2 y 3): diálogo por rondas con respuestas de actitud y categorización final. |
| `js/outage.js` | Sistema caído (atención manual): kit de contingencia, lista de pasajeros impresa, planilla API manual, bag tag y boarding pass manuales, y carga en el sistema al restablecerse. |
| `js/restricted.js` | Armas de fuego (retenidos, SSR WEAP, NOTOC) y mascotas en bodega (AVIH): variantes, formulario de gestión y corrección. |
| `js/people3d.js` | Personajes 3D: cuerpo articulado, peinados y cara dibujada con los mismos rasgos del retrato del documento. |
| `js/outside3d.js` | Vistas por los ventanales: lado tierra en el hall (ciudad, calle con autos, taxis y colectivos) y lado aire en la puerta (avión en la manga, pista, aviones que aterrizan y carretean). |
| `js/player.js` | Nombre y género del agente; trato personalizado en los textos (Bienvenido/a → Bienvenida / Bienvenido). |
| `js/dayend.js` | Fin del día: novedades del día siguiente (consecuencias de cada decisión, balance de multas/reclamos/demoras), repaso de errores y práctica de los casos fallados. |
| `js/boarding.js` | Módulo de embarque: casos de puerta, anuncios, zonas, pendientes, cierre e informe. |
| `js/gate3d.js` | Sala de embarque en 3D (podio, lector BGR, manga, carteles de zona). |

## Base didáctica

Procedimientos alineados con la *Guía de Atención al Pasajero · Unidad 4* (Billetaje y Reservas,
TUGA): tiempos de apertura/cierre (−180 / −70 STD), inspección 360°, limited release, cartilla de
mercancías peligrosas, artículos de valor, restricciones de salida de emergencia, menores, gestantes
y pasajeros alcoholizados.

## Casos incluidos

Aceptables: pasajero en regla, DNI Mercosur a Brasil/Chile, visa vigente en pasaporte
anterior, menor con autorización (con/sin UMNR).
Problemas: documento vencido, validez insuficiente (estadía / Schengen +3 meses), DNI no
válido para el destino, sin visa, visa vencida, sin ESTA (respuesta iAPI), EE.UU.→Brasil sin
e-Visa, impostor, nombre distinto en el boleto, sin boleto emitido, reserva de otra fecha,
check-in cerrado, menor sin autorización, menor sin servicio UM, pasajera gestante
(hasta sem. 28 / 29–38 con certificado válido o inválido / 39+), pasajero bajo efectos del alcohol.
Variantes de equipaje/seguridad: sobrepeso, valija > 32 kg, pieza adicional, tarifa Light
con valija, mercancías peligrosas en bodega (cartilla MMPP), limited release (film, caja,
daños, sobredimensionado, heavy), artículos de valor, pedido de salida de emergencia por pasajero no apto,
cambio de aspecto legítimo (anteojos/pelo).

**Familias** (grupo en el mismo mostrador, una reserva con varios nombres): ambos padres con partida de
nacimiento, un solo padre con permiso del otro, menor con abuelo/a y permiso de ambos padres, infantes
(documento propio, INF en la reserva, cochecito sin cargo, nunca en salida de emergencia). APIS y asiento
por integrante. Casos especiales (nivel avanzado y Día 5 del Modo Historia): progenitor fallecido
(certificado de defunción), ausente (autorización del tribunal de familia, para ese destino), en el
exterior (autorización consular; una carta simple no sirve) y tutor/a (certificado judicial de tutela).

**Cabotaje** (Bariloche e Iguazú, apertura −120 / cierre −50): documento vigente o, por extravío o
robo, licencia de conducir vigente, denuncia policial o constancia de DNI en trámite. Las armas de
fuego se juegan sólo en vuelos de cabotaje.

**Condiciones legales**: detenido o extraditado (DEPA: 24 h de reserva, 2 escoltas de una fuerza
reconocida, uno del mismo sexo si es mujer, uno por vuelo, última fila; en la puerta embarca primero
y esposado), deportado con escolta y deportado sin escolta (DEPU).

> Las reglas documentarias están simplificadas con fines didácticos. Verificar y ajustar
> `js/data.js` según la normativa vigente y los procedimientos de la compañía.
