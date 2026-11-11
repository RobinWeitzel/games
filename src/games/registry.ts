import type { GameModule } from './types';
import { sudoku } from './sudoku';
import { numbers } from './numbers';
import { minesweeper } from './minesweeper';
import { solitaire } from './solitaire';
import { nonogram } from './nonogram';
import { calcudoku } from './calcudoku';
import { bridges } from './bridges';
import { freecell } from './freecell';
import { spider } from './spider';

/**
 * All games, in home screen order. To add a game: create src/games/<id>/index.tsx exporting a
 * GameModule and add it here. See docs/ADDING_A_GAME.md.
 *
 * Removing a game from this list hides it but keeps its saved data (it's still exported in
 * backups), so it can come back later without anyone losing progress.
 */
export const GAMES: GameModule[] = [sudoku, numbers, minesweeper, solitaire, freecell, spider, nonogram, calcudoku, bridges];

export function validateRegistry(games: GameModule[] = GAMES): void {
  const seen = new Set<string>();
  for (const g of games) {
    if (!/^[a-z][a-z0-9-]*$/.test(g.id)) throw new Error(`Invalid game id "${g.id}"`);
    if (seen.has(g.id)) throw new Error(`Duplicate game id "${g.id}"`);
    if (g.stats.gameId !== g.id) throw new Error(`Game "${g.id}" uses stats of "${g.stats.gameId}"`);
    if (!g.rules?.length || g.rules.some((s) => !s.header || !s.rules.length || s.rules.some((r) => !r.trim()))) {
      throw new Error(`Game "${g.id}" has no rules (GameModule.rules, shown under How to Play)`);
    }
    seen.add(g.id);
  }
}
