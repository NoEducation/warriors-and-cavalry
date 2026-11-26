// Small parts set on a building's walls: doors, windows, arrow slits, timber framing, plinths and chimneys.
import type { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, SHAPE_COLORS } from './shapeParts';

/** Which side of a wall box a detail sits on: south is +z (the front, facing the default camera), east is +x. */
export type WallFace = 'south' | 'north' | 'east' | 'west';

/** Where a detail sits: on `face` of `wall`, centred at `along` (world x on south/north, world z on east/west). */
export interface FaceSpot {
  readonly wall: BoxSpec;
  readonly face: WallFace;
  readonly along: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** How far door frames stand proud of the wall face, and the width of a jamb. */
const DETAIL_DEPTH = 0.05;
const JAMB = 0.06;

/** A box on `at`'s face spanning `a0..a1` along it and `y0..y1`, standing `depth` proud of the face. */
function faceBox(at: FaceSpot, a0: number, a1: number, y0: number, y1: number, depth: number): BoxSpec {
  const { wall } = at;
  switch (at.face) {
    case 'south':
      return { x0: a0, x1: a1, z0: wall.z1, z1: wall.z1 + depth, y0, y1 };
    case 'north':
      return { x0: a0, x1: a1, z0: wall.z0 - depth, z1: wall.z0, y0, y1 };
    case 'east':
      return { x0: wall.x1, x1: wall.x1 + depth, z0: a0, z1: a1, y0, y1 };
    default:
      return { x0: wall.x0 - depth, x1: wall.x0, z0: a0, z1: a1, y0, y1 };
  }
}

/** Adds a door at `at`: a dark leaf in a timber frame with a lintel. */
export function addDoor(shape: ShapeBuilder, at: FaceSpot): void {
  const [l, r, top] = [at.along - at.width / 2, at.along + at.width / 2, at.bottom + at.height];
  shape.addBox(faceBox(at, l, r, at.bottom, top, 0.03), SHAPE_COLORS.door);
  shape.addBox(faceBox(at, l - JAMB, l, at.bottom, top, DETAIL_DEPTH), SHAPE_COLORS.darkTimber);
  shape.addBox(faceBox(at, r, r + JAMB, at.bottom, top, DETAIL_DEPTH), SHAPE_COLORS.darkTimber);
  shape.addBox(faceBox(at, l - JAMB, r + JAMB, top, top + 0.07, DETAIL_DEPTH), SHAPE_COLORS.darkTimber);
}

/** Adds a window at `at`: a dark pane between two open shutters, over a sill. */
export function addWindow(shape: ShapeBuilder, at: FaceSpot): void {
  const [l, r, top] = [at.along - at.width / 2, at.along + at.width / 2, at.bottom + at.height];
  const shutter = at.width / 2;
  shape.addBox(faceBox(at, l, r, at.bottom, top, 0.02), SHAPE_COLORS.windowDark);
  shape.addBox(faceBox(at, l - shutter, l, at.bottom, top, 0.04), SHAPE_COLORS.shutter);
  shape.addBox(faceBox(at, r, r + shutter, at.bottom, top, 0.04), SHAPE_COLORS.shutter);
  shape.addBox(faceBox(at, l - 0.04, r + 0.04, at.bottom - 0.05, at.bottom, 0.055), SHAPE_COLORS.darkTimber);
}

/** Adds a narrow dark arrow slit at `at`, barely proud of the wall so it fits pieces that fill their tile. */
export function addArrowSlit(shape: ShapeBuilder, at: FaceSpot): void {
  const [l, r] = [at.along - at.width / 2, at.along + at.width / 2];
  shape.addBox(faceBox(at, l, r, at.bottom, at.bottom + at.height, 0.02), SHAPE_COLORS.windowDark);
}

/** Adds dark timber framing to `wall`: corner posts, head beams all round, a sill and middle posts at the front and east. */
export function addTimberFrame(shape: ShapeBuilder, wall: BoxSpec, beam: number): void {
  const h = beam / 2;
  const { x0, x1, z0, z1, y0, y1 } = wall;
  const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  const posts = [x0, x1].flatMap((x) => [z0, z1].map((z) => ({ x0: x - h, x1: x + h, z0: z - h, z1: z + h, y0, y1 })));
  const beams: BoxSpec[] = [
    ...posts,
    { x0, x1, z0: z1 - h, z1: z1 + h, y0: y1 - beam, y1 },
    { x0, x1, z0: z0 - h, z1: z0 + h, y0: y1 - beam, y1 },
    { x0: x0 - h, x1: x0 + h, z0, z1, y0: y1 - beam, y1 },
    { x0: x1 - h, x1: x1 + h, z0, z1, y0: y1 - beam, y1 },
    { x0, x1, z0: z1 - h, z1: z1 + h, y0, y1: y0 + beam },
    { x0: mx - h, x1: mx + h, z0: z1 - h, z1: z1 + h, y0, y1 },
    { x0: x1 - h, x1: x1 + h, z0: mz - h, z1: mz + h, y0, y1 },
  ];
  for (const spec of beams) shape.addBox(spec, SHAPE_COLORS.darkTimber);
}

/** Adds a stone course `height` tall round the foot of `wall`, standing `overhang` proud of it. */
export function addPlinth(shape: ShapeBuilder, wall: BoxSpec, height: number, overhang: number): void {
  const { x0, x1, z0, z1, y0 } = wall;
  const spec = { x0: x0 - overhang, x1: x1 + overhang, z0: z0 - overhang, z1: z1 + overhang, y0, y1: y0 + height };
  shape.addBox(spec, SHAPE_COLORS.foundation);
}

/** Adds a square stone chimney of side `size` from corner (x, z), rising from `y0` to `y1`, with a cap and a flue. */
export function addChimney(shape: ShapeBuilder, x: number, z: number, size: number, y0: number, y1: number): void {
  const cap = 0.08;
  const o = 0.03;
  const f = 0.05;
  shape.addBox({ x0: x, x1: x + size, z0: z, z1: z + size, y0, y1: y1 - cap }, SHAPE_COLORS.stone);
  shape.addBox({ x0: x - o, x1: x + size + o, z0: z - o, z1: z + size + o, y0: y1 - cap, y1 }, SHAPE_COLORS.darkStone);
  shape.addBox({ x0: x + f, x1: x + size - f, z0: z + f, z1: z + size - f, y0: y1 - 0.02, y1: y1 + 0.01 }, SHAPE_COLORS.windowDark);
}
