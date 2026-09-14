// The freeze. The model goes quiet under a Papel veil drawn inside WebGL, and what remains is its
// network as graphite: driveways, roads, lots, school access, the next site. One line — the public
// road through the entrance and up the internal road — stays, darker, and leads back to the first
// place, where the SVG takes it over.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { life, MODE, C, setLife } from './shaders.js';
import { T, WORK } from './config.js';
import { PUBLIC } from './layout.js';
import { GRADE, SITE_CENTER } from './world.js';
import { ribbon, stagger, lerpT, resample } from './kit.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildNetwork(L, growth, raw) {
  const group = new THREE.Group();
  const nearSite = (p) => Math.abs(p[0]) < 300 && p[1] > -320 && p[1] < 260;
  const yAt = (p) => (nearSite(p) ? GRADE : Math.max(GRADE, raw(p[0], p[1]) - 0.5)) + 0.6;
  const mat = (color, opacity) => life(new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }), MODE.DRAW);

  // lines simplify outward from the first place
  const far = (pts) => {
    const c = pts[Math.floor(pts.length / 2)];
    return Math.min(1, Math.hypot(c[0] - SITE_CENTER[0], c[1] - SITE_CENTER[1]) / 1500);
  };
  const items = [];
  const push = (pts, w) => items.push(setLife(ribbon(pts, w, yAt), [...stagger(T.network.lines, far(pts), 0.4), ...T.network.othersOut]));
  for (const lot of L.lots) if (lot.drive) push([lot.drive.apron[0], ...lot.drive.path], 0.9);
  const pub = [];
  for (let x = -1700; x <= 1700; x += 20) pub.push([x, PUBLIC.z(x)]);
  push(pub, 2.2);
  for (const n of growth.net) push(n.pts, n.w ?? 1.4);
  // on The Work the freeze is drawn in Papel on Verde (her ask: the drawing is green too)
  const ink = WORK ? C.papel : C.graphite;
  const lines = new THREE.Mesh(mergeGeometries(items), mat(ink, 0.72));
  lines.renderOrder = 60;
  lines.frustumCulled = false;
  group.add(lines);

  // the dominant line
  const dom = [];
  for (let x = 1250; x > L.spine.at(0).p[0]; x -= 12) dom.push([x, PUBLIC.z(x)]);
  for (let s = 0; s <= L.S; s += 3) dom.push(L.spine.at(s).p);
  const domMesh = new THREE.Mesh(
    setLife(ribbon(dom, 4.2, yAt), [T.network.lines[0], lerpT(T.network.lines, 0.55), ...T.network.dominantOut]),
    mat(ink, 1));
  domMesh.renderOrder = 62;
  domMesh.frustumCulled = false;
  group.add(domMesh);
  const dominant3D = resample(dom, 10).out.map((o) => new THREE.Vector3(o.p[0], yAt(o.p), o.p[1]));

  // the veil, inside the render so the graphite can sit on top of it
  const veilMat = new THREE.ShaderMaterial({
    uniforms: { uO: { value: 0 }, uC: { value: new THREE.Color(WORK ? 0x1E4638 : C.papel) } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uO;\nuniform vec3 uC;\nvoid main(){\n  gl_FragColor = vec4(uC, uO);\n  #include <colorspace_fragment>\n}',
    transparent: true, depthTest: false, depthWrite: false,
  });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), veilMat);
  veil.renderOrder = 50;
  veil.frustumCulled = false;
  group.add(veil);

  function update(p) {
    const o = smooth(T.network.veil[0], T.network.veil[1], p);
    veilMat.uniforms.uO.value = o;
    veil.visible = o > 0.001;
  }
  return { group, dominant3D, update };
}
