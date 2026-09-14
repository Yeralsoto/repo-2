// One uniform drives the whole film: uP, the smoothed scroll progress from 0 to 1.
// Every animated thing carries its own timing in an attribute (aLife = in-start, in-end,
// out-start, out-end) and the shader works out where it is. Nothing is animated on a timer,
// so the reader can stop, reverse or jump and the scene is always exactly one state.
import * as THREE from 'three';

export const U = { uP: { value: 0 } };

export const MODE = { DISSOLVE: 0, POP: 1, GROW: 2, DROP: 3, DRAW: 4, TERRAIN: 5 };
export const ALWAYS = [-1, -0.99, 2, 2.01];

const VERT_HEAD = /* glsl */ `
attribute vec4 aLife;
uniform float uP;
varying float vLife;
#if LIFE_MODE == 4
attribute float aS;
varying float vS;
varying float vDraw;
#endif
#if LIFE_MODE == 5
attribute vec4 aH;   // raw height, developed height, earthwork start, end
attribute vec3 aC2;  // cleared colour
attribute vec3 aC3;  // finished colour
attribute vec4 aTc;  // cleared start/end, finished start/end
#endif
#ifdef LIFT
attribute vec4 aLift;
#endif
#ifdef BLOCK_EDGE
varying vec2 vBUv;
#endif
float kRange(float a, float b){ return clamp((uP - a) / max(b - a, 1e-5), 0.0, 1.0); }
float easeOutBack(float t){ float c1 = 1.20158; float c3 = c1 + 1.0; return 1.0 + c3 * pow(t - 1.0, 3.0) + c1 * pow(t - 1.0, 2.0); }
float easeOutCubic(float t){ return 1.0 - pow(1.0 - t, 3.0); }
float easeInOut(float t){ return t * t * (3.0 - 2.0 * t); }
`;

const VERT_BODY = /* glsl */ `
#include <begin_vertex>
float kIn = kRange(aLife.x, aLife.y);
float kOut = kRange(aLife.z, aLife.w);
vLife = 1.0;
#if LIFE_MODE == 0
  vLife = kIn * (1.0 - kOut);
#elif LIFE_MODE == 1
  transformed *= max(easeOutBack(kIn) * (1.0 - easeInOut(kOut)), 0.0);
#elif LIFE_MODE == 2
  transformed.y *= easeOutCubic(kIn);
  vLife = 1.0 - kOut;
#elif LIFE_MODE == 3
  transformed.y += (1.0 - easeOutCubic(kIn)) * DROP;
  vLife = min(1.0, kIn * 2.5) * (1.0 - kOut);
#elif LIFE_MODE == 4
  vS = aS; vDraw = kIn; vLife = 1.0 - kOut;
#elif LIFE_MODE == 5
  float kh = easeInOut(kRange(aH.z, aH.w));
  transformed.y = mix(TBASE, mix(aH.x, aH.y, kh), transformed.y);
  vLife = kIn * (1.0 - kOut);
#endif
#ifdef LIFT
  float lift = smoothstep(aLift.x, aLift.y, uP) * (1.0 - smoothstep(aLift.z, aLift.w, uP));
  transformed.y += lift * LIFT;
#endif
#ifdef BLOCK_EDGE
  vBUv = uv;
#endif
if (kIn <= 0.0 || kOut >= 1.0) transformed = vec3(0.0);
`;

const COLOR_BODY = /* glsl */ `
#include <color_vertex>
#if LIFE_MODE == 5 && defined( USE_INSTANCING_COLOR )
  vColor.rgb = mix(mix(instanceColor.rgb, aC2, kRange(aTc.x, aTc.y)), aC3, kRange(aTc.z, aTc.w));
#endif
`;

const FRAG_HEAD = /* glsl */ `
varying float vLife;
#if LIFE_MODE == 4
varying float vS;
varying float vDraw;
#endif
#ifdef BLOCK_EDGE
varying vec2 vBUv;
#endif
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

const FRAG_CLIP = /* glsl */ `
#include <clipping_planes_fragment>
if (vLife < 0.999 && ign(gl_FragCoord.xy) >= vLife) discard;
#if LIFE_MODE == 4
if (vS > vDraw) discard;
#endif
`;

const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
#ifdef BLOCK_EDGE
  vec2 be = min(vBUv, 1.0 - vBUv);
  diffuseColor.rgb *= mix(EDGE_K, 1.0, smoothstep(0.0, EDGE_W, min(be.x, be.y)));
#endif
`;

export function life(material, mode, opts = {}) {
  const defines = { LIFE_MODE: mode, DROP: (opts.drop ?? 9).toFixed(2), TBASE: (opts.base ?? -6).toFixed(2) };
  if (opts.edge) { defines.BLOCK_EDGE = ''; defines.EDGE_W = opts.edge.toFixed(3); defines.EDGE_K = (opts.edgeK ?? 0.82).toFixed(3); }
  if (opts.lift) defines.LIFT = opts.lift.toFixed(2);
  material.defines = Object.assign(material.defines || {}, defines);
  const key = 'life:' + JSON.stringify(material.defines);
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uP = U.uP;
    sh.vertexShader = VERT_HEAD + sh.vertexShader
      .replace('#include <begin_vertex>', VERT_BODY)
      .replace('#include <color_vertex>', COLOR_BODY);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', FRAG_CLIP)
      .replace('#include <color_fragment>', FRAG_COLOR);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

// Shadows must agree with what is visible, so shadow casters get a matching depth material.
export function lifeDepth(mode, opts = {}) {
  return life(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), mode, { drop: opts.drop, base: opts.base, lift: opts.lift });
}

export function castLife(mesh, mode, opts) {
  mesh.castShadow = true;
  mesh.customDepthMaterial = lifeDepth(mode, opts);
  return mesh;
}

// aLife on a plain geometry: one timing for every vertex.
export function setLife(geo, t) {
  const n = geo.attributes.position.count, arr = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) arr.set(t, i * 4);
  geo.setAttribute('aLife', new THREE.BufferAttribute(arr, 4));
  return geo;
}
export function setLift(geo, t) {
  const n = geo.attributes.position.count, arr = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) arr.set(t, i * 4);
  geo.setAttribute('aLift', new THREE.BufferAttribute(arr, 4));
  return geo;
}
// aLife per instance.
export function instLife(geo, count, fn) {
  const arr = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) arr.set(fn(i), i * 4);
  geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
  return geo;
}

// Palette for the land. Muted, measured against the Papel haze; brand colours stay small.
export const C = {
  papel: 0xF5EFE4, haze: 0xE9E2D3, verdeHondo: 0x16352A, verde: 0x1E4638, arcilla: 0xAF5F3E, laton: 0x8F7546,
  graphite: 0x2E3A34,
  sand: 0xCDBB96, sandDark: 0xB9A47C, straw: 0xB7A77A, understory: 0x8C8F5E, scrub: 0x7B8453,
  grass: 0x8A9460, lawn: 0x86965A, lawnDeep: 0x74864E, clay: 0xB98A62, clayDark: 0xA0714D,
  aggregate: 0xA9A294, asphalt: 0x5F5B55, asphaltOld: 0x716C64, concrete: 0xD8D0C1, curb: 0xC9C0AF,
  pine: 0x485F43, pineDark: 0x3B5039, pineLight: 0x5C704B, trunk: 0x6E5642,
  water: 0x7E9894, waterDeep: 0x6A8581, swale: 0x76855A, pipeWater: 0x6F8C99, pipePower: 0x8F7546, pipeSewer: 0x9A8F80,
  wallWhite: 0xECE5D6, wallSand: 0xD2B899, wallClay: 0xC49C7E, roofBronze: 0x5E5A50, roofSlate: 0x6D706A, roofGreen: 0x55614F,
  glass: 0x3F4F4D, trim: 0xF1ECE2, framing: 0xC8A57A, slab: 0xCFC7B8, interior: 0xE8DFCF,
};
