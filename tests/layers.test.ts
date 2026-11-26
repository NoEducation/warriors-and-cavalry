import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(__dirname, '..', 'src');

/** Layers (top-level folders of `src`) that each layer must not import from; see the layer table in AGENTS.md. */
const FORBIDDEN: Readonly<Record<string, readonly string[]>> = {
  sim: ['render', 'game', 'ui', 'input'],
  render: ['game', 'ui', 'input'],
  ui: ['game', 'render', 'input'],
  input: ['game', 'render', 'ui', 'sim'],
};

/** Every `.ts` file under `dir`, recursively. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** The top-level `src` folder a path lies in, e.g. `render` for `src/render/buildings/KeepShape.ts`. */
function layerOf(path: string): string {
  return relative(SRC_DIR, path).split(sep)[0];
}

/** `file → imported layer` for every relative import that crosses into a forbidden layer. */
function violations(): string[] {
  const found: string[] = [];
  for (const file of sourceFiles(SRC_DIR)) {
    const forbidden = FORBIDDEN[layerOf(file)] ?? [];
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bfrom\s*['"](\.[^'"]*)['"]|\bimport\s*\(?\s*['"](\.[^'"]*)['"]/g)) {
      const target = layerOf(resolve(dirname(file), match[1] ?? match[2]));
      const name = relative(SRC_DIR, file).split(sep).join('/');
      if (forbidden.includes(target)) found.push(`${name} imports from ${target}`);
    }
  }
  return found;
}

describe('layer boundaries', () => {
  it('finds the source files', () => {
    expect(sourceFiles(SRC_DIR).length).toBeGreaterThan(40);
  });

  it('keeps sim and input on their own, render on sim only, and ui on sim only', () => {
    expect(violations()).toEqual([]);
  });
});
