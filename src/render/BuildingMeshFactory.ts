// Low-poly meshes for each buildable object kind.
import * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';

/** Gap left between a building and the edge of its footprint, in world units. */
const FOOTPRINT_MARGIN = 0.15;
/** The foundation reaches this far below the floor so the building never floats on uneven ground. */
const FOUNDATION_DEPTH = 1;
/** The foundation shows this far above the floor. */
const FOUNDATION_LIFT = 0.1;

const COLORS = {
  foundation: 0x6e6a60,
  keepStone: 0x9a9a94,
  hovelWalls: 0x8a6a45,
  hovelRoof: 0xc9b458,
  hutWalls: 0x7a5a3a,
  hutRoof: 0x4a3a2a,
  logs: 0x6b4a2b,
} as const;

/** An axis-aligned box in a building's local coordinates. */
interface BoxSpec {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
}

export class BuildingMeshFactory {
  /**
   * Creates a new group for a building of `kind`. Local origin is the footprint's lowest-coordinate corner, y = 0 is the
   * floor. The caller owns the result and disposes it. Throws for kinds that are not buildings (trees).
   */
  public create(kind: ObjectKind): THREE.Group {
    const info = OBJECT_KINDS[kind];
    if (!info.buildable) throw new Error(`${info.name} is not a building`);
    const group = new THREE.Group();
    const m = FOOTPRINT_MARGIN;
    const w = info.width;
    const d = info.height;
    const foundation: BoxSpec = { x0: m, z0: m, x1: w - m, z1: d - m, y0: -FOUNDATION_DEPTH, y1: FOUNDATION_LIFT };
    group.add(this.box(foundation, COLORS.foundation));
    switch (kind) {
      case ObjectKind.Keep:
        this.addKeep(group, w, d);
        break;
      case ObjectKind.Hovel:
        this.addHovel(group, w, d);
        break;
      case ObjectKind.WoodcutterHut:
        this.addWoodcutterHut(group, w, d);
        break;
    }
    return group;
  }

  /** Stone hall with a taller tower on its lowest-coordinate corner. */
  private addKeep(group: THREE.Group, w: number, d: number): void {
    const inset = 0.45;
    group.add(this.box({ x0: inset, z0: inset, x1: w - inset, z1: d - inset, y0: 0, y1: 2.2 }, COLORS.keepStone));
    const m = FOOTPRINT_MARGIN;
    const tower = 1.5;
    group.add(this.box({ x0: m, z0: m, x1: m + tower, z1: m + tower, y0: 0, y1: 3.8 }, COLORS.keepStone));
  }

  /** Small house with a pyramid thatch roof. */
  private addHovel(group: THREE.Group, w: number, d: number): void {
    const inset = 0.4;
    group.add(this.box({ x0: inset, z0: inset, x1: w - inset, z1: d - inset, y0: 0, y1: 0.9 }, COLORS.hovelWalls));
    const roofWidth = w - 2 * 0.25;
    const roof = new THREE.ConeGeometry(roofWidth / Math.SQRT2, 0.8, 4);
    roof.rotateY(Math.PI / 4); // edges parallel to the walls
    roof.translate(w / 2, 0.9 + 0.4, d / 2);
    group.add(this.mesh(roof, COLORS.hovelRoof));
  }

  /** House with a gable roof running along x and a log pile beside it. */
  private addWoodcutterHut(group: THREE.Group, w: number, d: number): void {
    const x0 = 0.3;
    const x1 = w - 0.3;
    const z0 = 0.35;
    const z1 = d - 0.7;
    const wallHeight = 0.85;
    group.add(this.box({ x0, z0, x1, z1, y0: 0, y1: wallHeight }, COLORS.hutWalls));
    const overhang = 0.12;
    const halfSpan = (z1 - z0) / 2 + overhang;
    const shape = new THREE.Shape();
    shape.moveTo(-halfSpan, 0);
    shape.lineTo(halfSpan, 0);
    shape.lineTo(0, 0.7);
    shape.closePath();
    const roof = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0 + 2 * overhang, bevelEnabled: false });
    roof.rotateY(Math.PI / 2); // shape x -> -z, extrusion z -> x
    roof.translate(x0 - overhang, wallHeight, (z0 + z1) / 2);
    group.add(this.mesh(roof, COLORS.hutRoof));
    const logPile: BoxSpec = { x0: 0.4, z0: d - 0.5, x1: w - 0.6, z1: d - FOOTPRINT_MARGIN - 0.05, y0: 0, y1: 0.3 };
    group.add(this.box(logPile, COLORS.logs));
  }

  private box(spec: BoxSpec, color: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(spec.x1 - spec.x0, spec.y1 - spec.y0, spec.z1 - spec.z0);
    geometry.translate((spec.x0 + spec.x1) / 2, (spec.y0 + spec.y1) / 2, (spec.z0 + spec.z1) / 2);
    return this.mesh(geometry, color);
  }

  private mesh(geometry: THREE.BufferGeometry, color: number): THREE.Mesh {
    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  }
}
