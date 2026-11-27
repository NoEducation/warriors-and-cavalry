import { describe, expect, it } from 'vitest';
import { OBJECT_KINDS, ObjectKind } from '../src/sim/ObjectKind';

describe('OBJECT_KINDS', () => {
  it('is frozen all the way down: the table, every entry and its cost, storage and production', () => {
    expect(Object.isFrozen(OBJECT_KINDS)).toBe(true);
    for (const kind of Object.values(ObjectKind)) {
      const info = OBJECT_KINDS[kind];
      expect(Object.isFrozen(info), info.name).toBe(true);
      expect(Object.isFrozen(info.cost), info.name).toBe(true);
      expect(Object.isFrozen(info.storage), info.name).toBe(true);
      if (info.production) expect(Object.isFrozen(info.production), info.name).toBe(true);
    }
  });
});
