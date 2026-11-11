import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SIM_DIR = join(__dirname, '..', 'src', 'sim');
const FORBIDDEN: RegExp[] = [
  /from\s+['"]three/,
  /Math\.(random|sin|cos|tan|pow|exp|log|atan2)\b/,
  /\b(document|window)\./,
];

describe('src/sim purity', () => {
  const files = readdirSync(SIM_DIR).filter((f) => f.endsWith('.ts'));

  it('finds sim source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} uses no rendering, DOM or non-deterministic APIs`, () => {
      const source = readFileSync(join(SIM_DIR, file), 'utf8');
      for (const pattern of FORBIDDEN) {
        expect(source, `${file} matches ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});
