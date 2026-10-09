// Entorno 3D del hall de check-in (Three.js).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPerson } from './people3d.js';
import { buildCityside } from './outside3d.js';
import { AIRLINE, STATION } from './data.js';
import { fmtTime } from './util.js';
import { settings } from './sound.js';

const COUNTER_SPOT = new THREE.Vector3(0.15, 0, 0.85);
const FRONT = [0.6, 2.7];
const QUEUE_SLOTS = [FRONT];
[0.6, -0.4, -1.4, -2.4].forEach((x) => QUEUE_SLOTS.push([x, 3.6]));
[-2.4, -1.4, -0.4, 0.6, 1.6].forEach((x) => QUEUE_SLOTS.push([x, 4.8]));
[1.6, 0.6, -0.4, -1.4, -2.4].forEach((x) => QUEUE_SLOTS.push([x, 6.0]));
const SCALE_POS = new THREE.Vector3(-1.75, 0, 0.35);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, canvas: c };
}

export { canvasTex };

// Carácter de un ícono de Material Design Icons (se lee del CSS cargado, por nombre)
const mdiCache = {};
function mdiChar(name) {
  if (name in mdiCache) return mdiCache[name];
  const i = document.createElement('i');
  i.className = `mdi mdi-${name}`;
  i.style.cssText = 'position:absolute;visibility:hidden';
  document.body.appendChild(i);
  const c = getComputedStyle(i, '::before').content;
  i.remove();
  const ch = c && c !== 'none' && c !== 'normal' ? c.replace(/^["']|["']$/g, '') : null;
  if (ch) mdiCache[name] = ch;
  return ch;
}

export class AirportScene {
  constructor(container) {
    this.container = container;
    const low = settings().quality === 'low'; // Configuración → calidad gráfica
    this.renderer = new THREE.WebGLRenderer({ antialias: !low });
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.scene.background = new THREE.Color('#c9d6e2');
    this.scene.fog = new THREE.Fog('#c9d6e2', 14, 32);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.05, 80);
    this.camBase = new THREE.Vector3(0, 1.62, -1.1);
    this.camTarget = new THREE.Vector3(0, 1.15, 3.2);
    this.look = { x: 0, y: 0, tx: 0, ty: 0 };

    this.clock = new THREE.Clock();
    this.walkers = [];
    this.queue = [];
    this.current = null;
    this.bags = [];
    this.movers = [];
    this.animators = [];

    this.layout();
    this.buildEnvironment();
    this.buildAmbientPeople();

    container.addEventListener('pointermove', (e) => {
      const r = container.getBoundingClientRect();
      this.look.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      this.look.ty = ((e.clientY - r.top) / r.height - 0.5) * 0.18;
    });
    container.addEventListener('pointerleave', () => { this.look.tx = 0; this.look.ty = 0; });
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  // Posiciones de la fila y del puesto de atención (las subclases pueden redefinirlas)
  layout() {
    this.slots = QUEUE_SLOTS;
    this.front = FRONT;
    this.spot = COUNTER_SPOT;
    this.exitPaths = { accept: [[-1.2, 2.0], [-6, 2.4], [-12, 2.6]], other: [[2.0, 1.8], [5.5, 2.6], [12, 3]] };
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.renderer.domElement.remove();
    this.renderer.dispose();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ----------------------------------------------------------------
  buildEnvironment() {
    const s = this.scene;
    s.background = new THREE.Color('#d9d2c6');
    s.fog = new THREE.Fog('#d9d2c6', 16, 40);
    s.add(new THREE.HemisphereLight('#f2f5ff', '#8a7f70', 0.55));
    // Sol de atardecer entrando por el ventanal
    const sun = new THREE.DirectionalLight('#ffd9a8', 2.1);
    sun.position.set(-6, 9, 18);
    sun.target.position.set(0, 0, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -8, near: 1, far: 50 });
    s.add(sun); s.add(sun.target);
    const fill = new THREE.DirectionalLight('#dce8ff', 0.5);
    fill.position.set(5, 7, -4); s.add(fill);

    // Piso de granito pulido con juntas
    const floorTex = canvasTex(1024, 1024, (g, w, h) => {
      g.fillStyle = '#d8d3ca'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = Math.random();
        g.fillStyle = v < 0.5 ? `rgba(120,110,100,${Math.random() * 0.25})` : v < 0.8 ? `rgba(255,255,255,${Math.random() * 0.4})` : `rgba(60,55,50,${Math.random() * 0.3})`;
        const r = Math.random() * 2.2 + 0.4;
        g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = 'rgba(120,112,100,.55)'; g.lineWidth = 3;
      for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 512, 0); g.lineTo(i * 512, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 512); g.lineTo(w, i * 512); g.stroke(); }
    }).tex;
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(16, 12);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 48), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.18, metalness: 0.05, envMapIntensity: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    // Franja de guía en el piso (camino a la zona de check-in)
    const path = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.35), new THREE.MeshStandardMaterial({ color: '#2b3442', roughness: 0.4 }));
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.004, 8.6); s.add(path);

    // Zona de agentes (detrás del mostrador) con alfombra
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshStandardMaterial({ color: '#2f3746', roughness: 0.95 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.005, -1.4);
    s.add(carpet);

    // Vista exterior: lado tierra (la ciudad, la calle y el tránsito)
    buildCityside(s, this.animators);
    // Muro cortina: vidrio y montantes metálicos
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(32, 7.5), new THREE.MeshStandardMaterial({ color: '#cfe3f5', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1 }));
    glass.position.set(0, 3.75, 13); glass.rotation.y = Math.PI; s.add(glass);
    const mullMat = new THREE.MeshStandardMaterial({ color: '#3b434e', metalness: 0.7, roughness: 0.35 });
    for (let x = -16; x <= 16; x += 2.4) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 7.5, 0.16), mullMat); m.position.set(x, 3.75, 13); s.add(m); }
    [0.12, 2.8, 5.6].forEach((y) => { const t = new THREE.Mesh(new THREE.BoxGeometry(32, 0.1, 0.18), mullMat); t.position.set(0, y, 13); s.add(t); });

    // Paredes laterales y del fondo
    const wallMat = new THREE.MeshStandardMaterial({ color: '#ece8e1', roughness: 0.85 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(32, 7.5), wallMat);
    back.position.set(0, 3.75, -3); s.add(back);
    const wood = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#a77b52'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) { g.fillStyle = `rgba(60,35,15,${0.15 + Math.random() * 0.15})`; g.fillRect(x, 0, 3, h); }
      for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(80,50,25,${Math.random() * 0.15})`; g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.lineTo(x + Math.random() * 6 - 3, h); g.stroke(); }
    }).tex;
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(6, 2);
    [-15.5, 15.5].forEach((x) => {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(17, 7.5), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7 }));
      side.position.set(x, 3.75, 5); side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; s.add(side);
    });

    // Techo: listones y líneas de luz
    const ceilTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#f4f2ed'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,.07)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 4, h);
    }).tex;
    ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping; ceilTex.repeat.set(12, 8);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(32, 18), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 7.5, 5); s.add(ceil);
    const ledMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff4dc', emissiveIntensity: 1.6 });
    for (let z = -1; z <= 12; z += 2.6) { const l = new THREE.Mesh(new THREE.BoxGeometry(26, 0.05, 0.12), ledMat); l.position.set(0, 7.42, z); s.add(l); }

    // Columnas con pantallas de vuelos y publicidad
    const colMat = new THREE.MeshStandardMaterial({ color: '#dfe3e8', roughness: 0.25, metalness: 0.45 });
    const colBase = new THREE.MeshStandardMaterial({ color: '#2f353d', roughness: 0.4, metalness: 0.5 });
    const ad = canvasTex(256, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#123a63'); gr.addColorStop(1, '#1f6fb0');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd34d'; g.font = 'bold 34px system-ui'; g.textAlign = 'center';
      g.fillText('✈ Aeroplata', w / 2, 70);
      g.fillStyle = '#fff'; g.font = 'bold 44px system-ui'; g.fillText('Volá', w / 2, 230); g.fillText('más lejos', w / 2, 282);
      g.font = '24px system-ui'; g.fillText('Madrid · Miami', w / 2, 360); g.fillText('São Paulo · Santiago', w / 2, 394);
      g.fillStyle = '#ffd34d'; g.fillRect(40, 440, w - 80, 6);
    }).tex;
    [[-7.5, 5], [7.5, 5], [-7.5, 10], [7.5, 10]].forEach(([x, z], i) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 7.5, 32), colMat);
      c.position.set(x, 3.75, z); c.castShadow = true; c.receiveShadow = true; s.add(c);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.3, 32), colBase); b.position.set(x, 0.15, z); s.add(b);
      // Pantalla publicitaria (cara hacia el agente)
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshStandardMaterial({ map: ad, emissive: '#ffffff', emissiveMap: ad, emissiveIntensity: 0.5 }));
      panel.position.set(x, 2.1, z - 0.44); panel.rotation.y = Math.PI; if (i % 2) panel.position.x += 0; s.add(panel);
    });

    // Tablero de vuelos
    const board = canvasTex(1024, 400, () => {});
    this.boardCanvas = board.canvas; this.boardTex = board.tex;
    const bmesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.2), new THREE.MeshStandardMaterial({ map: board.tex, emissive: '#ffffff', emissiveMap: board.tex, emissiveIntensity: 0.85 }));
    bmesh.position.set(0, 4.6, 12.6); bmesh.rotation.y = Math.PI; s.add(bmesh);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(5.9, 2.5, 0.12), new THREE.MeshStandardMaterial({ color: '#1b1e23', metalness: 0.6, roughness: 0.4 }));
    frame.position.set(0, 4.6, 12.68); s.add(frame);
    [-2.4, 2.4].forEach((x) => { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7), colBase); rod.position.set(x, 6.7, 12.68); s.add(rod); });

    // Cartel colgante sobre la fila
    this.signT = canvasTex(1024, 192, () => {});
    const sign = this.signT.tex;
    this.drawSign('Check-in', 'Todos los vuelos internacionales · All flights');
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.68), new THREE.MeshStandardMaterial({ map: sign, emissive: '#ffffff', emissiveMap: sign, emissiveIntensity: 0.55 }));
    sg.position.set(0, 3.1, 7.2); sg.rotation.y = Math.PI; s.add(sg);
    const sgBox = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.76, 0.08), new THREE.MeshStandardMaterial({ color: '#0e2b4a', metalness: 0.3, roughness: 0.5 }));
    sgBox.position.set(0, 3.1, 7.25); s.add(sgBox);
    [-1.5, 1.5].forEach((x) => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 4.1), new THREE.MeshBasicMaterial({ color: '#555' }));
      rod.position.set(x, 5.5, 7.2); s.add(rod);
    });

    // Mostradores
    this.buildCounter(0, true);
    this.buildCounter(-3.5, false);
    this.buildCounter(3.5, false);

    // Balanzas
    this.buildScale(SCALE_POS.x, true);
    this.buildScale(-5.25, false);
    this.buildScale(1.75, false);

    // Cinta transportadora detrás de los mostradores
    const belt = new THREE.Mesh(new THREE.BoxGeometry(16, 0.35, 0.6), new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.7 }));
    belt.position.set(-2, 0.18, -2.2); belt.receiveShadow = true; s.add(belt);

    // Fila con postes y cintas
    this.buildStanchions();

    // Cartel "Espere aquí"
    const wait = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#ffd34d'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#123a63'; g.font = 'bold 36px system-ui'; g.textAlign = 'center';
      g.fillText('ESPERE AQUÍ', w / 2, 58); g.font = '26px system-ui'; g.fillText('Please wait here', w / 2, 98);
    }).tex;
    const wmesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: wait, roughness: 0.6 }));
    wmesh.rotation.x = -Math.PI / 2; wmesh.rotation.z = Math.PI; wmesh.position.set(0.6, 0.01, 2.25); s.add(wmesh);

    this.buildProps();
  }

  // Mobiliario del hall: café, bancos, plantas, carros de equipaje y tachos
  buildProps() {
    const s = this.scene;
    const metal = new THREE.MeshStandardMaterial({ color: '#a9b0b8', metalness: 0.8, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.5, metalness: 0.3 });
    // Plantas en macetas
    const pot = new THREE.MeshStandardMaterial({ color: '#e9e4dc', roughness: 0.6 });
    const leaf = new THREE.MeshStandardMaterial({ color: '#3f7a43', roughness: 0.8 });
    const leaf2 = new THREE.MeshStandardMaterial({ color: '#5a9a4e', roughness: 0.8 });
    [[-12.5, 12.2], [12.5, 12.2], [-10.5, 6], [10.5, 6], [-4.6, 3.2], [4.4, 3.2]].forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.6, 20), pot); p.position.set(x, 0.3, z); p.castShadow = true; s.add(p);
      for (let i = 0; i < 9; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.12, 10, 8), i % 2 ? leaf : leaf2);
        l.position.set(x + (Math.random() - 0.5) * 0.4, 0.75 + Math.random() * 0.8, z + (Math.random() - 0.5) * 0.4); l.scale.y = 1.3; l.castShadow = true; s.add(l);
      }
    });
    // Bancos de espera junto al ventanal
    const seatMat = new THREE.MeshStandardMaterial({ color: '#1f5f8f', roughness: 0.5 });
    [[-9.5, 11.6], [-4.5, 11.6], [4.5, 11.6], [9.5, 11.6]].forEach(([x, z]) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.08), metal); beam.position.set(x, 0.42, z); s.add(beam);
      for (let i = 0; i < 4; i++) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.5), seatMat); seat.position.set(x - 1.2 + i * 0.8, 0.46, z); seat.castShadow = true; s.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.05), seatMat); back.position.set(x - 1.2 + i * 0.8, 0.72, z + 0.24); back.rotation.x = -0.12; s.add(back);
      }
      [-1.4, 1.4].forEach((dx) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.4), metal); leg.position.set(x + dx, 0.21, z); s.add(leg); });
    });
    // Café / kiosco a la derecha
    const kiosk = new THREE.Group();
    const ctr = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.05, 1.0), new THREE.MeshStandardMaterial({ color: '#5b3a24', roughness: 0.6 })); ctr.position.y = 0.52; ctr.castShadow = true; kiosk.add(ctr);
    const topK = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.05, 1.1), new THREE.MeshStandardMaterial({ color: '#eae6df', roughness: 0.3 })); topK.position.y = 1.07; kiosk.add(topK);
    const cafe = canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = '#1c1410'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f2c46d'; g.font = 'bold 64px Georgia, serif'; g.textAlign = 'center'; g.fillText('Café del Plata', w / 2, 82);
    }).tex;
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ map: cafe, emissive: '#ffffff', emissiveMap: cafe, emissiveIntensity: 0.7 }));
    cs.position.set(0, 2.6, -0.4); cs.rotation.y = Math.PI; kiosk.add(cs);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 0.3), new THREE.MeshStandardMaterial({ color: '#3b2a1f', roughness: 0.7 })); shelf.position.set(0, 1.6, 0.5); kiosk.add(shelf);
    for (let i = 0; i < 10; i++) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.12, 10), new THREE.MeshStandardMaterial({ color: ['#fff', '#c33', '#2a6'][i % 3] })); cup.position.set(-1.3 + i * 0.28, 1.15, 0.2); kiosk.add(cup); }
    kiosk.position.set(12, 0, 9.2); kiosk.rotation.y = -Math.PI / 2 + 0.35; s.add(kiosk);
    // Carros de equipaje con valijas
    const trolley = (x, z, rot) => {
      const t = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.85), metal); base.position.y = 0.18; t.add(base);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.03), metal); handle.position.set(0, 0.6, 0.42); handle.rotation.x = 0.15; t.add(handle);
      [[-0.22, -0.35], [0.22, -0.35], [-0.22, 0.35], [0.22, 0.35]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), dark); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.07, wz); t.add(w); });
      const colors = ['#7a1f2a', '#1f3b57', '#2d5a3d', '#8a6d3b'];
      for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.6), new THREE.MeshStandardMaterial({ color: colors[(i + Math.floor(x)) & 3], roughness: 0.5 })); b.position.set(0, 0.35 + i * 0.29, -0.05); b.castShadow = true; t.add(b); }
      t.position.set(x, 0, z); t.rotation.y = rot; s.add(t);
    };
    trolley(-6.2, 6.6, 0.4); trolley(6.4, 7.4, -0.6); trolley(-11.5, 9.5, 1.2);
    // Tachos de residuos
    [[-3.9, 7.8], [4.6, 4.4]].forEach(([x, z]) => {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.75, 18), metal); bin.position.set(x, 0.375, z); bin.castShadow = true; s.add(bin);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 18), dark); lid.position.set(x, 0.77, z); s.add(lid);
    });
  }

  // Cartel colgante sobre la fila (vuelo asignado al mostrador)
  drawSign(title, sub) {
    const g = this.signT.canvas.getContext('2d');
    const w = 1024, h = 192;
    g.fillStyle = '#123a63'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd34d'; g.fillRect(0, h - 14, w, 14);
    g.fillStyle = '#fff'; g.font = 'bold 70px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(`${AIRLINE.name.toUpperCase()}  ·  ${title}`, w / 2, 88);
    g.font = '42px system-ui, sans-serif';
    g.fillText(sub, w / 2, 152);
    this.signT.tex.needsUpdate = true;
  }

  setCounterLabel(label, sub) {
    if (!this.signT) return;
    this.drawSign(label.includes('·') ? label.split('·').pop().trim() : 'Check-in', sub || 'Todos los vuelos internacionales · All flights');
  }

  buildCounter(x, main) {
    const s = this.scene;
    const g = new THREE.Group();
    g.position.x = x;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 0.7), new THREE.MeshStandardMaterial({ color: '#dcd7cf', roughness: 0.7 }));
    body.position.y = 0.525; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 0.85), new THREE.MeshStandardMaterial({ color: '#3a3430', roughness: 0.65, metalness: 0.05 }));
    top.position.set(0, 1.07, -0.03); top.castShadow = true; g.add(top);
    const drawFront = (c, w, h, label) => {
      c.fillStyle = '#123a63'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd34d'; c.fillRect(0, h - 40, w, 40);
      c.fillStyle = '#fff'; c.font = 'bold 120px system-ui'; c.textAlign = 'center';
      c.fillText(`✈ ${AIRLINE.name}`, w / 2, 190);
      c.font = '56px system-ui'; c.fillText(label, w / 2, 290);
    };
    const frontT = canvasTex(1024, 384, (c, w, h) => drawFront(c, w, h, main ? 'Mostrador 22 · Todos los vuelos' : (x < 0 ? 'Mostrador 21' : 'Mostrador 23')));
    const front = frontT.tex;
    // Número del mostrador (en una sala online cada uno ve el suyo al centro)
    (this.counterPanels = this.counterPanels || {})[main ? 'main' : x < 0 ? 21 : 23] = (label) => { drawFront(frontT.canvas.getContext('2d'), 1024, 384, label); front.needsUpdate = true; };
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshStandardMaterial({ map: front, roughness: 0.6 }));
    panel.position.set(0, 0.52, 0.352); g.add(panel);
    // Monitor
    const mon = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), new THREE.MeshStandardMaterial({ color: '#222' }));
    stand.position.y = 0.12; mon.add(stand);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.04), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.4 }));
    screen.position.y = 0.42; mon.add(screen);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), new THREE.MeshBasicMaterial({ color: '#163a5c' }));
    glow.position.set(0, 0.42, -0.022); glow.rotation.y = Math.PI; mon.add(glow);
    mon.position.set(main ? 1.05 : 0.55, 1.09, main ? -0.1 : 0.05);
    mon.rotation.y = main ? 0.5 : 0;
    g.add(mon);
    // Teclado e impresora
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.15), new THREE.MeshStandardMaterial({ color: '#333' }));
    kb.position.set(0.35, 1.105, -0.2); g.add(kb);
    const pr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.25), new THREE.MeshStandardMaterial({ color: '#d8d8d8' }));
    pr.position.set(-0.75, 1.17, -0.1); pr.castShadow = true; g.add(pr);
    s.add(g);
    if (!main) {
      // Agente vecino
      const agent = this.makePerson({ skin: Math.floor(Math.random() * 3), hairColor: '#2a1d14', hairStyle: x < 0 ? 'bun' : 'short', glasses: false, beard: false, shirt: '#123a63', pants: '#1c1f26' });
      agent.position.set(x, 0, -0.75); agent.rotation.y = Math.PI; s.add(agent);
      this.walkers.push({ fig: agent, idle: true });
      (this.side = this.side || {})[x < 0 ? 21 : 23] = { x, agent, scaleX: x - 1.75, bags: [] };
    }
  }

  buildScale(x, main) {
    const s = this.scene;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.75), new THREE.MeshStandardMaterial({ color: '#3d434c', roughness: 0.5, metalness: 0.4 }));
    base.position.set(x, 0.11, 0.3); base.receiveShadow = true; base.castShadow = true; s.add(base);
    const rollers = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.7), new THREE.MeshStandardMaterial({ color: '#7d848f', metalness: 0.6, roughness: 0.3 }));
    rollers.position.set(x, 0.23, 0.3); s.add(rollers);
    if (main) {
      const disp = canvasTex(256, 96, () => {});
      this.scaleCanvas = disp.canvas; this.scaleTex = disp.tex;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ map: disp.tex }));
      d.position.set(-1.12, 1.18, -0.28); d.rotation.y = Math.PI + 0.35; s.add(d);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: '#222' }));
      housing.position.set(-1.12, 1.18, -0.26); housing.rotation.y = 0.35; s.add(housing);
      this.setScale(null);
    }
  }

  setScale(kg) {
    if (!this.scaleCanvas) return;
    const g = this.scaleCanvas.getContext('2d');
    g.fillStyle = '#0b120b'; g.fillRect(0, 0, 256, 96);
    g.fillStyle = kg == null ? '#2c5a2c' : kg > 32 ? '#ff5a4a' : kg > 23 ? '#ffc04d' : '#6dff6d';
    g.font = 'bold 64px monospace'; g.textAlign = 'right';
    g.fillText(kg == null ? '0.0' : kg.toFixed(1), 200, 72);
    g.font = 'bold 28px monospace'; g.fillText('kg', 246, 72);
    this.scaleTex.needsUpdate = true;
  }

  buildStanchions() {
    const s = this.scene;
    const postMat = new THREE.MeshStandardMaterial({ color: '#b8bec6', metalness: 0.85, roughness: 0.25 });
    const beltMat = new THREE.MeshStandardMaterial({ color: '#9d1d2c', roughness: 0.6 });
    this.stanchionLines = [];
    const line = (z, x0, x1) => {
      const grp = new THREE.Group();
      const n = Math.max(1, Math.round((x1 - x0) / 1.25));
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 10), postMat);
        p.position.set(x, 0.475, z); p.castShadow = true; grp.add(p);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 16), postMat);
        b.position.set(x, 0.015, z); grp.add(b);
      }
      const belt = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, 0.01), beltMat);
      belt.position.set((x0 + x1) / 2, 0.88, z); belt.userData.isBelt = true; grp.add(belt);
      s.add(grp);
      this.stanchionLines.push(grp);
    };
    line(3.05, -3.1, 0.0);
    line(4.2, -1.9, 2.4);
    line(5.4, -3.1, 1.0);
    line(6.6, -3.1, 2.4);
  }

  // Tensabarriers guardados (la sala sin armar)
  hideStanchions() { (this.stanchionLines || []).forEach((g) => { g.visible = false; }); }

  // Se arman línea por línea: aparecen los postes y después se estira la cinta
  showStanchions() {
    (this.stanchionLines || []).forEach((g, i) => {
      setTimeout(() => {
        g.visible = true;
        const posts = g.children.filter((c) => !c.userData.isBelt);
        const belt = g.children.find((c) => c.userData.isBelt);
        posts.forEach((p) => { p.scale.set(1, 0.01, 1); });
        if (belt) belt.scale.set(0.01, 1, 1);
        let t = 0;
        const anim = (dt) => {
          t += dt;
          const k = Math.min(1, t / 0.45);
          posts.forEach((p) => { p.scale.y = Math.max(0.01, k); });
          if (belt) belt.scale.x = Math.max(0.01, Math.min(1, (t - 0.35) / 0.45));
          if (t > 0.85) this.animators.splice(this.animators.indexOf(anim), 1);
        };
        this.animators.push(anim);
      }, i * 350);
    });
  }

  buildAmbientPeople() {
    for (let i = 0; i < 7; i++) {
      const fig = this.makePerson({
        skin: Math.floor(Math.random() * 5), hairColor: ['#1d1714', '#4a2f1e', '#c9a35b', '#b8b5b0'][i % 4],
        hairStyle: ['short', 'long', 'bald', 'bun'][i % 4], glasses: i % 3 === 0, beard: false,
        shirt: ['#7a2e2e', '#2e6b4f', '#555', '#b07a2a', '#1f7a8c', '#6b5b95', '#333'][i], pants: '#2a2f38',
      }, true);
      const z = 8 + Math.random() * 3.5;
      const dir = Math.random() < 0.5 ? 1 : -1;
      fig.position.set(-9 + Math.random() * 18, 0, z);
      this.scene.add(fig);
      this.walkers.push({ fig, ambient: true, dir, speed: 0.9 + Math.random() * 0.6, z, phase: Math.random() * 6 });
    }
  }

  // ----------------------------------------------------------------
  makePerson(f, withBag = false, scale = 1) {
    const { g, legs, arms } = buildPerson(f);
    if (f.accessory === 'stroller') {
      // Cochecito bien visible: color vivo, capota, manija, ruedas claras y el bebé asomando
      const st = new THREE.Group();
      const col = ['#e85d75', '#3fa7d6', '#f2a541', '#7bc67b'][(f.skin + (f.eye || 0)) % 4];
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 });
      const frame = new THREE.MeshStandardMaterial({ color: '#e9edf2', metalness: 0.6, roughness: 0.3 });
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.66), m); basket.position.y = 0.56; basket.castShadow = true; st.add(basket);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.7), frame); rim.position.y = 0.72; st.add(rim);
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 10, 0, Math.PI), m); hood.position.set(0, 0.72, 0.16); hood.rotation.x = -Math.PI / 2; hood.castShadow = true; st.add(hood);
      const baby = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({ color: '#f1c7a5', roughness: 0.7 })); baby.position.set(0, 0.77, 0.02); st.add(baby);
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.36), new THREE.MeshStandardMaterial({ color: '#fdfdfd', roughness: 0.9 })); blanket.position.set(0, 0.73, -0.14); st.add(blanket);
      // Manija hacia el adulto y patas
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), frame); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.0, 0.5); st.add(bar);
      [-0.22, 0.22].forEach((x) => {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 8), frame); h.position.set(x, 0.86, 0.42); h.rotation.x = -0.6; st.add(h);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 8), frame); leg.position.set(x, 0.3, 0); st.add(leg);
      });
      const wm = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6 });
      const hub = new THREE.MeshStandardMaterial({ color: '#f4f4f4' });
      [[-0.22, 0.24], [0.22, 0.24], [-0.22, -0.24], [0.22, -0.24]].forEach(([x, z]) => {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 8, 16), wm); w.position.set(x, 0.1, z); w.rotation.y = Math.PI / 2; st.add(w);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), hub); c.rotation.z = Math.PI / 2; c.position.set(x, 0.1, z); st.add(c);
      });
      st.position.set(0, 0, -0.62); g.add(st);
    }
    if (f.accessory === 'pet') {
      const pc = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.25), new THREE.MeshStandardMaterial({ color: '#8a6d3b', roughness: 0.8 }));
      pc.position.set(-0.32, 0.85, 0); g.add(pc);
    }
    if (f.accessory === 'guncase') {
      const gc = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.08), new THREE.MeshStandardMaterial({ color: '#1f2326', roughness: 0.5 }));
      gc.position.set(-0.36, 0.6, 0.05); gc.rotation.z = 0.12; g.add(gc);
    }
    if (f.accessory === 'kennel') {
      const kn = new THREE.Group();
      const km = new THREE.MeshStandardMaterial({ color: '#9aa3ab', roughness: 0.7 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.85), km); box.position.y = 0.3; kn.add(box);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.38), new THREE.MeshStandardMaterial({ color: '#333', wireframe: true }));
      door.position.set(0, 0.3, 0.43); kn.add(door);
      kn.position.set(-0.65, 0, 0.1); g.add(kn);
    }
    if (f.accessory === 'bigbag') {
      const bb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.45), new THREE.MeshStandardMaterial({ color: '#4b3a6b', roughness: 0.6 }));
      bb.position.set(-0.42, 0.3, 0.05); g.add(bb);
    }
    let bag = null;
    if (withBag) {
      bag = this.makeBag(['#1f3b57', '#7a1f2a', '#333', '#2d5a3d', '#8a6d3b', '#5a3d7a'][Math.floor(Math.random() * 6)]);
      bag.position.set(0.42, 0, 0.05);
      g.add(bag);
    }
    g.scale.setScalar(scale);
    g.userData = { legs, arms, bag };
    return g;
  }

  makeBag(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.42), new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
    body.position.y = 0.36; body.castShadow = true; g.add(body);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.2), new THREE.MeshStandardMaterial({ color: '#222' }));
    handle.position.y = 0.78; g.add(handle);
    const wheelM = new THREE.MeshStandardMaterial({ color: '#111' });
    [-0.15, 0.15].forEach((z) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), wheelM);
      w.rotation.z = Math.PI / 2; w.position.set(0, 0.04, z); g.add(w);
    });
    return g;
  }

  // ----------------------------------------------------------------
  // Fila
  setQueue(paxList) {
    this.queue.forEach((q) => this.scene.remove(q.fig));
    this.queue = [];
    paxList.slice(0, this.slots.length).forEach((p, i) => this.addToQueue(p, i));
  }
  // Figura del pasajero; en familias, con sus acompañantes al lado
  makePax(p) {
    const fig = this.makePerson(p.face, true, p.isMinor ? 0.82 : 0.96 + Math.random() * 0.08);
    (p.party?.members || []).filter((m) => !m.isInfant).forEach((m, i) => {
      const c = this.makePerson(m.face, false, m.isMinor ? 0.62 : 0.98);
      c.position.set(i % 2 ? 0.55 : -0.55, 0, 0.35 + Math.floor(i / 2) * 0.4);
      fig.add(c);
    });
    return fig;
  }

  addToQueue(p, i = this.queue.length) {
    if (i >= this.slots.length) return;
    const fig = this.makePax(p);
    const [x, z] = this.slots[i];
    fig.position.set(x, 0, z);
    this.scene.add(fig);
    this.queue.push({ fig, id: p.id });
  }
  syncQueue(upcoming) {
    // agrega figuras faltantes al final de la fila
    const have = new Set(this.queue.map((q) => q.id));
    upcoming.slice(0, this.slots.length).forEach((p) => { if (!have.has(p.id)) this.addToQueue(p); });
  }

  // Reemplaza la figura al frente de la fila por el pasajero definitivo
  replaceFront(p) {
    const q = this.queue[0];
    if (!q) return this.addToQueue(p, 0);
    const pos = q.fig.position.clone();
    this.scene.remove(q.fig);
    q.fig = this.makePax(p);
    q.fig.position.copy(pos);
    q.id = p.id;
    this.scene.add(q.fig);
  }

  // Saca al primero de la fila y el resto avanza un lugar
  takeFront() {
    const q = this.queue.shift();
    if (!q) return null;
    this.queue.forEach((o, i) => {
      const [x, z] = this.slots[i];
      this.walkTo(o.fig, [[x, z]], 0.9);
    });
    return q;
  }

  // Fila única (trabajo en equipo): mantiene n figuras en la fila
  fillQueue(n, make) {
    const want = Math.min(n, this.slots.length);
    while (this.queue.length < want) this.addToQueue(make());
    while (this.queue.length > want) this.scene.remove(this.queue.pop().fig);
  }

  // ----------------------------------------------------------------
  // Mostradores vecinos (21 y 23): compañeros que atienden la misma fila
  setSideAgent(no, face) {
    const c = this.side?.[no];
    if (!c) return;
    this.scene.remove(c.agent);
    this.walkers = this.walkers.filter((w) => w.fig !== c.agent);
    const a = this.makePerson(face);
    a.position.set(c.x, 0, -0.75); a.rotation.y = Math.PI;
    this.scene.add(a);
    this.walkers.push({ fig: a, idle: true });
    c.agent = a;
  }

  // Decoración comprada en la Carrera, sobre el mostrador propio: 'mate', 'planta', 'foto'
  setDeskDecor(items) {
    if (this.decor) this.scene.remove(this.decor);
    this.decor = new THREE.Group();
    const top = 1.095;
    const m = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    if (items.includes('mate')) {
      const mate = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.08, 16), m('#7a4b2a'));
      mate.position.set(0.5, top + 0.04, -0.28);
      const yerba = new THREE.Mesh(new THREE.CircleGeometry(0.032, 14), m('#6f8f3a', 0.9));
      yerba.rotation.x = -Math.PI / 2; yerba.position.set(0.5, top + 0.081, -0.28);
      const bombilla = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6), m('#c9ccd1', 0.2));
      bombilla.position.set(0.51, top + 0.12, -0.28); bombilla.rotation.z = -0.25;
      const termo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 16), m('#2f6b4f', 0.4));
      termo.position.set(0.62, top + 0.15, -0.3);
      const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 16), m('#222'));
      tapa.position.set(0.62, top + 0.32, -0.3);
      this.decor.add(mate, yerba, bombilla, termo, tapa);
    }
    if (items.includes('planta')) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.1, 16), m('#c4663a'));
      pot.position.set(-0.95, top + 0.05, -0.15);
      this.decor.add(pot);
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), m(['#3f8f4a', '#4fa35a', '#2e7a3c'][i % 3], 0.7));
        const a = (i / 7) * Math.PI * 2;
        leaf.scale.set(0.6, 1.6, 0.4);
        leaf.position.set(-0.95 + Math.cos(a) * 0.04, top + 0.17 + (i % 2) * 0.05, -0.15 + Math.sin(a) * 0.04);
        leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        this.decor.add(leaf);
      }
    }
    if (items.includes('foto')) {
      const t = canvasTex(96, 120, (g) => {
        g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 96, 120);
        const sky = g.createLinearGradient(0, 8, 0, 80); sky.addColorStop(0, '#7fc4f0'); sky.addColorStop(1, '#ffe6a8');
        g.fillStyle = sky; g.fillRect(8, 8, 80, 104);
        g.fillStyle = '#3d8f4a'; g.fillRect(8, 82, 80, 30);
        [[30, '#e8417a'], [52, '#1f6fe0'], [70, '#f2a541']].forEach(([x, c]) => { g.fillStyle = '#f1c7a5'; g.beginPath(); g.arc(x, 66, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.fillRect(x - 7, 73, 14, 20); });
      }).tex;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.015), m('#3b2a1f', 0.5));
      frame.position.set(-0.4, top + 0.085, -0.32); frame.rotation.x = -0.2;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.14), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
      pic.position.set(-0.4, top + 0.086, -0.329); pic.rotation.set(-0.2, Math.PI, 0);
      this.decor.add(frame, pic);
    }
    this.scene.add(this.decor);
  }

  // Números de los mostradores: el propio al centro y los de los compañeros a los costados
  numberCounters(mine, left, right) {
    const P = this.counterPanels || {};
    P.main?.(`Mostrador ${mine} · Todos los vuelos`);
    P[21]?.(`Mostrador ${left}`);
    P[23]?.(`Mostrador ${right}`);
  }

  // Cartel flotante sobre el mostrador con el nombre y lo que está haciendo
  setSideLabel(no, title, status) {
    const c = this.side?.[no];
    if (!c) return;
    if (!c.label) {
      const t = canvasTex(768, 160, () => {});
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true }));
      sp.scale.set(2.1, 0.44, 1);
      sp.position.set(c.x, 2.05, 0.2);
      this.scene.add(sp);
      c.label = t;
    }
    const g = c.label.canvas.getContext('2d');
    g.clearRect(0, 0, 768, 160);
    g.fillStyle = 'rgba(14,21,32,.86)';
    g.beginPath(); g.roundRect(4, 4, 760, 152, 26); g.fill();
    g.fillStyle = '#ffd34d'; g.font = 'bold 50px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(title, 384, 64);
    g.fillStyle = '#e8eef6'; g.font = '38px system-ui, sans-serif';
    let s = status;
    while (g.measureText(s).width > 720 && s.length > 4) s = s.slice(0, -2);
    g.fillText(s === status ? s : `${s}…`, 384, 124);
    c.label.tex.needsUpdate = true;
  }

  sideServe(no, q) {
    const c = this.side[no];
    const via = c.x < 0 ? [-0.9, 1.95] : [2.1, 1.95];
    return this.walkTo(q.fig, [via, [c.x + 0.15, 0.85]], 1.2).then(() => { q.fig.rotation.y = 0; });
  }

  // La valija del pasajero del compañero: balanza y cinta
  sideBag(no, q) {
    const c = this.side[no];
    if (q.fig.userData.bag) q.fig.userData.bag.visible = false;
    const b = this.makeBag(['#1f3b57', '#7a1f2a', '#333', '#2d5a3d', '#6b4a2a'][Math.floor(Math.random() * 5)]);
    b.position.set(c.x - 0.6, 0, 1.15);
    this.scene.add(b);
    this.moveObj(b, new THREE.Vector3(c.scaleX, 0.24, 0.3), 0.7, () => {
      b.rotation.z = Math.PI / 2; b.position.y = 0.38;
      setTimeout(() => this.moveObj(b, new THREE.Vector3(c.scaleX, 0.38, -2.2), 1.2, () => {
        this.moveObj(b, new THREE.Vector3(-10, 0.38, -2.2), 4 + (c.scaleX + 10) / 4, () => this.scene.remove(b));
      }), 1800);
    });
  }

  sideDismiss(no, q, kind) {
    const c = this.side[no];
    const left = c.x < 0;
    const path = kind === 'accept'
      ? (left ? [[-5.6, 2.2], [-12, 2.6]] : [[5.6, 2.4], [12, 3]])
      : (left ? [[-3.2, 2.5], [-12, 2.9]] : [[3.2, 2.5], [12, 3]]);
    this.walkTo(q.fig, path, 1.3).then(() => this.scene.remove(q.fig));
  }

  // Girar la cabeza para mirar el mostrador de un compañero (null = volver al propio)
  lookAtCounter(no) {
    if (!this.camHome) this.camHome = { pos: this.camBase.clone(), tgt: this.camTarget.clone() };
    const c = no && this.side?.[no];
    this.camGoal = c
      ? { pos: new THREE.Vector3(c.x * 0.2, 1.75, -1.45), tgt: new THREE.Vector3(c.x * 1.02, 1.05, 1.1) }
      : this.camHome;
  }

  callNext() {
    const q = this.takeFront();
    if (!q) return Promise.resolve();
    this.current = q;
    return this.walkTo(q.fig, [[this.front[0], 1.8], [this.spot.x, this.spot.z]], 1.25).then(() => {
      q.fig.rotation.y = 0;
    });
  }

  // Globito con un ícono (Material Design Icons) sobre alguien de la fila o de la sala:
  // el carácter de la gente y cómo la va llevando con la espera. Desaparece solo.
  queueBubble(icon, color = '#1f6fe0') {
    const ch = mdiChar(icon);
    if (!ch) return;
    if (!document.fonts.check('64px "Material Design Icons"')) { document.fonts.load('64px "Material Design Icons"'); return; }
    const figs = [...this.queue.map((q) => q.fig).slice(0, 10), ...(this.seated || [])].filter((f) => f.visible && !f.userData.bubble);
    if (!figs.length) return;
    const fig = figs[Math.floor(Math.random() * figs.length)];
    const t = canvasTex(128, 128, (g) => {
      g.fillStyle = '#fff'; g.strokeStyle = '#0e2c62'; g.lineWidth = 6;
      g.beginPath(); g.roundRect(8, 8, 112, 86, 26); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(50, 92); g.lineTo(62, 120); g.lineTo(76, 92); g.fill();
      g.beginPath(); g.moveTo(50, 93); g.lineTo(62, 120); g.lineTo(76, 93); g.stroke();
      g.fillStyle = color; g.font = '64px "Material Design Icons"'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ch, 64, 53);
    });
    // Mismo tamaño en pantalla, esté cerca (la fila) o lejos (la sala de la puerta)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthTest: false, sizeAttenuation: false }));
    sp.renderOrder = 10;
    sp.position.set(0, 2.25, 0);
    fig.add(sp);
    fig.userData.bubble = sp;
    let k = 0;
    const anim = (dt) => {
      k += dt;
      const s = 0.1 * Math.min(1, 0.5 + k * 3) * (k > 2.9 ? Math.max(0.01, 1 - (k - 2.9) * 4) : 1);
      sp.scale.set(s, s, 1);
      sp.position.y = 2.25 + Math.sin(k * 3) * 0.03;
      if (k > 3.15) {
        fig.remove(sp); fig.userData.bubble = null;
        sp.material.map.dispose(); sp.material.dispose();
        this.animators.splice(this.animators.indexOf(anim), 1);
      }
    };
    this.animators.push(anim);
  }

  setSway(on) { this.sway = on; }
  // 0 tranquila · 1 impaciente (se balancean) · 2 enojada (saltitos y brazos arriba)
  setQueueMood(level) {
    this.queueMood = level;
    this.queue.forEach((q) => { if (!level) q.fig.position.y = 0; if (level < 2) q.fig.userData.arms?.forEach((a) => { a.rotation.x = 0; }); });
  }

  dismiss(kind) {
    const q = this.current;
    if (!q) return;
    this.current = null;
    this.bags.forEach((b) => this.scene.remove(b));
    this.bags = [];
    this.setScale(null);
    const path = kind === 'accept' ? this.exitPaths.accept : this.exitPaths.other;
    if (kind === 'accept' && q.fig.userData.bag && this.hideBagOnAccept !== false) q.fig.userData.bag.visible = false;
    q.fig.rotation.z = 0;
    this.walkTo(q.fig, path, 1.3).then(() => this.scene.remove(q.fig));
  }

  // Valijas del pasajero en el mostrador
  showBags(n) {
    const q = this.current;
    if (!q) return;
    if (q.fig.userData.bag) q.fig.userData.bag.visible = false;
    for (let i = 0; i < n; i++) {
      const b = this.makeBag(['#1f3b57', '#7a1f2a', '#333', '#2d5a3d'][i % 4]);
      b.position.set(COUNTER_SPOT.x - 0.75 - i * 0.35, 0, COUNTER_SPOT.z + 0.35);
      this.scene.add(b);
      this.bags.push(b);
    }
  }
  placeBagOnScale(i, kg) {
    const b = this.bags[i];
    if (!b) return;
    this.moveObj(b, new THREE.Vector3(SCALE_POS.x, 0.24, 0.3), 0.6, () => {
      b.rotation.z = Math.PI / 2; b.position.y = 0.38;
      this.setScale(kg);
    });
  }
  updateScale(kg) { this.setScale(kg); }
  sendBag(i) {
    const b = this.bags[i];
    if (!b) return;
    this.setScale(null);
    this.moveObj(b, new THREE.Vector3(SCALE_POS.x, 0.38, -2.2), 1.2, () => {
      this.moveObj(b, new THREE.Vector3(-10, 0.38, -2.2), 4, () => { b.visible = false; });
    });
  }
  returnBag(i) {
    const b = this.bags[i];
    if (!b) return;
    this.setScale(null);
    b.rotation.z = 0;
    this.moveObj(b, new THREE.Vector3(COUNTER_SPOT.x - 0.75 - i * 0.35, 0, COUNTER_SPOT.z + 0.35), 0.6);
  }

  // ----------------------------------------------------------------
  walkTo(fig, points, speed = 1.2) {
    return new Promise((resolve) => {
      const w = { fig, points: points.map(([x, z]) => new THREE.Vector3(x, 0, z)), speed, resolve, phase: 0 };
      this.walkers = this.walkers.filter((o) => o.fig !== fig || o.idle || o.ambient);
      this.walkers.push(w);
    });
  }
  moveObj(obj, to, dur, done) {
    this.movers.push({ obj, from: obj.position.clone(), to, dur, t: 0, done });
  }

  updateBoard(flights, now) {
    const g = this.boardCanvas.getContext('2d');
    const w = 1024, h = 400;
    g.fillStyle = '#0a0f1a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd34d'; g.font = 'bold 34px monospace';
    g.fillText('PARTIDAS · DEPARTURES', 24, 46);
    g.textAlign = 'right'; g.fillText(fmtTime(now), w - 24, 46); g.textAlign = 'left';
    g.fillStyle = '#7f8ea3'; g.font = '24px monospace';
    g.fillText('HORA   VUELO    DESTINO              PUERTA  ESTADO', 24, 92);
    flights.forEach((f, i) => {
      const y = 128 + i * 38;
      g.fillStyle = i % 2 ? '#0f1726' : '#121c2e'; g.fillRect(12, y - 28, w - 24, 36);
      const closed = now >= f.closeTime || f.cancelled;
      const left = Math.round((f.closeTime - now) / 60000);
      g.font = 'bold 26px monospace'; g.fillStyle = '#f2f2f2';
      g.fillText(`${f.dep}  ${f.no}  ${f.city.toUpperCase().padEnd(19).slice(0, 19)}  ${f.gate.padEnd(5)}`, 24, y);
      g.fillStyle = closed ? '#ff6a5a' : left <= 20 ? '#ffc04d' : '#5bff8c';
      const notOpen = now < f.openTime;
      if (notOpen && !f.cancelled) g.fillStyle = '#7f8ea3';
      if (f.delayed && !closed) g.fillStyle = '#ffc04d';
      g.fillText(f.cancelled ? 'CANCELADO' : f.delayed && !closed ? `DEMORADO ${f.delayed}` : closed ? 'CERRADO' : notOpen ? 'PRÓXIMO' : left <= 20 ? 'ÚLT. LLAMADO' : 'CHECK-IN', 780, y);
    });
    g.fillStyle = '#7f8ea3'; g.font = '20px monospace';
    g.fillText(`${STATION.code} · ${STATION.name}`, 24, h - 16);
    this.boardTex.needsUpdate = true;
  }

  // ----------------------------------------------------------------
  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.animators.forEach((a) => a(dt, t));
    if (this.queueMood) {
      const walking = new Set(this.walkers.map((w) => w.fig));
      this.queue.forEach((q, i) => {
        if (walking.has(q.fig)) return;
        const m = this.queueMood;
        q.fig.position.y = Math.abs(Math.sin(t * (m === 2 ? 8 : 3.5) + i * 1.7)) * (m === 2 ? 0.07 : 0.025);
        if (m === 2 && i % 3 === 0) q.fig.userData.arms?.forEach((a, k) => { a.rotation.x = -2.4 + Math.sin(t * 6 + k) * 0.4; });
      });
    }

    for (const w of [...this.walkers]) {
      const ud = w.fig.userData;
      if (w.idle) {
        ud.arms?.forEach((a, i) => { a.rotation.x = Math.sin(t * 2 + i) * 0.15 - 0.5; });
        continue;
      }
      if (w.ambient) {
        w.fig.position.x += w.dir * w.speed * dt;
        const [minX, maxX] = this.ambientBounds || [-9.5, 9.5];
        if (this.ambientWrap) {
          // Salen por un pasillo y vuelven a aparecer por el otro
          if (w.fig.position.x > maxX) w.fig.position.x = minX;
          if (w.fig.position.x < minX) w.fig.position.x = maxX;
        } else {
          if (w.fig.position.x > maxX) { w.dir = -1; w.fig.position.x = maxX; }
          if (w.fig.position.x < minX) { w.dir = 1; w.fig.position.x = minX; }
        }
        w.fig.rotation.y = w.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.animateLegs(ud, t * 6 + w.phase, 1);
        continue;
      }
      const target = w.points[0];
      const pos = w.fig.position;
      const d = target.clone().sub(pos);
      const dist = d.length();
      if (dist < 0.03) {
        w.points.shift();
        if (!w.points.length) {
          this.animateLegs(ud, 0, 0);
          this.walkers.splice(this.walkers.indexOf(w), 1);
          w.resolve();
        }
        continue;
      }
      const step = Math.min(dist, w.speed * dt);
      pos.add(d.normalize().multiplyScalar(step));
      w.fig.rotation.y = Math.atan2(-d.x, -d.z);
      w.phase += dt * 7;
      this.animateLegs(ud, w.phase, 1);
    }

    for (const m of [...this.movers]) {
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      m.obj.position.lerpVectors(m.from, m.to, e);
      if (k >= 1) { this.movers.splice(this.movers.indexOf(m), 1); m.done?.(); }
    }

    // Respiración del pasajero actual (o tambaleo si está alcoholizado)
    if (this.current) {
      this.current.fig.userData.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 1.4 + i) * 0.04; });
      this.current.fig.rotation.z = this.sway ? Math.sin(t * 1.3) * 0.07 : 0;
    }

    if (this.camGoal) {
      this.camBase.lerp(this.camGoal.pos, 0.06);
      this.camTarget.lerp(this.camGoal.tgt, 0.06);
    }
    this.look.x += (this.look.tx - this.look.x) * 0.05;
    this.look.y += (this.look.ty - this.look.y) * 0.05;
    this.camera.position.copy(this.camBase);
    const tgt = this.camTarget.clone();
    tgt.x += this.look.x * 6; tgt.y -= this.look.y * 6;
    this.camera.lookAt(tgt);
    this.renderer.render(this.scene, this.camera);
  }

  animateLegs(ud, phase, amp) {
    if (!ud.legs) return;
    const s = Math.sin(phase) * 0.45 * amp;
    ud.legs[0].rotation.x = s; ud.legs[1].rotation.x = -s;
    ud.arms[0].rotation.x = -s * 0.7; ud.arms[1].rotation.x = s * 0.7;
  }
}
