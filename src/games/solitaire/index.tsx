import type { GameModule } from '../types';
import { RULES } from './rules';
import type { Store } from '../../core/storage';
import { GAME_ID, solSave, solStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { SolitaireHub } from './ui/SolitaireHub';
import { SolitairePlay } from './ui/SolitairePlay';
import { SolitaireIcon } from './ui/SolitaireIcon';

export const solitaire: GameModule = {
  id: GAME_ID,
  name: 'Solitaire',
  tagline: 'Build the four suits from ace to king',
  Icon: SolitaireIcon,
  color: 'linear-gradient(135deg, #1f7a46, #145c34)', // white text ≥ 4.5:1 (5.3:1 / 8.0:1)
  Hub: SolitaireHub,
  rules: RULES,
  stats: solStats,
  resume: {
    store: solSave as Store<unknown>,
    describe() {
      const g = solSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: SolitairePlay,
  },
};
