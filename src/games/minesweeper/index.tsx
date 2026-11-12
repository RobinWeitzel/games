import type { GameModule } from '../types';
import { RULES } from './rules';
import type { Store } from '../../core/storage';
import { GAME_ID, msSave, msStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { MinesweeperHub } from './ui/MinesweeperHub';
import { MinesweeperPlay } from './ui/MinesweeperPlay';
import { MinesweeperIcon } from './ui/MinesweeperIcon';
import './ui/minesweeper.css';

export const minesweeper: GameModule = {
  id: GAME_ID,
  name: 'Minesweeper',
  tagline: 'Clear the field, avoid the mines',
  category: 'logic',
  Icon: MinesweeperIcon,
  color: 'linear-gradient(135deg, #4a5560, #3a4450)', // white text ≥ 4.5:1 (7.6:1)
  Hub: MinesweeperHub,
  rules: RULES,
  stats: msStats,
  resume: {
    store: msSave as Store<unknown>,
    describe() {
      const g = msSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: MinesweeperPlay,
  },
};
