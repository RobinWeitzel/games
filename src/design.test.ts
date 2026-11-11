import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { expect, it } from 'vitest';

/**
 * Static checks for the iOS design rules in docs/DESIGN.md (HIG). They catch the mistakes that
 * are easy to make when adding a game; layout/size checks on rendered screens are done by
 * `npm run audit:ios`.
 */
const SRC = resolve(__dirname);

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });
}
const rel = (p: string) => relative(SRC, p);
const lines = (p: string) => readFileSync(p, 'utf8').split('\n');

it('never uses text smaller than 11pt (HIG Typography minimum)', () => {
  const bad: string[] = [];
  for (const f of files(SRC, /\.css$/)) {
    lines(f).forEach((l, i) => {
      for (const m of l.matchAll(/font-size:[^;]*?(\d+(?:\.\d+)?)px/g)) {
        // max(11px, …) is a floor and fine; anything else under 11px is not.
        if (parseFloat(m[1]) < 11 && !/max\(\s*11px/.test(l)) bad.push(`${rel(f)}:${i + 1}  ${l.trim()}`);
      }
    });
  }
  expect(bad).toEqual([]);
});

it('shell and shared UI use Dynamic Type text styles, not fixed pixel sizes', () => {
  const bad: string[] = [];
  for (const f of [...files(join(SRC, 'styles'), /\.css$/), ...files(join(SRC, 'ui'), /\.css$/)]) {
    lines(f).forEach((l, i) => {
      // The one allowed px value: the root size for browsers without Dynamic Type (base.css).
      if (/font-size:\s*\d+(\.\d+)?px/.test(l) && !l.includes('dynamic-type-fallback')) bad.push(`${rel(f)}:${i + 1}  ${l.trim()}`);
    });
  }
  expect(bad).toEqual([]);
});

it('only games trigger haptics (HIG: reserve haptics for meaningful events)', () => {
  const bad = files(SRC, /\.tsx?$/)
    .filter((f) => !rel(f).startsWith('games/') && rel(f) !== 'core/haptics.ts')
    .filter((f) => /\bhaptic\(/.test(readFileSync(f, 'utf8')))
    .map(rel);
  expect(bad).toEqual([]);
});

it('uses sheets instead of browser dialogs', () => {
  const bad = files(SRC, /\.tsx?$/)
    .filter((f) => /\b(window\.)?(alert|confirm|prompt)\(/.test(readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')))
    .map(rel);
  expect(bad).toEqual([]);
});

it('follows the system appearance (no app-specific light/dark setting)', () => {
  const bad = files(SRC, /\.tsx?$/)
    .filter((f) => rel(f) !== 'app/theme.ts' && /dataset\.theme\s*=/.test(readFileSync(f, 'utf8')))
    .map(rel);
  expect(bad).toEqual([]);
});
