import type { GameModule } from '../types';
import { RULES } from './rules';
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
  category: 'numbers',
  Icon: SudokuIcon,
  color: 'linear-gradient(135deg, #4b49c9, #5856d6)', // white text ≥ 4.5:1
  Hub: SudokuHub,
  rules: RULES,
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
