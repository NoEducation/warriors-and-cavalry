// Which woodcutter has claimed which tree, so no two of them walk to or chop the same one.
export class TreeClaims {
  /** Claiming peasant id per tree id. */
  private readonly byTree = new Map<number, number>();

  /** Marks tree `treeId` as claimed by peasant `peasantId`. Call when a woodcutter picks it. */
  public claim(treeId: number, peasantId: number): void {
    this.byTree.set(treeId, peasantId);
  }

  /** Frees tree `treeId` for any woodcutter; fine when it is not claimed. */
  public release(treeId: number): void {
    this.byTree.delete(treeId);
  }

  /** True when some woodcutter has claimed tree `treeId`. */
  public isClaimed(treeId: number): boolean {
    return this.byTree.has(treeId);
  }
}
