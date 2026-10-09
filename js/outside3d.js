// Lo que se ve por los ventanales:
//  · Hall de check-in → lado tierra: calle con autos, taxis y colectivos, vereda, árboles y la ciudad.
//  · Sala de embarque → lado aire: plataforma, nuestro avión en la manga, pista con aviones que aterrizan y carretean.
import * as THREE from 'three';
import { canvasTex } from './scene3d.js';
import { buildPerson } from './people3d.js';

const std = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ------------------------------------------------------------------
// LADO TIERRA (hall de check-in)
// ------------------------------------------------------------------
export function buildCityside(scene, animators) {
  // Fondo: ciudad al atardecer
  const city = canvasTex(2048, 640, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.75);
    sky.addColorStop(0, '#4f6fa8'); sky.addColorStop(0.55, '#e6a173'); sky.addColorStop(1, '#f7d6a6');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w * 0.7, h * 0.62, 6, w * 0.7, h * 0.62, 220);
    sun.addColorStop(0, 'rgba(255,240,200,1)'); sun.addColorStop(0.25, 'rgba(255,210,150,.6)'); sun.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,225,205,.3)';
    for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(Math.random() * w, 50 + Math.random() * 150, 90 + Math.random() * 140, 10 + Math.random() * 12, 0, 0, Math.PI * 2); g.fill(); }
    // Edificios lejanos (silueta)
    g.fillStyle = '#8c7d86';
    for (let x = 0; x < w; x += 26) { const bh = 40 + Math.random() * 110; g.fillRect(x, h * 0.78 - bh, 24, bh); }
    // Edificios cercanos con ventanas encendidas
    let x = -20;
    while (x < w) {
      const bw = 90 + Math.random() * 160, bh = 120 + Math.random() * 300;
      const tone = pick(['#5d5560', '#6b6270', '#4f4a55', '#776a6a', '#5b6573']);
      g.fillStyle = tone; g.fillRect(x, h * 0.86 - bh, bw, bh);
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + bw - 10, h * 0.86 - bh, 10, bh);
      for (let wy = h * 0.86 - bh + 14; wy < h * 0.86 - 16; wy += 22) {
        for (let wx = x + 10; wx < x + bw - 18; wx += 18) {
          g.fillStyle = Math.random() < 0.45 ? `rgba(255,${200 + Math.random() * 40},${120 + Math.random() * 60},.9)` : 'rgba(40,40,55,.6)';
          g.fillRect(wx, wy, 9, 12);
        }
      }
      if (Math.random() < 0.25) { g.fillStyle = pick(['#d23c3c', '#2a8fd6', '#f2c14e']); g.fillRect(x + 12, h * 0.86 - bh - 26, bw - 24, 20); }
      x += bw + 6 + Math.random() * 20;
    }
    // Árboles de la vereda de enfrente
    for (let i = 0; i < 26; i++) {
      const tx = Math.random() * w;
      g.fillStyle = '#3b3326'; g.fillRect(tx - 3, h * 0.86, 6, 30);
      g.fillStyle = pick(['#3d5f3a', '#486b40', '#56783f']);
      g.beginPath(); g.ellipse(tx, h * 0.84, 34 + Math.random() * 20, 30 + Math.random() * 14, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#6e6862'; g.fillRect(0, h * 0.9, w, h * 0.1);
  }).tex;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(70, 17), new THREE.MeshBasicMaterial({ map: city, fog: false }));
  back.position.set(0, 7.2, 22.5); back.rotation.y = Math.PI; scene.add(back);

  // Vereda, calle con carriles y vereda de enfrente
  const ground = (w, d, z, color, rough = 0.9) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(color, rough));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.012, z); m.receiveShadow = true; scene.add(m); return m;
  };
  ground(80, 2.2, 14.15, '#b9b4ac');
  const road = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#3a3c40'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#e8e2d0';
    for (let x = 0; x < w; x += 128) g.fillRect(x, h / 2 - 3, 70, 6);
    g.fillStyle = '#f2c14e'; g.fillRect(0, 6, w, 5); g.fillRect(0, h - 11, w, 5);
  }).tex;
  road.wrapS = THREE.RepeatWrapping; road.repeat.set(8, 1);
  const rm = new THREE.Mesh(new THREE.PlaneGeometry(80, 4.4), new THREE.MeshStandardMaterial({ map: road, roughness: 0.85 }));
  rm.rotation.x = -Math.PI / 2; rm.position.set(0, 0.014, 17.45); rm.receiveShadow = true; scene.add(rm);
  ground(80, 2.4, 20.85, '#b0aaa1');
  // Cordón
  const curb = std('#d7d2c9', 0.8);
  [15.25, 19.65].forEach((z) => { const c = new THREE.Mesh(new THREE.BoxGeometry(80, 0.14, 0.2), curb); c.position.set(0, 0.07, z); scene.add(c); });

  // Faroles y árboles en la vereda del aeropuerto
  const pole = std('#3c434d', 0.4, { metalness: 0.6 });
  const lamp = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd9a0', emissiveIntensity: 1.5 });
  for (let x = -21; x <= 21; x += 7) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 10), pole); p.position.set(x, 2.5, 14.7); scene.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), pole); arm.position.set(x, 4.95, 15.2); scene.add(arm);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.5), lamp); l.position.set(x, 4.88, 15.7); scene.add(l);
  }
  const trunk = std('#5a4632', 0.9), leaves = [std('#4a7a43', 0.85), std('#5e8a4a', 0.85)];
  for (let x = -24; x <= 24; x += 6) {
    const tx = x + 3.5;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.2, 8), trunk); t.position.set(tx, 1.1, 20.9); scene.add(t);
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.8, 1.1), 10, 8), leaves[i % 2]); c.position.set(tx + rnd(-0.5, 0.5), 2.6 + rnd(0, 0.8), 20.9 + rnd(-0.4, 0.4)); scene.add(c); }
  }
  // Parada de colectivo
  const shelter = new THREE.Group();
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1.2), std('#2b3442', 0.5)); roof.position.y = 2.4; shelter.add(roof);
  [-1.4, 1.4].forEach((x) => { const pst = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), pole); pst.position.set(x, 1.2, -0.5); shelter.add(pst); });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.05), std('#1f6fb0', 0.5)); sign.position.set(1.7, 2.2, 0); shelter.add(sign);
  shelter.position.set(-9, 0, 14.4); scene.add(shelter);

  // Tránsito: autos, taxis porteños y colectivos
  const cars = [];
  const lanes = [{ z: 16.4, dir: 1 }, { z: 18.5, dir: -1 }];
  for (let i = 0; i < 9; i++) {
    const lane = lanes[i % 2];
    const kind = i % 4 === 3 ? 'bus' : i % 3 === 0 ? 'taxi' : 'car';
    const v = makeVehicle(kind);
    v.position.set(rnd(-30, 30), 0, lane.z);
    v.rotation.y = lane.dir > 0 ? 0 : Math.PI;
    scene.add(v);
    cars.push({ v, dir: lane.dir, speed: kind === 'bus' ? rnd(5, 7) : rnd(7, 12) });
  }
  animators.push((dt) => {
    cars.forEach((c) => {
      c.v.position.x += c.dir * c.speed * dt;
      if (c.v.position.x > 34) c.v.position.x = -34;
      if (c.v.position.x < -34) c.v.position.x = 34;
      c.v.userData.wheels?.forEach((w) => { w.rotation.y -= c.speed * dt * 2.2 * c.dir; });
    });
  });
}

function makeVehicle(kind) {
  const g = new THREE.Group();
  const glass = std('#1c2430', 0.15, { metalness: 0.4 });
  const wheel = std('#151515', 0.8);
  let len, wid, h, color;
  if (kind === 'bus') { len = 11; wid = 2.5; h = 2.9; color = pick(['#e2e2dc', '#2f7d4f', '#c9372c', '#2a5c9e']); }
  else { len = 4.3; wid = 1.75; h = 0.75; color = kind === 'taxi' ? '#111214' : pick(['#c9c9c9', '#8a1f24', '#1f4e79', '#e9e7e1', '#2d2d2d', '#556b2f']); }
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, h, wid), std(color, 0.35, { metalness: 0.4 }));
  body.position.y = (kind === 'bus' ? 0.35 : 0.3) + h / 2; body.castShadow = true; g.add(body);
  if (kind === 'bus') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.3, wid + 0.02), std('#f2c14e', 0.5)); stripe.position.y = 1.1; g.add(stripe);
    const win = new THREE.Mesh(new THREE.BoxGeometry(len - 1.2, 0.9, wid + 0.02), glass); win.position.set(0.2, 2.25, 0); g.add(win);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, wid - 0.3), glass); front.position.set(len / 2 + 0.01, 2.1, 0); g.add(front);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.5, 0.55, wid * 0.88), kind === 'taxi' ? std('#f2c418', 0.4) : glass);
    cabin.position.set(-0.15, 1.3, 0); g.add(cabin);
    if (kind === 'taxi') {
      const winT = new THREE.Mesh(new THREE.BoxGeometry(len * 0.48, 0.38, wid * 0.9), glass); winT.position.set(-0.15, 1.28, 0); g.add(winT);
      const tsign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.25), new THREE.MeshStandardMaterial({ color: '#fff7c2', emissive: '#ffe680', emissiveIntensity: 0.8 })); tsign.position.set(-0.1, 1.64, 0); g.add(tsign);
    }
    const lights = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff4d0', emissiveIntensity: 1 });
    [-0.6, 0.6].forEach((z) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.3), lights); l.position.set(len / 2 + 0.01, 0.75, z); g.add(l); });
    const red = new THREE.MeshStandardMaterial({ color: '#a00', emissive: '#ff2020', emissiveIntensity: 0.8 });
    [-0.6, 0.6].forEach((z) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.3), red); l.position.set(-len / 2 - 0.01, 0.75, z); g.add(l); });
  }
  const wheels = [];
  const wx = kind === 'bus' ? [len / 2 - 1.6, -len / 2 + 2] : [len / 2 - 0.8, -len / 2 + 0.8];
  wx.forEach((x) => [-wid / 2, wid / 2].forEach((z) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(kind === 'bus' ? 0.5 : 0.33, kind === 'bus' ? 0.5 : 0.33, 0.25, 14), wheel);
    w.rotation.x = Math.PI / 2; w.position.set(x, kind === 'bus' ? 0.5 : 0.33, z); g.add(w); wheels.push(w);
  }));
  g.userData.wheels = wheels;
  return g;
}

// ------------------------------------------------------------------
// LADO AIRE (sala de embarque)
// ------------------------------------------------------------------
// Superficie plana con forma (ala, estabilizador, deriva) a partir de un contorno 2D
function surface(points, thick, mat) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: thick * 0.4, bevelSegments: 2 });
  geo.translate(0, 0, -thick / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

export function makePlane({ livery = 'AP', len = 40 } = {}) {
  const g = new THREE.Group();
  const L = len, R = len * 0.052;
  const white = std('#f2f4f7', 0.3, { metalness: 0.15 });
  const tailCol = livery === 'AP' ? '#123a63' : pick(['#7a1f2a', '#1f6b4f', '#4a3b8c', '#c0392b']);
  const navy = std(tailCol, 0.35);
  const accent = std(livery === 'AP' ? '#ffd34d' : '#f2f2f2', 0.4);
  const grey = std('#c3c9d0', 0.35, { metalness: 0.45 });
  const dark = std('#1e2733', 0.25);

  // Fuselaje redondeado: nariz, sección constante y cola afinada hacia arriba
  const prof = [[0, 0], [0.012, 0.42], [0.03, 0.68], [0.06, 0.88], [0.1, 0.98], [0.14, 1], [0.7, 1], [0.8, 0.86], [0.9, 0.58], [0.97, 0.32], [1, 0.18]];
  const fusGeo = new THREE.LatheGeometry(prof.map(([t, r]) => new THREE.Vector2(r * R, (0.5 - t) * L)), 32);
  fusGeo.rotateZ(-Math.PI / 2);
  const fus = new THREE.Mesh(fusGeo, white); fus.castShadow = true; g.add(fus);
  // Línea de ventanillas, franja de la compañía y parabrisas
  [-1, 1].forEach((s) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(L * 0.56, R * 0.11, R * 0.04), dark); win.position.set(-L * 0.05, R * 0.3, s * R * 0.985); g.add(win);
    const band = new THREE.Mesh(new THREE.BoxGeometry(L * 0.66, R * 0.13, R * 0.04), navy); band.position.set(-L * 0.04, R * 0.05, s * R * 0.99); g.add(band);
    const wind = new THREE.Mesh(new THREE.BoxGeometry(L * 0.028, R * 0.2, R * 0.05), dark); wind.position.set(L * 0.44, R * 0.36, s * R * 0.62); wind.rotation.y = s * 0.5; g.add(wind);
  });
  // Alas en flecha y estabilizadores horizontales
  const wing = surface([[0.1, 0], [-0.14, 0.46], [-0.19, 0.46], [-0.12, 0.06], [-0.12, -0.06], [-0.19, -0.46], [-0.14, -0.46]].map(([x, y]) => [x * L, y * L]), R * 0.16, grey);
  wing.rotation.x = Math.PI / 2; wing.position.set(0, -R * 0.42, 0); g.add(wing);
  const hstab = surface([[-0.4, 0], [-0.47, 0.15], [-0.5, 0.15], [-0.48, 0.02], [-0.48, -0.02], [-0.5, -0.15], [-0.47, -0.15]].map(([x, y]) => [x * L, y * L]), R * 0.1, grey);
  hstab.rotation.x = Math.PI / 2; hstab.position.y = R * 0.32; g.add(hstab);
  // Deriva con forma real y logo
  const fin = surface([[-0.33, 0.55], [-0.45, 0.55 + 3.6], [-0.5, 0.55 + 3.6], [-0.49, 0.55]].map(([x, y]) => [x * L, y * R]), R * 0.12, navy);
  g.add(fin);
  const band = surface([[-0.415, 2.55], [-0.435, 3.05], [-0.475, 3.05], [-0.468, 2.55]].map(([x, y]) => [x * L, y * R]), R * 0.15, accent);
  g.add(band);
  // Motores con pilón y toma
  [-1, 1].forEach((s) => {
    const z = s * L * 0.17;
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.42, R * 0.36, L * 0.11, 24), white); eng.rotation.z = Math.PI / 2; eng.position.set(L * 0.04, -R * 1.02, z); eng.castShadow = true; g.add(eng);
    const inlet = new THREE.Mesh(new THREE.TorusGeometry(R * 0.38, R * 0.05, 8, 24), grey); inlet.rotation.y = Math.PI / 2; inlet.position.set(L * 0.097, -R * 1.02, z); g.add(inlet);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(R * 0.36, 24), dark); fan.rotation.y = Math.PI / 2; fan.position.set(L * 0.094, -R * 1.02, z); g.add(fan);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(L * 0.06, R * 0.45, R * 0.1), grey); pylon.position.set(L * 0.02, -R * 0.68, z); g.add(pylon);
  });
  // Tren de aterrizaje
  const gearM = std('#1a1a1a', 0.7);
  [[L * 0.36, 0, 2], [-L * 0.03, R * 0.55, 4], [-L * 0.03, -R * 0.55, 4]].forEach(([x, z, n]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.05, R * 0.05, R * 0.9, 8), grey); leg.position.set(x, -R * 1.25, z); g.add(leg);
    for (let i = 0; i < n; i++) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.2, R * 0.14, 16), gearM); wh.rotation.x = Math.PI / 2;
      wh.position.set(x + (n > 2 ? (i < 2 ? -1 : 1) * R * 0.22 : 0), -R * 1.68, z + ((i % 2) ? 1 : -1) * R * 0.1); g.add(wh);
    }
  });
  // Luz anticolisión
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(R * 0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }));
  beacon.position.set(0, R * 1.02, 0); g.add(beacon);
  g.userData = { beacon, groundY: R * 1.88 };
  return g;
}

// Tractor de equipaje con conductor y carros
export function makeTug() {
  const tug = new THREE.Group();
  const yellow = std('#f2c14e', 0.45, { metalness: 0.2 });
  const darkM = std('#262b33', 0.5);
  const glass = std('#9fc3dc', 0.1, { metalness: 0.3, transparent: true, opacity: 0.55 });
  const tire = std('#141414', 0.85), rim = std('#9aa1aa', 0.3, { metalness: 0.7 });
  const wheel = (x, z, r = 0.32) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.26, 20), tire); w.rotation.x = Math.PI / 2; w.position.set(x, r, z); tug.add(w);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.28, 14), rim); h.rotation.x = Math.PI / 2; h.position.set(x, r, z); tug.add(h);
  };
  // Tractor
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 1.5), yellow); chassis.position.set(0, 0.62, 0); chassis.castShadow = true; tug.add(chassis);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 1.4), yellow); hood.position.set(0.75, 1.05, 0); tug.add(hood);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 1.2), darkM); grille.position.set(1.31, 0.8, 0); tug.add(grille);
  const cabFrame = std('#3a414b', 0.4, { metalness: 0.5 });
  [[-0.35, 0.65], [-0.35, -0.65], [-1.15, 0.65], [-1.15, -0.65]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), cabFrame); p.position.set(x, 1.5, z); tug.add(p); });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.5), yellow); roof.position.set(-0.75, 2.12, 0); tug.add(roof);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 1.3), glass); ws.position.set(-0.33, 1.6, 0); tug.add(ws);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff9a1a', emissive: '#ff8a00', emissiveIntensity: 1.5 })); beacon.position.set(-0.75, 2.24, 0); tug.add(beacon);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.5), darkM); seat.position.set(-0.8, 1.0, 0); tug.add(seat);
  // Conductor con chaleco reflectante
  const driver = buildPerson({ sex: 'M', age: 38, skin: 2, hairColor: '#2a1d14', hairStyle: 'short', shirt: '#ff8a1a', pants: '#2b3442', eye: 0, nose: 1, brows: 'thick', smile: false, shape: 'oval' });
  driver.legs.forEach((l) => { l.rotation.x = Math.PI / 2.2; });
  driver.g.position.set(-0.8, 0.14, 0); driver.g.rotation.y = -Math.PI / 2; driver.g.scale.setScalar(0.95);
  tug.add(driver.g);
  wheel(0.85, 0.72); wheel(0.85, -0.72); wheel(-0.85, 0.72); wheel(-0.85, -0.72);
  // Carros con baranda y valijas
  const colors = ['#7a1f2a', '#1f3b57', '#2d5a3d', '#333', '#8a6d3b', '#5a3d7a', '#b0b0b0'];
  for (let i = 1; i <= 3; i++) {
    const x0 = -1.6 - 3 * i + 1.5;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), cabFrame); bar.position.set(x0 + 1.55, 0.45, 0); tug.add(bar);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.45), std('#5c636c', 0.5, { metalness: 0.4 })); bed.position.set(x0, 0.55, 0); bed.castShadow = true; tug.add(bed);
    [0.7, -0.7].forEach((z) => { const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.05), cabFrame); rail.position.set(x0, 1.3, z); tug.add(rail); });
    [[1.15, 0.7], [1.15, -0.7], [-1.15, 0.7], [-1.15, -0.7], [0, 0.7], [0, -0.7]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), cabFrame); p.position.set(x0 + x, 0.95, z); tug.add(p); });
    const roofC = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.05, 1.5), std('#2d5a8a', 0.6)); roofC.position.set(x0, 1.75, 0); tug.add(roofC);
    for (let k = 0; k < 7; k++) {
      const w = 0.4 + Math.random() * 0.25, hgt = 0.3 + Math.random() * 0.25, d = 0.55 + Math.random() * 0.25;
      const bag = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), std(pick(colors), 0.55)); bag.position.set(x0 - 0.9 + (k % 4) * 0.6, 0.62 + hgt / 2 + (k > 3 ? 0.35 : 0), (k % 2 ? 0.25 : -0.25)); bag.rotation.y = (Math.random() - 0.5) * 0.4; bag.castShadow = true; tug.add(bag);
    }
    [[0.9, 0.62], [0.9, -0.62], [-0.9, 0.62], [-0.9, -0.62]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 16), tire); w.rotation.x = Math.PI / 2; w.position.set(x0 + x, 0.2, z); tug.add(w); });
  }
  tug.userData.beacon = beacon;
  return tug;
}

export function buildAirside(scene, animators, { flightNo = '' } = {}) {
  // Cielo del anochecer y horizonte
  const sky = canvasTex(2048, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1a2848'); gr.addColorStop(0.55, '#a5605a'); gr.addColorStop(0.8, '#e6a06c'); gr.addColorStop(1, '#5e4a48');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 60; i++) g.fillRect(Math.random() * w, Math.random() * h * 0.35, 2, 2);
    g.fillStyle = '#3e3540'; for (let x = 0; x < w; x += 30) { const bh = 6 + Math.random() * 20; g.fillRect(x, h * 0.86 - bh, 28, bh); }
    g.fillStyle = 'rgba(255,220,150,.9)'; for (let i = 0; i < 80; i++) g.fillRect(Math.random() * w, h * 0.82 + Math.random() * 30, 3, 2);
  }).tex;
  const skyM = new THREE.Mesh(new THREE.PlaneGeometry(420, 90), new THREE.MeshBasicMaterial({ map: sky, fog: false }));
  skyM.position.set(0, 30, 160); skyM.rotation.y = Math.PI; scene.add(skyM);
  // Plataforma (hormigón con marcas)
  const apronT = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#7e7b78'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.strokeStyle = 'rgba(40,40,40,.35)'; g.lineWidth = 2;
    for (let i = 0; i <= w; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  }).tex;
  apronT.wrapS = apronT.wrapT = THREE.RepeatWrapping; apronT.repeat.set(30, 12);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(400, 150), new THREE.MeshStandardMaterial({ map: apronT, roughness: 0.9 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.012, 88); apron.receiveShadow = true; scene.add(apron);
  // Línea amarilla de guía del puesto y calle de rodaje
  const yel = new THREE.MeshBasicMaterial({ color: '#f2c14e' });
  const lead = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 30), yel); lead.rotation.x = -Math.PI / 2; lead.position.set(-2, 0.02, 34); scene.add(lead);
  const twy = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.3), yel); twy.rotation.x = -Math.PI / 2; twy.position.set(0, 0.02, 52); scene.add(twy);
  // Pista con borde, eje y luces
  const rwy = new THREE.Mesh(new THREE.PlaneGeometry(400, 45), std('#2f3134', 0.85)); rwy.rotation.x = -Math.PI / 2; rwy.position.set(0, 0.016, 85); scene.add(rwy);
  const white = new THREE.MeshBasicMaterial({ color: '#e9e9e4' });
  for (let x = -190; x < 190; x += 30) { const d = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.9), white); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.02, 85); scene.add(d); }
  [63.5, 106.5].forEach((z) => { const e = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.6), white); e.rotation.x = -Math.PI / 2; e.position.set(0, 0.02, z); scene.add(e); });
  const rl = new THREE.MeshBasicMaterial({ color: '#fff2c4' });
  for (let x = -190; x < 190; x += 12) [62.5, 107.5].forEach((z) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), rl); l.position.set(x, 0.3, z); scene.add(l); });
  const tl = new THREE.MeshBasicMaterial({ color: '#3a7cff' });
  for (let x = -190; x < 190; x += 10) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), tl); l.position.set(x, 0.25, 50); scene.add(l); }

  // Nuestro avión en la manga
  const ours = makePlane({ livery: 'AP', len: 44 });
  ours.position.set(-2, ours.userData.groundY, 36); ours.rotation.y = 0.35; scene.add(ours);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 16.5), std('#b8bec5', 0.5, { metalness: 0.3 }));
  bridge.position.set(10.5, 4.2, 21.5); bridge.rotation.y = 0.31; bridge.castShadow = true; scene.add(bridge);
  const bridgeLeg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.8, 0.5), std('#5a6069', 0.5)); bridgeLeg.position.set(12, 1.4, 25); scene.add(bridgeLeg);

  // Tractor de equipaje con carros, que va y viene
  const tug = makeTug();
  tug.position.set(-30, 0, 22); scene.add(tug);
  let tugDir = 1;

  // Avión que aterriza y avión que carretea (en loop)
  const lander = makePlane({ livery: 'other', len: 38 });
  scene.add(lander);
  const taxi = makePlane({ livery: Math.random() < 0.5 ? 'AP' : 'other', len: 36 });
  taxi.position.set(140, taxi.userData.groundY, 50); taxi.rotation.y = Math.PI; scene.add(taxi);
  let landT = 0, beacon = 0;
  const LAND_TIME = 34;
  animators.push((dt, t) => {
    // Aterrizaje: aproximación descendente, toque en la pista y frenado
    landT = (landT + dt) % LAND_TIME;
    const k = landT / LAND_TIME;
    const gy = lander.userData.groundY;
    let x, y, pitch = 0;
    if (k < 0.45) { const a = k / 0.45; x = -260 + a * 200; y = gy + (1 - a) * 38; pitch = 0.06; }
    else if (k < 0.85) { const a = (k - 0.45) / 0.4; x = -60 + (1 - (1 - a) * (1 - a)) * 230; y = gy; pitch = a < 0.1 ? 0.04 : 0; }
    else { x = 400; y = -50; }
    lander.position.set(x, y, 85); lander.rotation.set(0, 0, pitch);
    // Rodaje lento por la calle de rodaje
    taxi.position.x -= 4.5 * dt;
    if (taxi.position.x < -160) taxi.position.x = 160;
    // Tractor de equipaje
    tug.position.x += tugDir * 4 * dt;
    if (tug.position.x > 22) { tugDir = -1; tug.rotation.y = Math.PI; }
    if (tug.position.x < -30) { tugDir = 1; tug.rotation.y = 0; }
    // Luces anticolisión
    beacon += dt;
    const on = Math.floor(beacon * 1.5) % 2 === 0;
    [ours, lander, taxi].forEach((p) => { p.userData.beacon.visible = on; });
    tug.userData.beacon.visible = Math.floor(beacon * 2.4) % 2 === 0;
  });
}
