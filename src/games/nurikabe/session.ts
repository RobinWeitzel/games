import { todayKey } from '../../core/daily';
import { createRng, hashString } from '../../core/random';
import { createPuzzleSource } from '../../core/puzzleSource';
import { Difficulty, SIZE, generate } from './engine';
import { nkSave, nkStats } from './storage';
import { NurikabeGame, NurikabeMode, newGame } from './state';

export const MODE_LABEL: Record<NurikabeMode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', daily: 'Daily' };
export const sizeText = (d: Difficulty) => `${SIZE[d]} × ${SIZE[d]}`;

/** Generating a 10 × 10 puzzle can take a moment: it runs in a worker, with one puzzle per mode kept ready. */
const puzzles = createPuzzleSource(
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
  (mode: Difficulty, seed: number) => generate(mode, createRng(seed)),
);

const dailySeed = (date: string) => hashString(`nurikabe:${date}`);

export function prefetch(): void {
  puzzles.prefetch(['easy', 'medium', 'hard']);
  void puzzles.seeded('medium', dailySeed(todayKey()));
}

/** A new puzzle with one solution. The daily puzzle (Medium) is the same for everyone on a date. */
export async function createGame(mode: NurikabeMode): Promise<NurikabeGame> {
  if (mode !== 'daily') return newGame({ mode, difficulty: mode, ...(await puzzles.next(mode)) });
  const date = todayKey();
  return newGame({ mode, difficulty: 'medium', date, ...(await puzzles.seeded('medium', dailySeed(date))) });
}

export function hasGameToAbandon(): boolean {
  const g = nkSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: NurikabeGame) => g.hints + g.undos;

export function abandonSaved(): void {
  const g = nkSave.get();
  if (g && g.status === 'playing' && g.touched) nkStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  nkSave.set(null);
}

export async function startGame(mode: NurikabeMode): Promise<void> {
  const g = await createGame(mode);
  abandonSaved();
  nkSave.set(g);
}
