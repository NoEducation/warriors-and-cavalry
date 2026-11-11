// White outline drawn on top of everything around the hovered tile.
import * as THREE from 'three';
import type { GameMap } from '../sim/map';

const LIFT = 0.05;

export interface Highlight {
  object: THREE.LineLoop;
  show(map: GameMap, tx: number, ty: number): void;
  hide(): void;
}

/** Starts hidden. The outline follows the tile's four corner heights, lifted slightly. */
export function createHighlight(): Highlight {
  const positions = new THREE.BufferAttribute(new Float32Array(4 * 3), 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positions);
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false });
  const object = new THREE.LineLoop(geometry, material);
  object.renderOrder = 1;
  object.frustumCulled = false; // bounds change every time the outline moves
  object.visible = false;

  function show(map: GameMap, tx: number, ty: number): void {
    const corners: [number, number][] = [
      [tx, ty],
      [tx + 1, ty],
      [tx + 1, ty + 1],
      [tx, ty + 1],
    ];
    corners.forEach(([cx, cy], i) => positions.setXYZ(i, cx, map.heightAt(cx, cy) + LIFT, cy));
    positions.needsUpdate = true;
    object.visible = true;
  }

  function hide(): void {
    object.visible = false;
  }

  return { object, show, hide };
}
