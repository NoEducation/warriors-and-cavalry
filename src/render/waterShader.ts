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
varying vec3 vWorld;
varying vec2 vDepthUv;
#include <fog_pars_fragment>

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 p = vWorld.xz;
  // Past the map edges lies open, deep sea (the map's own border is already forced deep, so there is no seam).
  bool onMap = p.x >= 0.0 && p.y >= 0.0 && p.x <= mapSize.x && p.y <= mapSize.y;
  float depth = onMap ? mix(landDepth, maxDepth, texture2D(depthMap, vDepthUv).r) : maxDepth;

  vec3 color = mix(shallowColor, midColor, smoothstep(0.0, 1.6, depth));
  color = mix(color, deepColor, smoothstep(1.6, 5.0, depth));

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

  float alpha = onMap ? mix(0.6, 0.97, smoothstep(0.0, 2.5, depth)) : 1.0;
  gl_FragColor = vec4(color, max(alpha, foam * 0.95));
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;
