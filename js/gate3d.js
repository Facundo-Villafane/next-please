// Puerta de embarque en 3D: podio con lector BGR, acceso a la manga, sala de espera y carteles.
import * as THREE from 'three';
import { AirportScene, canvasTex } from './scene3d.js';
import { buildAirside } from './outside3d.js';
import { AIRLINE } from './data.js';
import { fmtTime } from './util.js';

const DOOR = [4.6, 2.6];

export class GateScene extends AirportScene {
  layout() {
    super.layout();
    this.exitPaths = {
      accept: [[1.6, 1.6], [3.4, 2.4], [DOOR[0] + 0.4, DOOR[1]], [DOOR[0] + 4, DOOR[1]]],
      other: [[-1.8, 1.8], [-6, 3], [-13, 3]],
    };
    this.hideBagOnAccept = false;
    // La gente del fondo camina entre la pared derecha y la pared de la manga
    this.ambientBounds = [-25, 14.5];
    this.ambientWrap = true;
  }

  buildEnvironment() {
    const s = this.scene;
    this.scene.background = new THREE.Color('#2a2f45');
    this.scene.fog = new THREE.Fog('#8a6a62', 70, 320);
    this.camera.far = 420; this.camera.updateProjectionMatrix();
    s.add(new THREE.HemisphereLight('#e6eeff', '#5a5040', 1.0));
    const key = new THREE.DirectionalLight('#fff1dc', 1.3);
    key.position.set(-5, 9, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -6, far: 40 });
    s.add(key);

    // Alfombra de sala de embarque
    const carpet = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#2c3a52'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.strokeStyle = 'rgba(255,211,77,.12)'; g.lineWidth = 3; g.strokeRect(20, 20, w - 40, h - 40);
    }).tex;
    carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(14, 10);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 48), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);

    // Ventanal: lado aire (plataforma, nuestro avión, pista con aviones aterrizando)
    buildAirside(s, this.animators);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(32, 7.5), new THREE.MeshStandardMaterial({ color: '#cfe3f5', transparent: true, opacity: 0.1, roughness: 0.05 }));
    glass.position.set(0, 3.75, 13); glass.rotation.y = Math.PI; s.add(glass);
    const mullMat = new THREE.MeshStandardMaterial({ color: '#2f363f', metalness: 0.7, roughness: 0.35 });
    for (let x = -14.6; x <= 4.8; x += 2.4) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 7.5, 0.16), mullMat); m.position.set(x, 3.75, 13); s.add(m); }
    [0.12, 2.8, 5.6, 7.4].forEach((y) => { const t = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 0.18), mullMat); t.position.set(-5, y, 13); s.add(t); });
    // Pared lateral derecha y columna de esquina (cierra la sala)
    this.buildSideWall(-15, 1, '← Puertas B1 – B6 · Salida');
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.5, 0.6), new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.4, metalness: 0.3 }));
    corner.position.set(-15, 3.75, 13); s.add(corner);
    const sideAd = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.2), new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#123a63'); gr.addColorStop(1, '#1f6fb0'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd34d'; c.font = 'bold 54px system-ui'; c.textAlign = 'center'; c.fillText('✈ Aeroplata', w / 2, 110); c.fillStyle = '#fff'; c.font = '30px system-ui'; c.fillText('Gracias por volar con nosotros', w / 2, 170); }).tex, roughness: 0.5 }));
    sideAd.position.set(-14.95, 3.2, 7); sideAd.rotation.y = Math.PI / 2; s.add(sideAd);

    const wallMat = new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), wallMat); back.position.set(0, 3.75, -3); s.add(back);
    this.buildSideWall(DOOR[0] + 0.3, -1, 'Puertas B8 – B12 →');
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshStandardMaterial({ color: '#eceae4' }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 7.5, 5); s.add(ceil);
    const lm = new THREE.MeshBasicMaterial({ color: '#fffdf2' });
    for (let x = -10; x <= 4; x += 4) for (let z = -1; z <= 11; z += 4) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.3), lm); l.rotation.x = Math.PI / 2; l.position.set(x, 7.45, z); s.add(l);
    }

    // Acceso a la manga (puerta en la pared izquierda)
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 1.8), new THREE.MeshStandardMaterial({ color: '#7d8794', metalness: 0.6, roughness: 0.3 }));
    doorFrame.position.set(DOOR[0] + 0.25, 1.3, DOOR[1]); s.add(doorFrame);
    const doorDark = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.3), new THREE.MeshBasicMaterial({ color: '#0d1018' }));
    doorDark.position.set(DOOR[0] + 0.14, 1.15, DOOR[1]); doorDark.rotation.y = -Math.PI / 2; s.add(doorDark);

    // Cartel de puerta (sobre el acceso) y cartel de zona (sobre la fila)
    const gs = canvasTex(1024, 300, () => {});
    this.gateCanvas = gs.canvas; this.gateTex = gs.tex;
    const gsm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.0), new THREE.MeshBasicMaterial({ map: gs.tex }));
    gsm.position.set(2.9, 3.0, 7.6); gsm.rotation.y = Math.PI; s.add(gsm);
    const zs = canvasTex(1024, 192, () => {});
    this.zoneCanvas = zs.canvas; this.zoneTex = zs.tex;
    const zsm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.64), new THREE.MeshBasicMaterial({ map: zs.tex }));
    zsm.position.set(-1.2, 2.9, 7.2); zsm.rotation.y = Math.PI; s.add(zsm);
    [-2.7, 0.3].forEach((x) => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 4.4), new THREE.MeshBasicMaterial({ color: '#555' }));
      rod.position.set(x, 5.4, 7.2); s.add(rod);
    });

    // Podio con lector de tarjetas (BGR)
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 0.6), new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.5 }));
    pod.position.set(0, 0.525, 0); pod.castShadow = true; s.add(pod);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.72), new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.3 }));
    top.position.set(0, 1.07, -0.03); s.add(top);
    const logo = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#123a63'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd34d'; g.fillRect(0, h - 22, w, 22);
      g.fillStyle = '#fff'; g.font = 'bold 64px system-ui'; g.textAlign = 'center'; g.fillText(`✈ ${AIRLINE.name}`, w / 2, 130);
    }).tex;
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.8), new THREE.MeshStandardMaterial({ map: logo }));
    lp.position.set(0, 0.55, 0.302); s.add(lp);
    const bgr = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: '#30353d' }));
    bgr.position.set(0.95, 1.12, 0.35); s.add(bgr);
    this.bgrLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.05), new THREE.MeshBasicMaterial({ color: '#334' }));
    this.bgrLight.position.set(0.95, 1.19, 0.3); s.add(this.bgrLight);
    const bgrStand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.06), new THREE.MeshStandardMaterial({ color: '#888' }));
    bgrStand.position.set(0.95, 0.53, 0.35); s.add(bgrStand);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.04), new THREE.MeshStandardMaterial({ color: '#111' }));
    mon.position.set(-0.62, 1.22, -0.12); mon.rotation.y = -0.7; mon.scale.setScalar(0.8); s.add(mon);

    this.buildStanchions();
    this.hideStanchions(); // se arman en la apertura (layout de zonas)
    this.buildSeats();
  }

  // Pared lateral con una abertura hacia un pasillo de la terminal (la gente llega y se va por ahí).
  // inward: hacia dónde mira la pared (1 = hacia +x, -1 = hacia -x)
  buildSideWall(x, inward, label) {
    const s = this.scene;
    const z0 = 10.4, z1 = 12.95, H = 3.2, LEN = 12;
    const wallMat = new THREE.MeshStandardMaterial({ color: '#d4d0c8', roughness: 0.85 });
    const rot = inward > 0 ? Math.PI / 2 : -Math.PI / 2;
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(z0 + 5, 7.5), wallMat); seg.position.set(x, 3.75, (z0 - 5) / 2); seg.rotation.y = rot; s.add(seg);
    const lintel = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0 + 0.1, 7.5 - H), wallMat); lintel.position.set(x, H + (7.5 - H) / 2, (z0 + z1) / 2); lintel.rotation.y = rot; s.add(lintel);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#8d96a1', metalness: 0.6, roughness: 0.3 });
    [z0, z1].forEach((z) => { const j = new THREE.Mesh(new THREE.BoxGeometry(0.25, H, 0.12), frameMat); j.position.set(x, H / 2, z); s.add(j); });
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, z1 - z0), frameMat); top.position.set(x, H, (z0 + z1) / 2); s.add(top);
    // Cartel sobre la abertura
    const sign = canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#0d1a2b'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd34d'; c.font = 'bold 44px system-ui'; c.textAlign = 'center'; c.fillText(label, w / 2, 80); }).tex;
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.62), new THREE.MeshStandardMaterial({ map: sign, emissive: '#ffffff', emissiveMap: sign, emissiveIntensity: 0.7 }));
    sg.position.set(x + inward * 0.02, H + 0.55, (z0 + z1) / 2); sg.rotation.y = rot; s.add(sg);
    // Pasillo hacia el resto de la terminal
    const out = -inward;
    const cx = x + out * LEN / 2;
    const cwall = new THREE.MeshStandardMaterial({ color: '#c9c5bd', roughness: 0.85 });
    [z0, z1].forEach((z, i) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(LEN, H), cwall); w.position.set(cx, H / 2, z); w.rotation.y = i ? Math.PI : 0; s.add(w); });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(LEN, z1 - z0), new THREE.MeshStandardMaterial({ color: '#e6e3dd' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, (z0 + z1) / 2); s.add(ceil);
    const led = new THREE.MeshStandardMaterial({ color: '#fff8ea', emissive: '#fff1d6', emissiveIntensity: 1.4 });
    for (let k = 1; k < LEN; k += 2.5) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.3), led); l.position.set(x + out * k, H - 0.03, (z0 + z1) / 2); s.add(l); }
    const ad = canvasTex(256, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1f6fb0'); gr.addColorStop(1, '#123a63'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 30px system-ui'; c.textAlign = 'center'; c.fillText('Free Shop', w / 2, 120); c.fillStyle = '#ffd34d'; c.font = '22px system-ui'; c.fillText('a 50 metros', w / 2, 160); }).tex;
    const adm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshStandardMaterial({ map: ad, emissive: '#ffffff', emissiveMap: ad, emissiveIntensity: 0.5 }));
    adm.position.set(x + out * 5, 1.7, z0 + 0.01); s.add(adm);
    // Fondo del pasillo, más oscuro (sensación de profundidad)
    const end = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, H), new THREE.MeshBasicMaterial({ color: '#6d6a66' }));
    end.position.set(x + out * LEN, H / 2, (z0 + z1) / 2); end.rotation.y = out > 0 ? -Math.PI / 2 : Math.PI / 2; s.add(end);
  }

  buildSeats() {
    const s = this.scene;
    const seatMat = new THREE.MeshStandardMaterial({ color: '#33363c', roughness: 0.6, metalness: 0.3 });
    const legMat = new THREE.MeshStandardMaterial({ color: '#9aa1aa', metalness: 0.8, roughness: 0.3 });
    for (let row = 0; row < 3; row++) {
      const z = 8.2 + row * 1.5;
      for (let x = -7; x <= 2; x += 0.62) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.5), seatMat); seat.position.set(x, 0.45, z); s.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.06), seatMat); back.position.set(x, 0.72, z + 0.25); s.add(back);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.06, 0.08), legMat); beam.position.set(-2.4, 0.3, z); s.add(beam);
    }
  }

  buildAmbientPeople() {
    // Pasajeros sentados esperando
    for (let i = 0; i < 16; i++) {
      const fig = this.makePerson({
        skin: Math.floor(Math.random() * 5), hairColor: ['#1d1714', '#4a2f1e', '#c9a35b', '#b8b5b0'][i % 4],
        hairStyle: ['short', 'long', 'bald', 'bun', 'curly'][i % 5], glasses: i % 3 === 0, beard: i % 4 === 1,
        shirt: ['#7a2e2e', '#2e6b4f', '#555', '#b07a2a', '#1f7a8c', '#6b5b95', '#333', '#8c3b6b'][i % 8], pants: '#2a2f38',
      });
      const row = i % 3, col = Math.floor(Math.random() * 15);
      fig.position.set(-7 + col * 0.62, -0.38, 8.2 + row * 1.5 - 0.05);
      fig.userData.legs.forEach((l) => { l.rotation.x = Math.PI / 2; });
      this.scene.add(fig);
    }
    // Gente circulando por el pasillo del fondo
    for (let i = 0; i < 7; i++) {
      const fig = this.makePerson({ skin: i % 5, hairColor: '#2a1d14', hairStyle: ['short', 'long'][i % 2], shirt: ['#444', '#7a1f2a', '#1f3b57', '#2d5a3d', '#b07a2a', '#6b5b95', '#1f7a8c'][i], pants: '#222', sex: i % 2 ? 'F' : 'M', hairStyle: ['short', 'long', 'bun', 'curly', 'short', 'long', 'bald'][i] }, true);
      const z = 11.8;
      fig.position.set(-24 + Math.random() * 38, 0, z);
      this.scene.add(fig);
      this.walkers.push({ fig, ambient: true, dir: i % 2 ? 1 : -1, speed: 1 + Math.random() * 0.5, z, phase: Math.random() * 6 });
    }
  }

  // Pasajeros que embarcan sin novedad (flujo de la zona)
  boardFlow(n) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const fig = this.makePerson({
          skin: Math.floor(Math.random() * 5), hairColor: ['#1d1714', '#4a2f1e', '#c9a35b', '#b8b5b0'][i % 4],
          hairStyle: ['short', 'long', 'bald', 'bun'][i % 4], glasses: Math.random() < 0.3, beard: false,
          shirt: ['#7a2e2e', '#2e6b4f', '#555', '#b07a2a', '#1f7a8c', '#6b5b95'][i % 6], pants: '#2a2f38',
        }, true);
        fig.position.set(-3 + Math.random() * 2, 0, 6.5);
        this.scene.add(fig);
        this.walkTo(fig, [[1.4, 2.4], ...this.exitPaths.accept.slice(1)], 1.4).then(() => this.scene.remove(fig));
      }, i * 700);
    }
  }

  flashBgr(ok) {
    this.bgrLight.material.color.set(ok ? '#3dff7a' : '#ff4040');
    clearTimeout(this.bgrTimer);
    this.bgrTimer = setTimeout(() => this.bgrLight.material.color.set('#334'), 1500);
  }

  updateGate(flight, now, status, zone) {
    let g = this.gateCanvas.getContext('2d');
    g.fillStyle = '#0a0f1a'; g.fillRect(0, 0, 1024, 300);
    g.fillStyle = '#ffd34d'; g.fillRect(0, 0, 200, 300);
    g.fillStyle = '#0a0f1a'; g.font = 'bold 110px system-ui'; g.textAlign = 'center'; g.fillText(flight.gate, 100, 190);
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'bold 64px system-ui';
    g.fillText(`${flight.no}  ${flight.city.toUpperCase()}`, 230, 90);
    g.font = '44px monospace'; g.fillStyle = '#9fb3cc';
    g.fillText(`STD ${flight.dep}   ·   ${fmtTime(now)}`, 230, 160);
    g.fillStyle = status === 'CERRADO' ? '#ff6a5a' : status.startsWith('EMBARQUE') || status.startsWith('ÚLTIMO') ? '#5bff8c' : '#ffc04d';
    g.font = 'bold 56px system-ui'; g.fillText(status, 230, 245);
    this.gateTex.needsUpdate = true;

    g = this.zoneCanvas.getContext('2d');
    g.fillStyle = '#123a63'; g.fillRect(0, 0, 1024, 192);
    g.fillStyle = '#ffd34d'; g.fillRect(0, 178, 1024, 14);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 76px system-ui';
    g.fillText(zone ? `EMBARCANDO · ZONA ${zone}` : 'EMBARQUE POR ZONAS', 512, 100);
    g.font = '36px system-ui'; g.fillText('Tenga a mano su tarjeta de embarque y documento', 512, 155);
    this.zoneTex.needsUpdate = true;
  }

  updateBoard() {}
}
