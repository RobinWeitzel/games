import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, dbSave, dbStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { DotsHub } from './ui/DotsHub';
import { DotsPlay } from './ui/DotsPlay';
import { DotsIcon } from './ui/DotsIcon';
import './ui/dots-and-boxes.css';

export const dotsAndBoxes: GameModule = {
  id: GAME_ID,
  name: 'Dots and Boxes',
  tagline: 'Draw lines, close boxes',
  category: 'board',
  Icon: DotsIcon,
  color: 'linear-gradient(135deg, #b4304f, #8a2038)', // white text ≥ 4.5:1
  Hub: DotsHub,
  rules: RULES,
  stats: dbStats,
  resume: {
    store: dbSave as Store<unknown>,
    describe() {
      const g = dbSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: DotsPlay,
  },
};
