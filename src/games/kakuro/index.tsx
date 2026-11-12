import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, kkSave, kkStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { KakuroHub } from './ui/KakuroHub';
import { KakuroPlay } from './ui/KakuroPlay';
import { KakuroIcon } from './ui/KakuroIcon';
import './ui/kakuro.css';

export const kakuro: GameModule = {
  id: GAME_ID,
  name: 'Kakuro',
  tagline: 'Cross sums: no number twice in a run',
  Icon: KakuroIcon,
  color: 'linear-gradient(135deg, #b03a2e, #85291f)', // white text ≥ 4.5:1 (6.0:1 / 9.0:1)
  Hub: KakuroHub,
  rules: RULES,
  stats: kkStats,
  resume: {
    store: kkSave as Store<unknown>,
    describe() {
      const g = kkSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: KakuroPlay,
  },
};
