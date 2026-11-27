// GLSL for the mountain mist: camera-facing soft banks with drifting wisps that fade out as the camera comes close.
// Used by MountainMist.

/** Turns each instance's quad to face the camera, sized by its radius, and passes on the distance to the camera. */
export const MIST_VERTEX_SHADER = /* glsl */ `
attribute vec4 bank; // xyz: centre, w: radius
attribute float phase;
varying vec2 vUv;
varying vec2 vWorldXz;
varying float vPhase;
varying float vCameraDistance;
#include <fog_pars_vertex>

void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // Flattened banks: wider than tall, so they lie along the slopes like clouds caught on the peaks.
  vec3 world = bank.xyz + bank.w * (right * position.x + up * position.y * 0.55);
  vUv = position.xy;
  vWorldXz = world.xz;
  vPhase = phase;
  vCameraDistance = distance(cameraPosition, bank.xyz);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

/** A soft round bank broken into wisps by moving value noise; transparent near its rim and near the camera. */
export const MIST_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 mistColor;
uniform float opacity;
uniform float time;
uniform float drift;
uniform float fadeNear;
uniform float fadeFar;
varying vec2 vUv;
varying vec2 vWorldXz;
varying float vPhase;
varying float vCameraDistance;
#include <fog_pars_fragment>

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float body = 1.0 - smoothstep(0.15, 1.0, r);
  vec2 p = vWorldXz * 0.18 + vec2(time * drift * 0.18 + vPhase, vPhase * 0.7);
  float wisps = 0.55 * noise(p) + 0.3 * noise(p * 2.3 + 7.0) + 0.15 * noise(p * 5.1 - 3.0);
  float alpha = opacity * body * smoothstep(0.25, 0.75, wisps);
  alpha *= smoothstep(fadeNear, fadeFar, vCameraDistance);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(mistColor, alpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
