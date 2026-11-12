import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, luSave, luStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { LightUpHub } from './ui/LightUpHub';
import { LightUpPlay } from './ui/LightUpPlay';
import { LightUpIcon } from './ui/LightUpIcon';
import './ui/light-up.css';

export const lightUp: GameModule = {
  id: GAME_ID,
  name: 'Light Up',
  tagline: 'Light every cell, bulbs can’t see each other',
  category: 'logic',
  Icon: LightUpIcon,
  color: 'linear-gradient(135deg, #b5650a, #8a4a05)', // white text ≥ 4.5:1
  Hub: LightUpHub,
  rules: RULES,
  stats: luStats,
  resume: {
    store: luSave as Store<unknown>,
    describe() {
      const g = luSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: LightUpPlay,
  },
};
