import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, brSave, brStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { BridgesHub } from './ui/BridgesHub';
import { BridgesPlay } from './ui/BridgesPlay';
import { BridgesIcon } from './ui/BridgesIcon';
import './ui/bridges.css';

export const bridges: GameModule = {
  id: GAME_ID,
  name: 'Bridges',
  tagline: 'Connect every island',
  category: 'logic',
  Icon: BridgesIcon,
  color: 'linear-gradient(135deg, #1f78c8, #155a99)', // white text ≥ 4.5:1
  Hub: BridgesHub,
  rules: RULES,
  stats: brStats,
  resume: {
    store: brSave as Store<unknown>,
    describe() {
      const g = brSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: BridgesPlay,
  },
};
