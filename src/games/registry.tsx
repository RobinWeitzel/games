import { FunctionComponent, VNode } from 'preact';
import { SudokuHome } from './sudoku/ui/SudokuHome';
import { SudokuPlay } from './sudoku/ui/SudokuPlay';
import { SudokuIcon } from './sudoku/ui/SudokuIcon';
import { savedGame } from './sudoku/saved';
import { progress } from './sudoku/state';
import { Store } from '../core/store';
import { DIFFICULTY_LABEL } from './sudoku/ui/labels';

export interface GameDef {
  id: string;
  name: string;
  tagline: string;
  Icon: FunctionComponent<{ size?: number }>;
  /** Tile gradient. */
  color: string;
  /** Screen pushed when the tile is tapped. */
  home: () => VNode;
  /** Stats modes in display order. */
  modes: { id: string; label: string }[];
  /** For the "Continue" card on the home screen. */
  saved?: {
    store: Store<unknown>;
    describe: () => { label: string; progress: number } | null;
    resume: () => VNode;
  };
}

export const GAMES: GameDef[] = [
  {
    id: 'sudoku',
    name: 'Sudoku',
    tagline: 'Classic 9×9 number puzzle',
    Icon: SudokuIcon,
    color: 'linear-gradient(135deg, #5e5ce6, #7d7aff)',
    home: () => <SudokuHome />,
    modes: [
      { id: 'easy', label: 'Easy' },
      { id: 'medium', label: 'Medium' },
      { id: 'hard', label: 'Hard' },
      { id: 'expert', label: 'Expert' },
      { id: 'daily', label: 'Daily' },
    ],
    saved: {
      store: savedGame as Store<unknown>,
      describe: () => {
        const g = savedGame.get();
        if (!g || g.status !== 'playing') return null;
        const label = g.mode === 'daily' ? `Daily · ${DIFFICULTY_LABEL[g.difficulty]}` : DIFFICULTY_LABEL[g.difficulty];
        return { label, progress: progress(g) };
      },
      resume: () => <SudokuPlay />,
    },
  },
];
