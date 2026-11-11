import type { GameModule } from '../types';
import { savedGame, sudokuStats, GAME_ID } from './storage';
import { progress } from './state';
import { prefetchAll } from './puzzles';
import { SudokuHub } from './ui/SudokuHub';
import { SudokuPlay } from './ui/SudokuPlay';
import { SudokuIcon } from './ui/SudokuIcon';
import { SudokuSettings } from './ui/SudokuSettings';
import { DIFFICULTY_LABEL } from './ui/labels';
import type { Store } from '../../core/storage';
import './ui/sudoku.css';

export const sudoku: GameModule = {
  id: GAME_ID,
  name: 'Sudoku',
  tagline: 'Classic 9×9 number puzzle',
  Icon: SudokuIcon,
  color: 'linear-gradient(135deg, #5e5ce6, #7d7aff)',
  Hub: SudokuHub,
  stats: sudokuStats,
  resume: {
    store: savedGame as Store<unknown>,
    describe() {
      const g = savedGame.get();
      if (!g || g.status !== 'playing') return null;
      const label = g.mode === 'daily' ? `Daily · ${DIFFICULTY_LABEL[g.difficulty]}` : DIFFICULTY_LABEL[g.difficulty];
      return { label, progress: progress(g) };
    },
    Screen: SudokuPlay,
  },
  SettingsSection: SudokuSettings,
  prefetch: prefetchAll,
};
