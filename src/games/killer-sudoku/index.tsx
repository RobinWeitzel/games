import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, ksSave, ksStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { KillerHub } from './ui/KillerHub';
import { KillerPlay } from './ui/KillerPlay';
import { KillerIcon } from './ui/KillerIcon';
import './ui/killer.css';

export const killerSudoku: GameModule = {
  id: GAME_ID,
  name: 'Killer Sudoku',
  tagline: 'Sudoku with cage sums, no givens',
  category: 'numbers',
  Icon: KillerIcon,
  color: 'linear-gradient(135deg, #5b5bd6, #3e3eb0)', // white text ≥ 4.5:1
  Hub: KillerHub,
  rules: RULES,
  stats: ksStats,
  resume: {
    store: ksSave as Store<unknown>,
    describe() {
      const g = ksSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: KillerPlay,
  },
};
