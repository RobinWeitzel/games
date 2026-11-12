import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, rvSave, rvStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { ReversiHub } from './ui/ReversiHub';
import { ReversiPlay } from './ui/ReversiPlay';
import { ReversiIcon } from './ui/ReversiIcon';
import './ui/reversi.css';

export const reversi: GameModule = {
  id: GAME_ID,
  name: 'Reversi',
  tagline: 'Close in the discs, turn them over',
  Icon: ReversiIcon,
  color: 'linear-gradient(135deg, #2b6b3f, #1b4a2a)', // white text ≥ 4.5:1
  Hub: ReversiHub,
  rules: RULES,
  stats: rvStats,
  resume: {
    store: rvSave as Store<unknown>,
    describe() {
      const g = rvSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: ReversiPlay,
  },
};
