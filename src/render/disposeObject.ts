// Frees GPU resources of a three.js object tree.
import * as THREE from 'three';

/** Disposes the geometry and material(s) of every mesh under `root` (including `root`). Call after removing it. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials: THREE.Material[] = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) material.dispose();
  });
}
