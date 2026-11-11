import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { GAMES, validateRegistry } from './games/registry';

/**
 * Module boundaries that keep games independent:
 *
 *   app/          shell        → may import anything
 *   games/<id>/   one game     → core/, ui/, games/types.ts; never app/ or another game
 *   games/registry.ts          → the only file that imports games
 *   ui/           shared UI    → core/ only
 *   core/         services     → core/ only (no UI besides preact hooks)
 */
const SRC = resolve(__dirname);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });
}

function imports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1] ?? m[2];
    if (spec.startsWith('.')) out.push(relative(SRC, resolve(dirname(file), spec)));
  }
  return out;
}

const area = (p: string) => p.split('/')[0];
/** "sudoku" for games/sudoku/…, null for games/types.ts, games/registry.ts and non-game files. */
const gameOf = (p: string) => (p.startsWith('games/') && p.split('/').length > 2 ? p.split('/')[1] : null);

/** May `from` import `to`? */
function allowed(from: string, to: string): boolean {
  switch (area(from)) {
    case 'core':
      return area(to) === 'core';
    case 'ui':
      return area(to) === 'ui' || area(to) === 'core';
    case 'app':
      return gameOf(to) === null; // games only through games/registry.ts
    case 'games': {
      const game = gameOf(from);
      if (!game) return true; // registry.ts / types.ts
      if (area(to) === 'app' || to.startsWith('games/registry')) return false;
      return gameOf(to) === null || gameOf(to) === game;
    }
    default:
      return true; // main.tsx, test helpers
  }
}

it('respects module boundaries', () => {
  const violations: string[] = [];
  for (const file of files(SRC)) {
    const from = relative(SRC, file);
    for (const to of imports(file)) if (!allowed(from, to)) violations.push(`${from} → ${to}`);
  }
  expect(violations).toEqual([]);
});

it('has a valid registry', () => {
  expect(() => validateRegistry()).not.toThrow();
  expect(GAMES.length).toBeGreaterThan(0);
});
