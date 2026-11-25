// A binary min-heap of node indices keyed by integers, for the path-finder's open set.

export class MinHeap {
  private nodes: Int32Array;
  private keys: Int32Array;
  private count = 0;

  /** An empty heap with room for `capacity` entries; it grows (doubling) when that is exceeded. */
  public constructor(capacity = 1024) {
    this.nodes = new Int32Array(capacity);
    this.keys = new Int32Array(capacity);
  }

  /** Number of entries in the heap. */
  public get size(): number {
    return this.count;
  }

  /** Adds `node` with integer `key`. The same node may be pushed more than once. */
  public push(node: number, key: number): void {
    if (this.count === this.nodes.length) this.grow();
    let i = this.count++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(node, key, this.nodes[parent], this.keys[parent])) break;
      this.nodes[i] = this.nodes[parent];
      this.keys[i] = this.keys[parent];
      i = parent;
    }
    this.nodes[i] = node;
    this.keys[i] = key;
  }

  /** Removes and returns the node with the smallest key (the smaller node on equal keys); -1 when empty. */
  public pop(): number {
    if (this.count === 0) return -1;
    const top = this.nodes[0];
    const last = --this.count;
    const node = this.nodes[last];
    const key = this.keys[last];
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= last) break;
      const right = child + 1;
      if (right < last && this.before(this.nodes[right], this.keys[right], this.nodes[child], this.keys[child])) {
        child = right;
      }
      if (!this.before(this.nodes[child], this.keys[child], node, key)) break;
      this.nodes[i] = this.nodes[child];
      this.keys[i] = this.keys[child];
      i = child;
    }
    this.nodes[i] = node;
    this.keys[i] = key;
    return top;
  }

  /** Removes every entry, keeping the allocated storage. */
  public clear(): void {
    this.count = 0;
  }

  private before(nodeA: number, keyA: number, nodeB: number, keyB: number): boolean {
    return keyA < keyB || (keyA === keyB && nodeA < nodeB);
  }

  private grow(): void {
    const capacity = this.nodes.length * 2 || 16;
    const nodes = new Int32Array(capacity);
    const keys = new Int32Array(capacity);
    nodes.set(this.nodes);
    keys.set(this.keys);
    this.nodes = nodes;
    this.keys = keys;
  }
}
