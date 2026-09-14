// A neutral A321-inspired airliner, built only from blocks (1.5 m each): an exceptionally tidy block build,
// not a realistic model. Proportions from the thesis's design aircraft — about 44.5 m long (Annex F, p.67)
// and 35.8 m across the wings (Fig. 5, p.20). No livery. Nose toward +x, wheels on y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WHITE = 0xECE7DC, GREY = 0xBDB8AE, DARK = 0x57524B, GLASS = 0x3E4744;

export function aircraftGeometry(b = 1.5) {
  const parts = [], col = new THREE.Color();
  // one block at grid (i along, j up, k across), centred on k so the build is symmetrical
  const block = (i, j, k, color, scale = 0.97) => {
    const g = new THREE.BoxGeometry(b * scale, b * scale, b * scale);
    g.translate(i * b, (j + 0.5) * b, k * b);
    col.set(color);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) c.set([col.r, col.g, col.b], v * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(g);
  };
  // fuselage, 3 × 3 blocks through most of its length
  for (let i = -13; i <= 12; i++) for (let j = 1; j <= 3; j++) for (let k = -1; k <= 1; k++) block(i, j, k, WHITE);
  // the nose steps down to a point; the cockpit glass sits in it
  for (let j = 1; j <= 3; j++) for (let k = -1; k <= 1; k++) block(13, j, k, j === 3 && k !== 0 ? GLASS : WHITE);
  for (let j = 1; j <= 2; j++) block(14, j, 0, WHITE);
  block(14, 2, -1, GLASS); block(14, 2, 1, GLASS); block(14, 1, -1, WHITE); block(14, 1, 1, WHITE);
  block(15, 1, 0, WHITE);
  // the tail cone lifts toward the fin
  for (let k = -1; k <= 1; k++) { block(-14, 2, k, WHITE); block(-14, 3, k, WHITE); }
  block(-15, 3, 0, WHITE);
  // swept, low wings with a raised tip
  for (let s = -1; s <= 1; s += 2) {
    for (let kk = 2; kk <= 12; kk++) {
      const t = (kk - 2) / 10, lead = Math.round(3 - 6 * t), trail = Math.round(-3 - 4 * t);
      for (let i = trail; i <= lead; i++) block(i, 1, s * kk, GREY);
    }
    block(-7, 2, s * 12, GREY);
    for (let i = -1; i <= 2; i++) block(i, 0, s * 5, DARK);                 // engine under each wing
    block(3, 0, s * 5, GREY);                                                 // its intake lip
    for (let kk = 1; kk <= 4; kk++) {                                         // horizontal tail
      const t = (kk - 1) / 3, lead = Math.round(-11 - 1.5 * t), trail = Math.round(-13 - 1 * t);
      for (let i = trail; i <= lead; i++) block(i, 3, s * (kk + 1), GREY);
    }
  }
  // the fin, swept back
  for (let j = 4; j <= 9; j++) {
    const t = (j - 4) / 5, lead = Math.round(-10 - 3 * t), trail = Math.round(-14 - 1 * t);
    for (let i = trail; i <= lead; i++) block(i, j, 0, WHITE);
  }
  // landing gear: a nose leg and two main legs
  block(10, 0, 0, DARK, 0.6);
  block(-1, 0, -2, DARK, 0.6); block(-1, 0, 2, DARK, 0.6);
  return mergeGeometries(parts);
}
