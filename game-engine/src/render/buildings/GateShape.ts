// The Gate: a wall piece with an arched opening through it, turned to run across the wall it stands in. Piers on dark
// plinth courses, voussoir stones round the arch, a raised portcullis showing under it and timber door leaves folded
// back against the piers, leaving the passage open.
import type * as THREE from 'three';
import type { BuildingShape } from './BuildingShape';
import { castleFoundation, cornerMerlons, WALL_SIZES } from './castleParts';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, FOUNDATION_LIFT, SHAPE_COLORS } from './shapeParts';

/** Which way walkers pass through a gate: along z (north–south) or along x (east–west). */
export type GatePassage = 'northSouth' | 'eastWest';

/** Thickness of the earth floor through the opening; its top stays 0.04 above the foundation's, against z-fighting. */
const FLOOR_THICKNESS = 0.04;
/** Gate details, in world units: plinth top, how deep the stone over the arch is set back, voussoir and leaf sizes. */
const GATE_DETAIL = { plinthTop: 0.3, recess: 0.03, voussoir: 0.16, keystone: 0.07, leaf: 0.04 } as const;

/** `spec` mirrored across the tile's diagonal (x and z swapped), turning an east–west part north–south. */
function turned(spec: BoxSpec): BoxSpec {
  return { x0: spec.z0, z0: spec.x0, x1: spec.z1, z1: spec.x1, y0: spec.y0, y1: spec.y1 };
}

export class GateShape implements BuildingShape {
  /**
   * Creates a new Gate model (see `BuildingShape.build`) whose opening runs along `passage`; it fills the tile with no
   * margin, like a Wall.
   */
  public build(passage: GatePassage = 'eastWest'): THREE.Mesh {
    const place = passage === 'eastWest' ? (spec: BoxSpec): BoxSpec => spec : turned;
    const shape = new ShapeBuilder().addBox(castleFoundation(0, 0, 1, 1), SHAPE_COLORS.foundation);
    const paint = (specs: readonly BoxSpec[], color: number): void => {
      for (const spec of specs) shape.addBox(place(spec), color);
    };
    const parts = this.parts();
    paint(parts.plinth, SHAPE_COLORS.darkStone);
    paint(parts.stone, SHAPE_COLORS.stone);
    paint(parts.dark, SHAPE_COLORS.darkStone);
    paint(parts.timber, SHAPE_COLORS.door);
    paint(parts.iron, SHAPE_COLORS.windowDark);
    paint(parts.floor, SHAPE_COLORS.bareEarth);
    return shape.build();
  }

  /** The parts of an east–west gate, by colour: the opening runs along x, between piers at the low and high z edges. */
  private parts(): Record<'plinth' | 'stone' | 'dark' | 'timber' | 'iron' | 'floor', BoxSpec[]> {
    const { walkHeight, merlonSize, merlonHeight, openingWidth, openingHeight: top, archStep } = WALL_SIZES;
    const { plinthTop, recess, voussoir, keystone, leaf } = GATE_DETAIL;
    const side = (1 - openingWidth) / 2;
    const lift = FOUNDATION_LIFT;
    const piers = [
      [0, side],
      [1 - side, 1],
    ] as const;
    const voussoirs = [
      [side, side + voussoir],
      [0.5 - keystone, 0.5 + keystone],
      [1 - side - voussoir, 1 - side],
    ] as const;
    return {
      plinth: piers.map(([z0, z1]) => ({ x0: 0, x1: 1, z0, z1, y0: lift, y1: plinthTop })),
      stone: [
        ...piers.map(([z0, z1]) => ({ x0: 0, x1: 1, z0, z1, y0: plinthTop, y1: walkHeight })),
        { x0: recess, x1: 1 - recess, z0: side, z1: 1 - side, y0: top, y1: walkHeight },
        ...cornerMerlons(0, 0, 1, 1, merlonSize, walkHeight, walkHeight + merlonHeight),
      ],
      dark: [
        { x0: 0, x1: 1, z0: side, z1: side + archStep, y0: top - archStep, y1: top },
        { x0: 0, x1: 1, z0: 1 - side - archStep, z1: 1 - side, y0: top - archStep, y1: top },
        ...[0, 1 - recess].flatMap((x0) => voussoirs.map(([z0, z1]) => ({ x0, x1: x0 + recess, z0, z1, y0: top, y1: top + voussoir }))),
      ],
      // Door leaves folded back flat against the inside of each pier.
      timber: [
        { x0: 0.1, x1: 0.45, z0: side, z1: side + leaf, y0: lift, y1: top - archStep - 0.04 },
        { x0: 0.55, x1: 0.9, z0: 1 - side - leaf, z1: 1 - side, y0: lift, y1: top - archStep - 0.04 },
      ],
      // The raised portcullis: its bottom rail and spike tips show just under the arch.
      iron: [
        { x0: 0.47, x1: 0.53, z0: side, z1: 1 - side, y0: top - 0.08, y1: top },
        ...[0.3, 0.5, 0.7].map((z) => ({ x0: 0.48, x1: 0.52, z0: z - 0.02, z1: z + 0.02, y0: top - 0.13, y1: top - 0.08 })),
      ],
      floor: [{ x0: 0, z0: side, x1: 1, z1: 1 - side, y0: lift, y1: lift + FLOOR_THICKNESS }],
    };
  }
}
