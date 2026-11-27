// GLSL for the sea surface: colour by depth, shore foam, ripples, sparkle and the scene's fog. Used by WaterLayer.

/** Passes the world position and the depth-texture coordinate to the fragment shader. */
export const WATER_VERTEX_SHADER = /* glsl */ `
uniform vec2 mapSize;
varying vec3 vWorld;
varying vec2 vDepthUv;
#include <fog_pars_vertex>

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  // Corner (cx, cy) is texel (cx, cy) of a (width + 1) x (height + 1) texture: sample texel centres.
  vDepthUv = (world.xz + 0.5) / (mapSize + 1.0);
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

/** Colours the sea from the depth texture; time drives the ripples, the foam pulse and the sparkle. */
export const WATER_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D depthMap;
uniform vec2 mapSize;
uniform float time;
uniform float landDepth;
uniform float maxDepth;
uniform vec3 shallowColor;
uniform vec3 midColor;
uniform vec3 deepColor;
uniform vec3 foamColor;
uniform vec3 openSeaColor;
uniform vec2 openSeaBlend;
uniform float openSeaWobble;
varying vec3 vWorld;
varying vec2 vDepthUv;
#include <fog_pars_fragment>

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

/** Signed distance from p to the map's rectangle: negative inside (to the nearest edge), positive outside. */
float mapEdgeDistance(vec2 p) {
  vec2 outside = max(vec2(0.0), max(-p, p - mapSize));
  float inside = min(min(p.x, p.y), min(mapSize.x - p.x, mapSize.y - p.y));
  return length(outside) > 0.0 ? length(outside) : -inside;
}

void main() {
  vec2 p = vWorld.xz;
  // Past the map edges lies open, deep sea (the map's own border is already forced deep, so there is no seam).
  bool onMap = p.x >= 0.0 && p.y >= 0.0 && p.x <= mapSize.x && p.y <= mapSize.y;
  float depth = onMap ? mix(landDepth, maxDepth, texture2D(depthMap, vDepthUv).r) : maxDepth;
  // How far into the open ocean this point is: 0 near the island, 1 well past the map edge. Noise bends the band so
  // the rectangle of the map never shows as a line.
  float wobble = (noise(p / 90.0) + 0.5 * noise(p / 31.0 + 13.0) - 0.75) * 2.0 * openSeaWobble;
  float openSea = smoothstep(openSeaBlend.x, openSeaBlend.y, mapEdgeDistance(p) + wobble);

  vec3 color = mix(shallowColor, midColor, smoothstep(0.0, 1.6, depth));
  color = mix(color, deepColor, smoothstep(1.6, 5.0, depth));
  color = mix(color, openSeaColor, openSea * smoothstep(3.0, 5.5, depth));

  // Two crossing swells and a slow diagonal one: soft light and dark bands on open water.
  float ripple = sin(p.x * 0.9 + time * 0.8) * sin(p.y * 0.7 - time * 0.6) + 0.6 * sin((p.x + p.y) * 0.31 + time * 0.45);
  color *= 1.0 + 0.07 * ripple;

  // Sparkle: a few cells per second catch the dim sun, more out at sea.
  float glint = step(0.9985, hash(floor(p * 5.0) + floor(time * 1.7)));
  color += vec3(0.18) * glint * smoothstep(0.8, 2.5, depth);

  // Foam: a solid line where water meets the beach, and bands that roll towards it.
  float nearShore = 1.0 - smoothstep(0.0, 0.22, depth);
  float rollers = smoothstep(0.75, 0.95, 0.5 + 0.5 * sin(depth * 45.0 - time * 2.2));
  float foam = max(1.0 - smoothstep(0.0, 0.035, depth), rollers * nearShore * 0.7);
  color = mix(color, foamColor, foam);

  float alpha = mix(mix(0.6, 0.97, smoothstep(0.0, 2.5, depth)), 1.0, max(openSea, onMap ? 0.0 : 1.0));
  gl_FragColor = vec4(color, max(alpha, foam * 0.95));
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
