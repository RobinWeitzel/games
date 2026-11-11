import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, cdSave, cdStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { CalcudokuHub } from './ui/CalcudokuHub';
import { CalcudokuPlay } from './ui/CalcudokuPlay';
import { CalcudokuIcon } from './ui/CalcudokuIcon';
import './ui/calcudoku.css';

export const calcudoku: GameModule = {
  id: GAME_ID,
  name: 'Calcudoku',
  tagline: 'Sudoku with sums and products',
  Icon: CalcudokuIcon,
  color: 'linear-gradient(135deg, #d0480f, #a3330a)', // white text ≥ 4.5:1
  Hub: CalcudokuHub,
  rules: RULES,
  stats: cdStats,
  resume: {
    store: cdSave as Store<unknown>,
    describe() {
      const g = cdSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: CalcudokuPlay,
  },
};
