import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, spSave, spStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { SpiderHub } from './ui/SpiderHub';
import { SpiderPlay } from './ui/SpiderPlay';
import { SpiderIcon } from './ui/SpiderIcon';
import './ui/spider.css';

export const spider: GameModule = {
  id: GAME_ID,
  name: 'Spider',
  tagline: 'Build eight runs from king to ace',
  category: 'cards',
  Icon: SpiderIcon,
  color: 'linear-gradient(135deg, #6e4fc4, #4b2f99)', // white text ≥ 4.5:1
  Hub: SpiderHub,
  rules: RULES,
  stats: spStats,
  resume: {
    store: spSave as Store<unknown>,
    describe() {
      const g = spSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: SpiderPlay,
  },
};
