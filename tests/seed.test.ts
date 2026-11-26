import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/game/GameConfig';
import { parseSeed, parseSeedText, randomSeed } from '../src/game/seed';

describe('parseSeed', () => {
  it('defaults to seed 1', () => {
    expect(GAME_CONFIG.defaultSeed).toBe(1);
  });

  it('reads valid seeds', () => {
    expect(parseSeed('?seed=123')).toBe(123);
    expect(parseSeed('?seed=0')).toBe(0);
    expect(parseSeed('?seed=4294967295')).toBe(4294967295);
  });

  it.each(['', '?seed=', '?seed=abc', '?seed=-5', '?seed=1.5', '?seed=4294967296', '?seed=1e3', '?other=5'])(
    'falls back to the default for %j',
    (search) => {
      expect(parseSeed(search)).toBe(1);
    },
  );
});

describe('randomSeed', () => {
  it('returns integers in 0..4294967295', () => {
    for (let i = 0; i < 100; i++) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(4294967295);
    }
  });
});

describe('parseSeedText', () => {
  it('reads typed seeds, ignoring surrounding spaces', () => {
    expect(parseSeedText('42')).toBe(42);
    expect(parseSeedText('  7 ')).toBe(7);
    expect(parseSeedText('4294967295')).toBe(4294967295);
  });

  it.each(['', ' ', 'abc', '-5', '1.5', '4294967296', '1e3', '0x10'])('rejects %j', (text) => {
    expect(parseSeedText(text)).toBeNull();
  });
});
