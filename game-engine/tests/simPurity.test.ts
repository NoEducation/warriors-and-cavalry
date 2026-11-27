import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SIM_DIR = join(__dirname, '..', 'src', 'sim');
const ALLOWED_MATH = new Set(['floor', 'sqrt', 'abs', 'min', 'max', 'imul']);
const BANNED: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bfrom\s*['"]three(\/[^'"]*)?['"]/, reason: "imports from 'three'" },
  { pattern: /\bimport\s*['"]three(\/[^'"]*)?['"]/, reason: "side-effect import of 'three'" },
  { pattern: /\bimport\s*\(\s*['"]three(\/[^'"]*)?['"]\s*\)/, reason: "dynamic import of 'three'" },
  { pattern: /\b(document|window)\s*\./, reason: 'touches the DOM' },
  { pattern: /\b(Date|performance|crypto)\b/, reason: 'uses a clock or random source' },
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
}

/** Returns a description of every determinism / purity violation in `source`. */
function simViolations(source: string): string[] {
  const code = stripComments(source);
  const violations: string[] = [];
  for (const match of code.matchAll(/\bMath\s*\.\s*([A-Za-z_$][\w$]*)/g)) {
    if (!ALLOWED_MATH.has(match[1])) violations.push(`Math.${match[1]} is not allowed`);
  }
  for (const { pattern, reason } of BANNED) {
    if (pattern.test(code)) violations.push(reason);
  }
  return violations;
}

function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .sort();
}

describe('simViolations', () => {
  const offending = [
    'Math.hypot(1,2)',
    'Math.log2(8)',
    'Math.random()',
    "import 'three'",
    "import * as THREE from 'three'",
    "import { X } from 'three/addons/x.js'",
    "await import('three')",
    'document.body',
    'window.innerWidth',
    'Date.now()',
    'new Date()',
    'performance.now()',
    'crypto.getRandomValues(a)',
  ];
  for (const snippet of offending) {
    it(`flags ${snippet}`, () => {
      expect(simViolations(snippet)).not.toEqual([]);
    });
  }

  const allowed = [
    'Math.floor(x)',
    'Math.imul(a,b)',
    'Math.sqrt(x) + Math.abs(y) + Math.min(a, b) + Math.max(a, b)',
    "import { fbm2 } from './noise'",
    '// Math.random and Date.now are banned here',
    '/* uses no window. or performance */ const x = 1;',
  ];
  for (const snippet of allowed) {
    it(`accepts ${snippet}`, () => {
      expect(simViolations(snippet)).toEqual([]);
    });
  }
});

describe('src/sim purity', () => {
  const files = listTsFiles(SIM_DIR);

  it('finds sim source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} uses no rendering, DOM or non-deterministic APIs`, () => {
      const source = readFileSync(join(SIM_DIR, file), 'utf8');
      expect(simViolations(source), file).toEqual([]);
    });
  }
});
