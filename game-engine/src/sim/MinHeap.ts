// A binary min-heap of node indices ordered by integer (key, tie, node), for the path-finder's open set.

export class MinHeap {
  private nodes: Int32Array;
  private keys: Int32Array;
  private ties: Int32Array;
  private count = 0;

  /** An empty heap with room for `capacity` entries; it grows (doubling) when that is exceeded. */
  public constructor(capacity = 1024) {
    this.nodes = new Int32Array(capacity);
    this.keys = new Int32Array(capacity);
    this.ties = new Int32Array(capacity);
  }

  /** Number of entries in the heap. */
  public get size(): number {
    return this.count;
  }

  /**
   * Adds `node` with integer `key`; among equal keys the smaller integer `tie` comes first, then the smaller node.
   * The same node may be pushed more than once.
   */
  public push(node: number, key: number, tie = 0): void {
    if (this.count === this.nodes.length) this.grow();
    let i = this.count++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(node, key, tie, parent)) break;
      this.move(parent, i);
      i = parent;
    }
    this.set(i, node, key, tie);
  }

  /** Removes and returns the first node in (key, tie, node) order; -1 when empty. */
  public pop(): number {
    if (this.count === 0) return -1;
    const top = this.nodes[0];
    const last = --this.count;
    const node = this.nodes[last];
    const key = this.keys[last];
    const tie = this.ties[last];
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= last) break;
      const right = child + 1;
      if (right < last && this.before(this.nodes[right], this.keys[right], this.ties[right], child)) child = right;
      if (this.before(node, key, tie, child)) break;
      this.move(child, i);
      i = child;
    }
    this.set(i, node, key, tie);
    return top;
  }

  /** Removes every entry, keeping the allocated storage. */
  public clear(): void {
    this.count = 0;
  }

  /** Whether the entry (node, key, tie) comes strictly before the stored entry at `slot`. */
  private before(node: number, key: number, tie: number, slot: number): boolean {
    if (key !== this.keys[slot]) return key < this.keys[slot];
    if (tie !== this.ties[slot]) return tie < this.ties[slot];
    return node < this.nodes[slot];
  }

  private move(from: number, to: number): void {
    this.set(to, this.nodes[from], this.keys[from], this.ties[from]);
  }

  private set(slot: number, node: number, key: number, tie: number): void {
    this.nodes[slot] = node;
    this.keys[slot] = key;
    this.ties[slot] = tie;
  }

  private grow(): void {
    const capacity = this.nodes.length * 2 || 16;
    const nodes = new Int32Array(capacity);
    const keys = new Int32Array(capacity);
    const ties = new Int32Array(capacity);
    nodes.set(this.nodes);
    keys.set(this.keys);
    ties.set(this.ties);
    this.nodes = nodes;
    this.keys = keys;
    this.ties = ties;
  }
}
