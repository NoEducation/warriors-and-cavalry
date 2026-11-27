// The scene's mood: sky, fog and lights for a cold, overcast autumn dusk with a dim copper sun low on the horizon.

/** Sky, fog and light tuning, in sRGB hex colours, intensities and world units. Tune by editing these values. */
export const SCENE_LOOK_CONFIG = Object.freeze({
  /** Smoky, ash-brown sky behind the map. */
  background: 0x15130f,
  /** Haze that swallows the far side of the map; distances from the camera where it starts and where it is solid. */
  fogColor: 0x231f1a,
  fogNear: 90,
  fogFar: 340,
  /** Grey overcast sky light from above and a dark earth bounce from below. */
  skyLight: 0x8c8f96,
  groundLight: 0x3a2c1e,
  hemisphereIntensity: 0.85,
  ambientIntensity: 0.08,
  /** A low, dim, copper sun: long shadows on slopes, warm rims on roofs. */
  sunColor: 0xd9a066,
  sunIntensity: 1.55,
  sunDirection: Object.freeze({ x: -0.8, y: 0.5, z: -0.35 }),
});
