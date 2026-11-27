// The scene's mood: sky, fog and lights for a cold, overcast autumn dusk with a dim copper sun low on the horizon.

/** Sky, fog and light tuning, in sRGB hex colours, intensities and world units. Tune by editing these values. */
export const SCENE_LOOK_CONFIG = Object.freeze({
  /** Sky behind the map: the fog's own colour, so the endless sea melts into it at the horizon. */
  background: 0x3a352f,
  /** Haze that swallows the far side of the map; distances from the camera where it starts and where it is solid. */
  fogColor: 0x3a352f,
  fogNear: 70,
  fogFar: 280,
  /** Grey overcast sky light from above and a dark earth bounce from below. */
  skyLight: 0x9fa2a8,
  groundLight: 0x3a2c1e,
  hemisphereIntensity: 1.35,
  ambientIntensity: 0.16,
  /** A low, dim, copper sun: long shadows on slopes, warm rims on roofs. */
  sunColor: 0xd9a066,
  sunIntensity: 2.4,
  sunDirection: Object.freeze({ x: -0.8, y: 0.62, z: -0.35 }),
});
