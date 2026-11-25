import { describe, expect, it } from 'vitest';
import { MinHeap } from '../src/sim/MinHeap';

function drain(heap: MinHeap): number[] {
  const out: number[] = [];
  for (let node = heap.pop(); node !== -1; node = heap.pop()) out.push(node);
  return out;
}

describe('MinHeap', () => {
  it('pops nodes in ascending key order', () => {
    const heap = new MinHeap();
    const keys = [50, 10, 40, 30, 20, 0, 60];
    keys.forEach((key, node) => heap.push(node, key));
    expect(heap.size).toBe(7);
    expect(drain(heap)).toEqual([5, 1, 4, 3, 2, 0, 6]);
    expect(heap.size).toBe(0);
  });

  it('pops the smaller node first when keys are equal', () => {
    const heap = new MinHeap();
    for (const node of [9, 3, 7, 1, 5]) heap.push(node, 10);
    heap.push(8, 5);
    expect(drain(heap)).toEqual([8, 1, 3, 5, 7, 9]);
  });

  it('returns -1 when empty', () => {
    expect(new MinHeap().pop()).toBe(-1);
  });

  it('grows past its initial capacity', () => {
    const heap = new MinHeap(2);
    for (let node = 0; node < 100; node++) heap.push(node, 100 - node);
    const popped = drain(heap);
    expect(popped.length).toBe(100);
    expect(popped[0]).toBe(99);
    expect(popped[99]).toBe(0);
  });

  it('clear empties it', () => {
    const heap = new MinHeap();
    heap.push(1, 1);
    heap.push(2, 2);
    heap.clear();
    expect(heap.size).toBe(0);
    expect(heap.pop()).toBe(-1);
  });
});
