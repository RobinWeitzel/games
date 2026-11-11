import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { GAME_ID, ngSave, ngStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { NonogramHub } from './ui/NonogramHub';
import { NonogramPlay } from './ui/NonogramPlay';
import { NonogramIcon } from './ui/NonogramIcon';
import './ui/nonogram.css';

export const nonogram: GameModule = {
  id: GAME_ID,
  name: 'Nonogram',
  tagline: 'Fill the grid, reveal the picture',
  Icon: NonogramIcon,
  color: 'linear-gradient(135deg, #c2185b, #8e1450)',
  Hub: NonogramHub,
  stats: ngStats,
  resume: {
    store: ngSave as Store<unknown>,
    describe() {
      const g = ngSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: NonogramPlay,
  },
};
