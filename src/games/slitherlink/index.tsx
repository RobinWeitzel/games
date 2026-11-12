import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, slSave, slStats } from './storage';
import { progress } from './state';
import { MODE_LABEL, prefetch } from './session';
import { SlitherlinkHub } from './ui/SlitherlinkHub';
import { SlitherlinkPlay } from './ui/SlitherlinkPlay';
import { SlitherlinkIcon } from './ui/SlitherlinkIcon';
import './ui/slitherlink.css';

export const slitherlink: GameModule = {
  id: GAME_ID,
  name: 'Slitherlink',
  tagline: 'Draw one loop around the numbers',
  category: 'logic',
  Icon: SlitherlinkIcon,
  color: 'linear-gradient(135deg, #5c6b1f, #434f12)', // white text ≥ 4.5:1 (5.9:1 / 8.9:1)
  Hub: SlitherlinkHub,
  rules: RULES,
  stats: slStats,
  resume: {
    store: slSave as Store<unknown>,
    describe() {
      const g = slSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: SlitherlinkPlay,
  },
  prefetch,
};
