import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TreeGeometryFactory } from '../src/render/TreeGeometryFactory';
import { ALL_TREE_SPECIES, TREE_SPECIES, TreeSpecies } from '../src/render/TreeSpecies';

const factory = new TreeGeometryFactory();
const geometries = new Map(ALL_TREE_SPECIES.map((s) => [s, factory.create(s)] as const));

function triangles(geometry: THREE.BufferGeometry): number {
  return (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;
}

function box(species: TreeSpecies): THREE.Box3 {
  const geometry = geometries.get(species)!;
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

describe('TreeGeometryFactory', () => {
  it('gives every species position, normal and color attributes of equal count', () => {
    for (const geometry of geometries.values()) {
      const count = geometry.getAttribute('position').count;
      expect(count).toBeGreaterThan(0);
      expect(geometry.getAttribute('normal').count).toBe(count);
      expect(geometry.getAttribute('color').count).toBe(count);
    }
  });

  it('stays within the triangle budget', () => {
    const counts = ALL_TREE_SPECIES.map((s) => triangles(geometries.get(s)!));
    for (const count of counts) expect(count).toBeLessThanOrEqual(70);
    expect(counts.reduce((a, b) => a + b, 0) / counts.length).toBeLessThanOrEqual(55);
  });

  it('stands every tree on y = 0 and makes it as tall as its species', () => {
    for (const species of ALL_TREE_SPECIES) {
      expect(box(species).min.y).toBeCloseTo(0, 5);
      expect(box(species).max.y).toBeCloseTo(TREE_SPECIES[species].height, 1);
    }
  });

  it('gives the dead tree no green vertex', () => {
    const color = geometries.get(TreeSpecies.Dead)!.getAttribute('color');
    for (let i = 0; i < color.count; i++) {
      const g = color.getY(i);
      expect(g > color.getX(i) && g > color.getZ(i), `vertex ${i} is green`).toBe(false);
    }
  });

  it('makes birches and pines at least as tall as oaks, and oaks broader', () => {
    const height = (s: TreeSpecies): number => box(s).max.y;
    const width = (s: TreeSpecies): number => box(s).max.x - box(s).min.x;
    expect(height(TreeSpecies.Birch)).toBeGreaterThanOrEqual(height(TreeSpecies.Oak));
    expect(height(TreeSpecies.Pine)).toBeGreaterThanOrEqual(height(TreeSpecies.Oak));
    expect(width(TreeSpecies.Oak)).toBeGreaterThan(width(TreeSpecies.Birch));
  });

  it('keeps the average tree about 1.6 units tall', () => {
    const avg = ALL_TREE_SPECIES.reduce<number>((sum, s) => sum + box(s).max.y, 0) / ALL_TREE_SPECIES.length;
    expect(avg).toBeGreaterThan(1.4);
    expect(avg).toBeLessThan(1.8);
  });
});
