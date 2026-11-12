import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, tpSave, tpStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { TriPeaksHub } from './ui/TriPeaksHub';
import { TriPeaksPlay } from './ui/TriPeaksPlay';
import { TriPeaksIcon } from './ui/TriPeaksIcon';
import './ui/tripeaks.css';

export const tripeaks: GameModule = {
  id: GAME_ID,
  name: 'TriPeaks',
  tagline: 'One up or one down, clear the peaks',
  Icon: TriPeaksIcon,
  color: 'linear-gradient(135deg, #2f7d32, #1f5c22)', // white text ≥ 4.5:1
  Hub: TriPeaksHub,
  rules: RULES,
  stats: tpStats,
  resume: {
    store: tpSave as Store<unknown>,
    describe() {
      const g = tpSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: TriPeaksPlay,
  },
};
