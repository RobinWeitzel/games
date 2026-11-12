import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, nkSave, nkStats } from './storage';
import { progress } from './state';
import { MODE_LABEL, prefetch } from './session';
import { NurikabeHub } from './ui/NurikabeHub';
import { NurikabePlay } from './ui/NurikabePlay';
import { NurikabeIcon } from './ui/NurikabeIcon';
import './ui/nurikabe.css';

export const nurikabe: GameModule = {
  id: GAME_ID,
  name: 'Nurikabe',
  tagline: 'Shade a sea around numbered islands',
  Icon: NurikabeIcon,
  color: 'linear-gradient(135deg, #2e6f8e, #1f5068)', // white text ≥ 4.5:1 (5.6:1 / 8.7:1)
  Hub: NurikabeHub,
  rules: RULES,
  stats: nkStats,
  resume: {
    store: nkSave as Store<unknown>,
    describe() {
      const g = nkSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: NurikabePlay,
  },
  prefetch,
};
