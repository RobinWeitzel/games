import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, pgSave, pgStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { PegHub } from './ui/PegHub';
import { PegPlay } from './ui/PegPlay';
import { PegIcon } from './ui/PegIcon';
import './ui/peg-solitaire.css';

export const pegSolitaire: GameModule = {
  id: GAME_ID,
  name: 'Peg Solitaire',
  tagline: 'Jump pegs until one is left',
  Icon: PegIcon,
  color: 'linear-gradient(135deg, #6d4c9f, #4e3478)', // white text ≥ 4.5:1
  Hub: PegHub,
  rules: RULES,
  stats: pgStats,
  resume: {
    store: pgSave as Store<unknown>,
    describe() {
      const g = pgSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: PegPlay,
  },
};
