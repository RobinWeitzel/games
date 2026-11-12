import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, cbSave, cbStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { CodebreakerHub } from './ui/CodebreakerHub';
import { CodebreakerPlay } from './ui/CodebreakerPlay';
import { CodebreakerIcon } from './ui/CodebreakerIcon';
import './ui/codebreaker.css';

export const codebreaker: GameModule = {
  id: GAME_ID,
  name: 'Codebreaker',
  tagline: 'Crack the hidden code',
  category: 'board',
  Icon: CodebreakerIcon,
  color: 'linear-gradient(135deg, #3a3a8c, #26266b)', // white text ≥ 4.5:1
  Hub: CodebreakerHub,
  rules: RULES,
  stats: cbStats,
  resume: {
    store: cbSave as Store<unknown>,
    describe() {
      const g = cbSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: CodebreakerPlay,
  },
};
