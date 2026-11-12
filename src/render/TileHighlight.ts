// White outline drawn on top of everything around the hovered tile.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';

const LIFT = 0.05;

export class TileHighlight {
  /** Add this to the scene once. */
  public readonly object: THREE.LineLoop;
  private readonly positions: THREE.BufferAttribute;

  /** Starts hidden. */
  public constructor() {
    this.positions = new THREE.BufferAttribute(new Float32Array(4 * 3), 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.positions);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false });
    this.object = new THREE.LineLoop(geometry, material);
    this.object.renderOrder = 1;
    this.object.frustumCulled = false; // bounds change every time the outline moves
    this.object.visible = false;
  }

  /** Outlines tile (tx, ty) along its four corner heights, lifted slightly, and makes it visible. */
  public showTile(map: GameMap, tx: number, ty: number): void {
    const corners: [number, number][] = [
      [tx, ty],
      [tx + 1, ty],
      [tx + 1, ty + 1],
      [tx, ty + 1],
    ];
    corners.forEach(([cx, cy], i) => this.positions.setXYZ(i, cx, map.heightAt(cx, cy) + LIFT, cy));
    this.positions.needsUpdate = true;
    this.object.visible = true;
  }

  /** Hides the outline, e.g. when no tile is hovered or the map changes. */
  public hide(): void {
    this.object.visible = false;
  }
}
