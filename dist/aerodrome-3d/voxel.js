// Blocks. Every voxel of the aerodrome is one instance of a unit box with its own timing (aLife: in-start,
// in-end, out-start, out-end on the scroll value uP). The shader lifts each block into place from below
// its footprint, and at the end lowers it back — no per-block JavaScript, no per-frame state. A soft
// darkening at each face's edges keeps individual blocks legible without outlines; uSimp greys the world
// as it simplifies back to lines.
import * as THREE from 'three';

export const U = { uP: { value: 0 }, uSimp: { value: 0 } };

const VERT_HEAD = /* glsl */ `
attribute vec4 aLife;
uniform float uP;
varying float vLife;
varying vec2 vBUv;
float kR(float a, float b){ return clamp((uP - a) / max(b - a, 1e-5), 0.0, 1.0); }
`;
const VERT_BODY = /* glsl */ `
#include <begin_vertex>
float kIn = kR(aLife.x, aLife.y);
float kOut = kR(aLife.z, aLife.w);
transformed.y -= pow(1.0 - kIn, 3.0) * RISE;
transformed.y -= kOut * kOut * SINK;
vLife = min(1.0, kIn * 3.0) * (1.0 - smoothstep(0.55, 1.0, kOut));
vBUv = uv;
if (kIn <= 0.0 || kOut >= 1.0) transformed = vec3(0.0);
`;
const FRAG_HEAD = /* glsl */ `
varying float vLife;
varying vec2 vBUv;
uniform float uSimp;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;
const FRAG_CLIP = /* glsl */ `
#include <clipping_planes_fragment>
if (vLife < 0.999 && ign(gl_FragCoord.xy) >= vLife) discard;
`;
const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
vec2 be = min(vBUv, 1.0 - vBUv);
diffuseColor.rgb *= mix(EDGE_K, 1.0, smoothstep(0.0, EDGE_W, min(be.x, be.y)));
float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(0.9, 0.97, 0.93), uSimp);
`;

function patch(material, opts, withColour) {
  material.defines = Object.assign(material.defines || {}, {
    RISE: (opts.rise ?? 6).toFixed(2), SINK: (opts.sink ?? 6).toFixed(2),
    EDGE_W: (opts.edgeW ?? 0.07).toFixed(3), EDGE_K: (opts.edgeK ?? 0.84).toFixed(3),
  });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uP = U.uP;
    sh.uniforms.uSimp = U.uSimp;
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <clipping_planes_fragment>', FRAG_CLIP);
    if (withColour) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', FRAG_COLOR);
  };
  const key = 'blocks:' + JSON.stringify(material.defines) + withColour;
  material.customProgramCacheKey = () => key;
  return material;
}
export function blockMaterial(opts = {}) {
  return patch(new THREE.MeshStandardMaterial({ roughness: opts.roughness ?? 0.94, metalness: 0 }), opts, true);
}
export function blockDepth(opts = {}) {
  return patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), opts, false);
}

// items: { x, y (base), z, w, h, d, ry?, color, life: [4] }
export function blockMesh(items, material, depth) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  const n = items.length, life = new Float32Array(n * 4);
  const mesh = new THREE.InstancedMesh(g, material, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, it.ry || 0);
    mesh.setMatrixAt(i, m4.compose(p.set(it.x, it.y, it.z), q, s.set(it.w, it.h, it.d)));
    mesh.setColorAt(i, col.set(it.color));
    life.set(it.life, i * 4);
  });
  g.setAttribute('aLife', new THREE.InstancedBufferAttribute(life, 4));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  if (depth) { mesh.castShadow = true; mesh.customDepthMaterial = depth; }
  mesh.frustumCulled = false;
  return mesh;
}
