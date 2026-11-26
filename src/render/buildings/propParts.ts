// Loose props around buildings: round logs and log piles, a chopping block with an axe, grain sacks.
import * as THREE from 'three';
import type { ShapeBuilder } from './ShapeBuilder';
import { SHAPE_COLORS } from './shapeParts';
import { shadeVariant } from './shadeVariant';

/** Sides of a round log or block: few, for the low-poly look. */
const ROUND_SEGMENTS = 6;
const LOG_SALT = 0x109;

/** A round log lying along `axis`, centred on (x, y, z). */
export interface LogSpec {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly length: number;
  readonly radius: number;
  readonly axis: 'x' | 'z';
}

/** Adds one round log painted `color`. */
export function addLog(shape: ShapeBuilder, log: LogSpec, color: number = SHAPE_COLORS.logs): void {
  const geometry = new THREE.CylinderGeometry(log.radius, log.radius, log.length, ROUND_SEGMENTS);
  geometry.rotateZ(Math.PI / 2); // along x
  if (log.axis === 'z') geometry.rotateY(Math.PI / 2);
  shape.add(geometry.translate(log.x, log.y, log.z), color);
}

/**
 * Adds a pile of logs along `axis` resting on y = `floor`, centred at (x, z): `rows` logs at the bottom, one fewer on
 * each row above, each log a slightly different shade.
 */
export function addLogPile(
  shape: ShapeBuilder,
  centre: { readonly x: number; readonly z: number; readonly floor: number },
  length: number,
  radius: number,
  rows: number,
  axis: 'x' | 'z',
): void {
  let index = 0;
  for (let row = 0; row < rows; row++) {
    const count = rows - row;
    const y = centre.floor + radius + row * radius * 1.7;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * radius * 2;
      const x = axis === 'z' ? centre.x + offset : centre.x;
      const z = axis === 'x' ? centre.z + offset : centre.z;
      addLog(shape, { x, y, z, length, radius, axis }, shadeVariant(SHAPE_COLORS.logs, LOG_SALT, index++, 0.12));
    }
  }
}

/** Adds a chopping block standing on y = `floor` at (x, z), with an axe resting in it. */
export function addChoppingBlock(shape: ShapeBuilder, x: number, z: number, floor: number): void {
  const height = 0.2;
  const block = new THREE.CylinderGeometry(0.11, 0.12, height, ROUND_SEGMENTS);
  shape.add(block.translate(x, floor + height / 2, z), SHAPE_COLORS.timber);
  const top = floor + height;
  shape.addBox({ x0: x - 0.02, x1: x + 0.02, z0: z - 0.02, z1: z + 0.2, y0: top, y1: top + 0.05 }, SHAPE_COLORS.darkTimber);
  shape.addBox({ x0: x - 0.015, x1: x + 0.015, z0: z - 0.06, z1: z + 0.02, y0: top - 0.02, y1: top + 0.07 }, SHAPE_COLORS.darkStone);
}

/** Adds a grain sack sitting on y = `floor` at (x, z): a squat rounded bag with a tied neck. */
export function addSack(shape: ShapeBuilder, x: number, z: number, floor: number): void {
  const bag = new THREE.CylinderGeometry(0.09, 0.12, 0.22, ROUND_SEGMENTS);
  shape.add(bag.translate(x, floor + 0.11, z), SHAPE_COLORS.rope);
  const neck = new THREE.CylinderGeometry(0.04, 0.07, 0.06, ROUND_SEGMENTS);
  shape.add(neck.translate(x, floor + 0.25, z), shadeVariant(SHAPE_COLORS.rope, LOG_SALT, 99, 0.2));
}
