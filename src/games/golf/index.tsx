import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, gfSave, gfStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { GolfHub } from './ui/GolfHub';
import { GolfPlay } from './ui/GolfPlay';
import { GolfIcon } from './ui/GolfIcon';
import './ui/golf.css';

export const golf: GameModule = {
  id: GAME_ID,
  name: 'Golf',
  tagline: 'Clear the columns, one up or one down',
  Icon: GolfIcon,
  color: 'linear-gradient(135deg, #8a6d1f, #6b5214)', // white text ≥ 4.5:1
  Hub: GolfHub,
  rules: RULES,
  stats: gfStats,
  resume: {
    store: gfSave as Store<unknown>,
    describe() {
      const g = gfSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: GolfPlay,
  },
};
