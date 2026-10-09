// Datos del jugador (nombre y género) y trato personalizado en los textos dirigidos a él/ella.
export function getPlayer() {
  try { return { name: localStorage.getItem('ckName') || '', gender: localStorage.getItem('ckGender') || '' }; } catch { return { name: '', gender: '' }; }
}
export function setPlayer(name, gender) {
  try { localStorage.setItem('ckName', name); if (gender) localStorage.setItem('ckGender', gender); } catch {}
}

// Convierte las formas "o/a" de los textos dirigidos al jugador: "Bienvenido/a" → "Bienvenida" o "Bienvenido".
// Sin género elegido se deja la forma doble.
export function gtxt(s, gender = getPlayer().gender) {
  if (!s || !gender) return s;
  const f = gender === 'F';
  const W = 'A-Za-zÁÉÍÓÚáéíóúñÑ';
  return s
    .replace(new RegExp(`([${W}]+)o/a\\b`, 'g'), (m, st) => st + (f ? 'a' : 'o'))
    .replace(new RegExp(`([${W}]+)a/o\\b`, 'g'), (m, st) => st + (f ? 'a' : 'o'))
    .replace(/\bel\/la\b/g, f ? 'la' : 'el')
    .replace(/\bun\/a\b/g, f ? 'una' : 'un');
}

// Aspecto del agente (uniforme de Aeroplata)
export function playerFace(gender = getPlayer().gender) {
  return gender === 'M'
    ? { sex: 'M', age: 27, skin: 1, hairColor: '#2b1d14', hairStyle: 'short', glasses: false, beard: false, shape: 'oval', nose: 0, brows: 'thick', eye: 1, smile: true, shirt: '#123a63', pants: '#1c1f26' }
    : { sex: 'F', age: 27, skin: 1, hairColor: '#3a2416', hairStyle: 'bun', glasses: false, beard: false, shape: 'oval', nose: 0, brows: 'thin', eye: 2, smile: true, shirt: '#123a63', pants: '#1c1f26' };
}
