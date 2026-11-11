import { todayKey } from '../../core/daily';
import type { Difficulty } from './engine/generator';
import { getDaily, getPuzzle } from './puzzles';
import { abandonSaved, savedGame } from './saved';
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

/** Replace any game in progress with a fresh one. */
export async function startGame(kind: StartKind): Promise<void> {
  const g = await createGame(kind);
  abandonSaved();
  savedGame.set(g);
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = savedGame.get();
  return !!g && g.status === 'playing' && g.touched;
}
