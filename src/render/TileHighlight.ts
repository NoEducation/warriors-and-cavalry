// White outline drawn on top of everything around the hovered tile or footprint.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';

const LIFT = 0.05;
/** Most outline points supported: the perimeter corners of a footprint up to 16 tiles per side. */
const MAX_POINTS = 64;

export class TileHighlight {
  /** Add this to the scene once. */
  public readonly object: THREE.LineLoop;
  private readonly positions: THREE.BufferAttribute;

  /** Starts hidden. */
  public constructor() {
    this.positions = new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3);
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
    this.showFootprint(map, tx, ty, 1, 1);
  }

  /**
   * Outlines the `width` x `height` tile rectangle starting at (tx, ty), following the corner heights along its edge and
   * skipping corners outside the map, and makes it visible. Call per frame for the hovered footprint.
   */
  public showFootprint(map: GameMap, tx: number, ty: number, width: number, height: number): void {
    const perimeter: [number, number][] = [];
    for (let x = tx; x < tx + width; x++) perimeter.push([x, ty]);
    for (let y = ty; y < ty + height; y++) perimeter.push([tx + width, y]);
    for (let x = tx + width; x > tx; x--) perimeter.push([x, ty + height]);
    for (let y = ty + height; y > ty; y--) perimeter.push([tx, y]);
    let count = 0;
    for (const [cx, cy] of perimeter) {
      if (count >= MAX_POINTS) break;
      if (cx < 0 || cy < 0 || cx > map.width || cy > map.height) continue;
      this.positions.setXYZ(count++, cx, map.heightAt(cx, cy) + LIFT, cy);
    }
    this.object.geometry.setDrawRange(0, count);
    this.positions.needsUpdate = true;
    this.object.visible = count > 1;
  }

  /** Hides the outline, e.g. when no tile is hovered or the map changes. */
  public hide(): void {
    this.object.visible = false;
  }
}
