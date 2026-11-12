import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, pySave, pyStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { PyramidHub } from './ui/PyramidHub';
import { PyramidPlay } from './ui/PyramidPlay';
import { PyramidIcon } from './ui/PyramidIcon';
import './ui/pyramid.css';

export const pyramid: GameModule = {
  id: GAME_ID,
  name: 'Pyramid',
  tagline: 'Pairs that add up to 13',
  category: 'cards',
  Icon: PyramidIcon,
  color: 'linear-gradient(135deg, #7a2f8a, #5a1f66)', // white text ≥ 4.5:1
  Hub: PyramidHub,
  rules: RULES,
  stats: pyStats,
  resume: {
    store: pySave as Store<unknown>,
    describe() {
      const g = pySave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: PyramidPlay,
  },
};
