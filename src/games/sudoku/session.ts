import { todayKey } from '../../core/daily';
import type { Difficulty } from './engine/generator';
import { getDaily, getPuzzle } from './puzzles';
import { savedGame, sudokuStats } from './storage';
import { SudokuGame, newGame } from './state';

export type StartKind = Difficulty | 'daily';

/** Build a new game (may take a moment if the pool is empty). */
export async function createGame(kind: StartKind): Promise<SudokuGame> {
  if (kind === 'daily') {
    const date = todayKey();
    const p = await getDaily(date);
    return newGame({ ...p, mode: 'daily', date });
  }
  const p = await getPuzzle(kind);
  return newGame({ ...p, mode: kind, difficulty: kind });
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = savedGame.get();
  return !!g && g.status === 'playing' && g.touched;
}

/** Abandon the current game; counts as a loss if the player had started playing. */
export function abandonSaved(): void {
  const g = savedGame.get();
  if (g && g.status === 'playing' && g.touched) {
    sudokuStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.hints });
  }
  savedGame.set(null);
}

/** Replace any game in progress with a fresh one. */
export async function startGame(kind: StartKind): Promise<void> {
  const g = await createGame(kind);
  abandonSaved();
  savedGame.set(g);
}
