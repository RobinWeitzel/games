import { todayKey } from '../../core/daily';
import { createRng, hashString } from '../../core/random';
import { msSave, msStats } from './storage';
import { BOARDS, MinesweeperGame, MinesweeperMode, newDailyGame, newGame } from './state';

export const MODE_LABEL: Record<MinesweeperMode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', daily: 'Daily' };

/** "10 × 14 · 22 mines" */
export const boardLabel = (mode: MinesweeperMode) => {
  const b = BOARDS[mode];
  return `${b.cols} × ${b.rows} · ${b.mines} mines`;
};

/** A new game. The daily board is the same for everyone on a date and starts with an open area. */
export function createGame(mode: MinesweeperMode): MinesweeperGame {
  if (mode !== 'daily') return newGame(mode);
  const date = todayKey();
  return newDailyGame(date, createRng(hashString(`minesweeper:${date}`)));
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = msSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = msSave.get();
  if (g && g.status === 'playing' && g.touched) {
    msStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.hints });
  }
  msSave.set(null);
}

/** Replace any game in progress with a fresh one. */
export function startGame(mode: MinesweeperMode): void {
  const g = createGame(mode);
  abandonSaved();
  msSave.set(g);
}
