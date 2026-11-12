import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, fcSave, fcStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { FreeCellHub } from './ui/FreeCellHub';
import { FreeCellPlay } from './ui/FreeCellPlay';
import { FreeCellIcon } from './ui/FreeCellIcon';
import './ui/freecell.css';

export const freecell: GameModule = {
  id: GAME_ID,
  name: 'FreeCell',
  tagline: 'Every card face up, every deal winnable',
  category: 'cards',
  Icon: FreeCellIcon,
  color: 'linear-gradient(135deg, #0f7b8a, #0b5a66)', // white text ≥ 4.5:1
  Hub: FreeCellHub,
  rules: RULES,
  stats: fcStats,
  resume: {
    store: fcSave as Store<unknown>,
    describe() {
      const g = fcSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: FreeCellPlay,
  },
};
