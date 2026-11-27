// Where mist hangs in the world: soft banks scattered over the mountains, placed from the map seed.
// Render-only and pure: the same map always gets the same mist.
import type { GameMap } from '../sim/GameMap';
import { hash2 } from '../sim/rng';
import { TileType } from '../sim/tiles';

/** Mist tuning, in world units, sRGB hex colours and shares. Tune by editing these values. */
export const MIST_CONFIG = Object.freeze({
  /** Tiles between candidate spots; each spot is jittered within its cell. */
  spacing: 6,
  /** Share of rock spots that get a bank. */
  density: 0.75,
  /** Radius range of one bank. */
  radius: Object.freeze([5, 10]) as readonly [number, number],
  /** Height range of a bank's centre above the ground under it. */
  lift: Object.freeze([1, 3.5]) as readonly [number, number],
  /** Pale grey-brown, like the haze in the distance but lighter. */
  color: 0x8d877d,
  /** Thickness at a bank's centre. */
  opacity: 0.42,
  /** Camera distances over which a bank fades in: gone when the camera is closer than `fadeNear`, full past `fadeFar`. */
  fadeNear: 28,
  fadeFar: 75,
  /** How fast the wisps inside a bank drift, in world units per second. */
  drift: 0.35,
});

/** One soft bank of mist: its centre in world coordinates, its radius, and a seed for its wisps. */
export interface MistBank {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  readonly phase: number;
}

const SALT = Object.freeze({ keep: 0x3e71, jx: 0x1a2b, jz: 0x6c5d, radius: 0x4f09, lift: 0x2d77, phase: 0x7b13 });

/** The mist banks of `map`, over its rock tiles, in row order. Pure; call once per map. */
export function mistBanks(map: GameMap): MistBank[] {
  const c = MIST_CONFIG;
  const banks: MistBank[] = [];
  for (let gy = 0; gy * c.spacing < map.height; gy++) {
    for (let gx = 0; gx * c.spacing < map.width; gx++) {
      const h = (salt: number): number => hash2(map.seed ^ salt, gx, gy);
      const tx = Math.min(map.width - 1, Math.floor((gx + h(SALT.jx)) * c.spacing));
      const ty = Math.min(map.height - 1, Math.floor((gy + h(SALT.jz)) * c.spacing));
      if (map.tileAt(tx, ty) !== TileType.Rock || h(SALT.keep) >= c.density) continue;
      banks.push({
        x: tx + 0.5,
        y: map.tileHeight(tx, ty) + lerp(c.lift, h(SALT.lift)),
        z: ty + 0.5,
        radius: lerp(c.radius, h(SALT.radius)),
        phase: h(SALT.phase) * 100,
      });
    }
  }
  return banks;
}

function lerp(range: readonly [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * t;
}
