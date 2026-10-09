// Personajes 3D: cuerpo con articulaciones, peinados y cara dibujada a partir de los mismos rasgos
// que el retrato del documento (piel, ojos, cejas, nariz, boca, anteojos, rubor, arrugas).
import * as THREE from 'three';
import { SKIN, EYES } from './docs.js';

const faceCache = new Map();
const matCache = new Map();
const mat = (color, rough = 0.8, extra = {}) => {
  const k = `${color}|${rough}|${JSON.stringify(extra)}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));
  return matCache.get(k);
};
const shade = (hex, f) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
};
// Número estable a partir de los rasgos (para variar ropa sin azar)
const hashOf = (f) => [...`${f.shirt}${f.hairColor}${f.skin}${f.eye}${f.nose}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// ------------------------------------------------------------------
// Cara (textura transparente sobre el frente de la cabeza)
// ------------------------------------------------------------------
function faceTexture(f) {
  const kid = (f.age ?? 30) < 12;
  const key = [f.skin, f.eye, f.brows, f.nose, f.smile, f.glasses, f.flushed, f.age >= 55, f.sex, f.hairColor, f.hairStyle, kid].join('|');
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const W = 256, cx = 128;
  const eyeY = 108, eyeDX = 36;
  const browCol = f.hairStyle === 'bald' ? '#5a463a' : shade(f.hairColor, 0.8);
  // Cejas
  g.strokeStyle = browCol; g.lineCap = 'round';
  g.lineWidth = kid ? 4 : f.brows === 'thick' ? 11 : 6;
  [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(cx + s * (eyeDX + 22), eyeY - 22); g.quadraticCurveTo(cx + s * eyeDX, eyeY - 38, cx + s * (eyeDX - 19), eyeY - 26); g.stroke(); });
  // Ojos
  [-1, 1].forEach((s) => {
    const ex = cx + s * eyeDX;
    const ew = kid ? 21 : 19, eh = kid ? 16 : 12.5, ir = kid ? 12.5 : 10;
    g.fillStyle = '#fbfbf8'; g.beginPath(); g.ellipse(ex, eyeY, ew, eh, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = EYES[f.eye] || '#3b2a1d'; g.beginPath(); g.arc(ex, eyeY + 1, ir, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(ex, eyeY + 1, kid ? 6 : 4.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 3.5, eyeY - 3, 2.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,25,20,.85)'; g.lineWidth = f.sex === 'F' ? 3.4 : 2.2;
    g.beginPath(); g.ellipse(ex, eyeY, ew, eh, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    if (f.sex === 'F' && !kid) { g.beginPath(); g.moveTo(ex + s * 18, eyeY - 4); g.lineTo(ex + s * 25, eyeY - 10); g.stroke(); }
  });
  // Nariz (sombra)
  g.strokeStyle = kid ? 'rgba(150,80,60,.35)' : 'rgba(90,50,30,.5)'; g.lineWidth = kid ? 3 : 4;
  g.beginPath();
  if (kid) { g.moveTo(cx - 7, eyeY + 32); g.quadraticCurveTo(cx, eyeY + 38, cx + 7, eyeY + 32); }
  else if (f.nose === 0) { g.moveTo(cx - 2, eyeY + 8); g.lineTo(cx - 8, eyeY + 34); g.quadraticCurveTo(cx, eyeY + 40, cx + 8, eyeY + 34); }
  else if (f.nose === 1) { g.moveTo(cx - 3, eyeY + 6); g.quadraticCurveTo(cx - 14, eyeY + 34, cx - 4, eyeY + 38); g.quadraticCurveTo(cx + 6, eyeY + 40, cx + 10, eyeY + 34); }
  else { g.moveTo(cx - 10, eyeY + 32); g.quadraticCurveTo(cx, eyeY + 42, cx + 10, eyeY + 32); }
  g.stroke();
  // Rubor (natural o por alcohol)
  [-1, 1].forEach((s) => {
    const rg = g.createRadialGradient(cx + s * 46, eyeY + 30, 2, cx + s * 46, eyeY + 30, 24);
    rg.addColorStop(0, f.flushed ? 'rgba(220,60,50,.55)' : kid ? 'rgba(240,110,110,.38)' : 'rgba(230,120,110,.18)'); rg.addColorStop(1, 'rgba(230,120,110,0)');
    g.fillStyle = rg; g.fillRect(cx + s * 46 - 26, eyeY + 4, 52, 52);
  });
  // Arrugas
  if (f.age >= 55) {
    g.strokeStyle = 'rgba(80,45,30,.22)'; g.lineWidth = 2;
    [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(cx + s * (eyeDX + 20), eyeY + 2); g.lineTo(cx + s * (eyeDX + 27), eyeY + 6); g.stroke(); g.beginPath(); g.arc(cx + s * 26, eyeY + 52, 16, s > 0 ? Math.PI * 1.1 : Math.PI * 1.6, s > 0 ? Math.PI * 1.4 : Math.PI * 1.9); g.stroke(); });
    g.beginPath(); g.moveTo(cx - 22, eyeY - 44); g.quadraticCurveTo(cx, eyeY - 48, cx + 22, eyeY - 44); g.stroke();
  }
  // Boca
  const my = eyeY + 70;
  g.strokeStyle = f.sex === 'F' ? '#b5534f' : '#8a4a3c'; g.lineWidth = f.sex === 'F' ? 8 : 6;
  const mw = kid ? 15 : 24;
  if (kid) { g.strokeStyle = '#c0605a'; g.lineWidth = 6; }
  g.beginPath(); g.moveTo(cx - mw, my - (kid ? 6 : 0)); g.quadraticCurveTo(cx, my + (f.smile ? 16 : 4) - (kid ? 6 : 0), cx + mw, my - (kid ? 6 : 0)); g.stroke();
  // Anteojos
  if (f.glasses) {
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 4.5;
    [-1, 1].forEach((s) => { g.beginPath(); g.roundRect(cx + s * eyeDX - 26, eyeY - 19, 52, 38, 10); g.stroke(); });
    g.beginPath(); g.moveTo(cx - 10, eyeY - 4); g.lineTo(cx + 10, eyeY - 4); g.stroke();
    g.fillStyle = 'rgba(200,230,255,.12)';
    [-1, 1].forEach((s) => { g.beginPath(); g.roundRect(cx + s * eyeDX - 24, eyeY - 17, 48, 34, 9); g.fill(); });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  faceCache.set(key, t);
  return t;
}

let blobTex = null;
function blob() {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    rg.addColorStop(0, 'rgba(0,0,0,.42)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  return blobTex;
}

const cast = (m) => { m.castShadow = true; return m; };

// ------------------------------------------------------------------
// Cuerpo
// ------------------------------------------------------------------
export function buildPerson(f) {
  const g = new THREE.Group();
  const h = hashOf(f);
  const female = f.sex ? f.sex === 'F' : ['long', 'bun'].includes(f.hairStyle);
  const skinC = SKIN[f.skin] ?? f.skin;
  const skin = mat(skinC, 0.65);
  const shirt = mat(f.shirt || '#555', 0.85);
  const pants = mat(f.pants || '#2a2f38', 0.9);
  const hair = mat(f.hairColor || '#2a1d14', 0.75);
  const shoeCol = (f.age || 30) < 35 && h % 2 ? '#f2f2f0' : ['#2a2420', '#3b2a1f', '#1c1c1c'][h % 3];
  const shoe = mat(shoeCol, 0.6);
  const skirt = female && h % 3 === 0;

  // Sombra de contacto
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.006; g.add(sh);

  // Piernas (pivote en la cadera)
  const legs = [-0.095, 0.095].map((x) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.88, 0);
    const thigh = cast(new THREE.Mesh(new THREE.CapsuleGeometry(female ? 0.07 : 0.078, 0.3, 4, 10), skirt ? mat(shade(skinC, 0.95), 0.6) : pants));
    thigh.position.y = -0.21; leg.add(thigh);
    const shin = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 10), skirt ? mat(shade(skinC, 0.95), 0.6) : pants));
    shin.position.y = -0.6; leg.add(shin);
    const s = cast(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.25), shoe));
    s.position.set(0, -0.84, -0.045); leg.add(s);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), shoe);
    toe.scale.set(1, 0.68, 1); toe.position.set(0, -0.845, -0.16); leg.add(toe);
    g.add(leg);
    return leg;
  });
  // Cadera / pollera
  const hip = cast(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skirt ? shirt : pants));
  hip.scale.set(1, 0.6, 0.7); hip.position.y = 0.9; g.add(hip);
  if (skirt) {
    const sk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.27, 0.42, 20, 1, true), mat(shade(f.shirt || '#555', 0.75), 0.85, { side: THREE.DoubleSide })));
    sk.position.y = 0.7; sk.scale.z = 0.8; g.add(sk);
  }
  // Torso con forma (torno)
  const prof = female
    ? [[0.17, 0], [0.155, 0.12], [0.17, 0.26], [0.19, 0.36], [0.2, 0.44], [0.16, 0.52], [0.07, 0.57]]
    : [[0.18, 0], [0.19, 0.14], [0.21, 0.3], [0.235, 0.44], [0.19, 0.53], [0.07, 0.58]];
  const torso = cast(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 22), shirt));
  torso.position.y = 0.88; torso.scale.z = 0.66; g.add(torso);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), shirt); cap.rotation.x = -Math.PI / 2; cap.position.y = 1.455; g.add(cap);
  // Cuello de la camisa
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.02, 8, 18), mat(shade(f.shirt || '#555', 1.25), 0.8));
  collar.rotation.x = Math.PI / 2; collar.position.y = 1.46; g.add(collar);
  if (f.pregnant) {
    const belly = cast(new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), shirt));
    belly.position.set(0, 1.02, -0.1); belly.scale.set(1, 1, 0.85); g.add(belly);
  }
  // Brazos (pivote en el hombro)
  const arms = [-1, 1].map((sx) => {
    const arm = new THREE.Group();
    arm.position.set(sx * (female ? 0.215 : 0.245), 1.4, 0);
    const up = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.22, 4, 10), shirt)); up.position.y = -0.16; arm.add(up);
    const fore = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.22, 4, 10), (h >> 3) % 3 === 0 ? skin : shirt)); fore.position.y = -0.42; arm.add(fore);
    const hand = cast(new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), skin)); hand.scale.set(0.85, 1.15, 0.7); hand.position.y = -0.6; arm.add(hand);
    arm.rotation.z = sx * 0.06;
    g.add(arm);
    return arm;
  });
  // Cuello y cabeza
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.12, 12), skin); neck.position.y = 1.5; g.add(neck);
  const headG = new THREE.Group(); headG.position.y = 1.65; g.add(headG);
  // Proporciones de chico: cabeza más grande respecto del cuerpo
  const age = f.age ?? 30;
  if (age < 12) { headG.scale.setScalar(age < 3 ? 1.34 : age < 7 ? 1.24 : 1.14); headG.position.y = 1.67; }
  const shapeS = { round: [1, 1.02, 1], oval: [0.93, 1.1, 1], long: [0.88, 1.17, 0.97] }[f.shape] || [0.93, 1.1, 1];
  const R = 0.122;
  const head = cast(new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), skin)); head.scale.set(...shapeS); headG.add(head);
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.004, 28, 18, Math.PI * 1.5 - Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.2, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ map: faceTexture({ ...f, sex: female ? 'F' : 'M' }), transparent: true, roughness: 0.7, depthWrite: false }),
  );
  face.scale.set(...shapeS); headG.add(face);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), skin); nose.scale.set(0.8, 1.1, 1); nose.position.set(0, -0.012 * shapeS[1], -R * shapeS[2] * 0.98); headG.add(nose);
  [-1, 1].forEach((s) => { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * R * shapeS[0] * 0.98, -0.005, 0.01); headG.add(ear); });

  // Pelo
  const hr = R * 1.07;
  const hairPart = (geo) => { const m = cast(new THREE.Mesh(geo, hair)); m.scale.set(...shapeS); headG.add(m); return m; };
  if (f.hairStyle === 'baby') {
    // Bebé: apenas un mechoncito arriba
    const tuft = hairPart(new THREE.SphereGeometry(hr * 0.99, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.2));
    tuft.rotation.x = 0.35;
    const curl = cast(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.007, 6, 12, Math.PI * 1.5), hair));
    curl.position.set(0, hr * shapeS[1] * 0.97, -0.035); curl.rotation.set(0, Math.PI / 2, 0); headG.add(curl);
  } else if (f.hairStyle !== 'bald') {
    // Casquete (la línea del pelo queda alta adelante)
    const capH = hairPart(new THREE.SphereGeometry(hr, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.36));
    capH.rotation.x = 0.2;
    // Parte de atrás y costados (sienes cubiertas hasta las orejas; con pelo largo, un poco más adelante)
    const wide = female || f.hairStyle === 'long' || f.hairStyle === 'bun';
    const span = wide ? 1.2 : 1.04;
    hairPart(new THREE.SphereGeometry(hr * 0.99, 26, 14, Math.PI * 0.5 - Math.PI * span / 2, Math.PI * span, 0, Math.PI * (f.hairStyle === 'short' && !female ? 0.6 : 0.68)));
    if (f.hairStyle === 'long') {
      const back = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.2, 6, 14), hair));
      back.scale.set(1.05, 1, 0.42); back.position.set(0, -0.15, 0.075); headG.add(back);
      // Mechones a los costados de la cara (pegados a la cabeza, por detrás de las sienes)
      [-1, 1].forEach((s) => {
        const lock = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.17, 4, 10), hair));
        lock.scale.set(0.8, 1, 1.25); lock.position.set(s * 0.112, -0.09, 0.012); headG.add(lock);
      });
    }
    if (f.hairStyle === 'bun') {
      const bun = cast(new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), hair)); bun.position.set(0, 0.075, 0.105); headG.add(bun);
    }
    if (f.hairStyle === 'curly') {
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 * 3, el = 0.12 + (i % 4) * 0.22;
        const b = cast(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hair));
        if (Math.sin(a) < -0.55 && el < 0.4) continue;
        b.position.set(Math.cos(a) * hr * Math.cos(el) * shapeS[0], hr * Math.sin(el) * shapeS[1] + 0.012, Math.sin(a) * hr * Math.cos(el) * shapeS[2] + 0.01);
        headG.add(b);
      }
    }
  } else {
    // Calvo: cerquillo de pelo a los costados y atrás
    const fringe = cast(new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.022, 6, 24, Math.PI * 1.25), hair));
    // El arco de 225° deja el hueco de 135° adelante (la cara); antes quedaba girado y cruzaba los ojos
    fringe.rotation.set(Math.PI / 2, 0, -Math.PI * 0.125); fringe.position.y = -0.005; fringe.scale.set(shapeS[0], 1, 1); headG.add(fringe);
  }
  if (f.beard) {
    const b = hairPart(new THREE.SphereGeometry(R * 1.03, 22, 12, Math.PI * 1.5 - Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.62, Math.PI * 0.3));
    b.material = mat(shade(f.hairColor, 0.95), 0.9);
  }
  return { g, legs, arms };
}
