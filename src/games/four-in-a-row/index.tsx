import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, frSave, frStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { FourHub } from './ui/FourHub';
import { FourPlay } from './ui/FourPlay';
import { FourIcon } from './ui/FourIcon';
import './ui/four-in-a-row.css';

export const fourInARow: GameModule = {
  id: GAME_ID,
  name: 'Four in a Row',
  tagline: 'Drop discs, line up four',
  Icon: FourIcon,
  color: 'linear-gradient(135deg, #1b5fbf, #123f80)', // white text ≥ 4.5:1
  Hub: FourHub,
  rules: RULES,
  stats: frStats,
  resume: {
    store: frSave as Store<unknown>,
    describe() {
      const g = frSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: FourPlay,
  },
};
