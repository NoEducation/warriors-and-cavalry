// Translucent preview of a dragged wall line: one instanced mesh of green pieces that would be built, one of red.
import * as THREE from 'three';
import { ObjectKind } from '../sim/ObjectKind';
import type { WallLinePreview } from '../sim/WallBuilder';
import { WALL_LINE_MAX_TILES } from '../sim/wallLine';
import type { World } from '../sim/World';
import type { BuildingMeshFactory } from './BuildingMeshFactory';
import { floorHeight } from './floorHeight';
import { GHOST_CONFIG } from './ghostConfig';

export class WallLineGhost {
  /** Add this to the scene once; shows the pieces of the line while one is shown. */
  public readonly object = new THREE.Group();
  private readonly geometry: THREE.BufferGeometry;
  private readonly okPieces: THREE.InstancedMesh;
  private readonly blockedPieces: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();

  /** Builds both meshes once from `factory`'s wall piece, with room for the longest line; starts hidden. */
  public constructor(factory: BuildingMeshFactory) {
    const model = factory.create(ObjectKind.Wall);
    (model.material as THREE.Material).dispose();
    this.geometry = model.geometry;
    this.okPieces = this.createPieces(GHOST_CONFIG.okColor);
    this.blockedPieces = this.createPieces(GHOST_CONFIG.blockedColor);
    this.object.add(this.okPieces, this.blockedPieces);
    this.object.visible = false;
  }

  /**
   * Shows a piece on each tile of `preview` on `world`'s terrain, green where one would be placed and red elsewhere.
   * Cheap enough to call per frame while dragging.
   */
  public show(world: World, preview: WallLinePreview): void {
    let ok = 0;
    let blocked = 0;
    preview.tiles.forEach((tile, i) => {
      const y = floorHeight(world.map, ObjectKind.Wall, tile.tx, tile.ty);
      this.matrix.makeTranslation(tile.tx, y, tile.ty);
      if (preview.placeable[i]) this.okPieces.setMatrixAt(ok++, this.matrix);
      else this.blockedPieces.setMatrixAt(blocked++, this.matrix);
    });
    this.setPieces(this.okPieces, ok);
    this.setPieces(this.blockedPieces, blocked);
    this.object.visible = true;
  }

  /** Hides every piece. Cheap; call every frame no wall drag is in progress. */
  public hide(): void {
    this.okPieces.count = 0;
    this.blockedPieces.count = 0;
    this.object.visible = false;
  }

  /** Removes both meshes and frees their geometry and materials. Call once when the ghost is no longer needed. */
  public dispose(): void {
    this.object.clear();
    this.geometry.dispose();
    for (const pieces of [this.okPieces, this.blockedPieces]) {
      (pieces.material as THREE.Material).dispose();
      pieces.dispose();
    }
  }

  private createPieces(color: number): THREE.InstancedMesh {
    const material = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: GHOST_CONFIG.opacity,
      depthWrite: false,
      flatShading: true,
    });
    const pieces = new THREE.InstancedMesh(this.geometry, material, WALL_LINE_MAX_TILES);
    pieces.count = 0;
    // The instances move every frame, so a bounding sphere computed once would cull the wrong pieces.
    pieces.frustumCulled = false;
    // Draw after other translucent meshes (the water plane), which would otherwise be blended over the ghost.
    pieces.renderOrder = 1;
    return pieces;
  }

  /** Draws the first `count` instances of `pieces`, whose matrices were just written. */
  private setPieces(pieces: THREE.InstancedMesh, count: number): void {
    pieces.count = count;
    pieces.instanceMatrix.needsUpdate = true;
  }
}
