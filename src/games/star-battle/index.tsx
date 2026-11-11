import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, sbSave, sbStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { StarBattleHub } from './ui/StarBattleHub';
import { StarBattlePlay } from './ui/StarBattlePlay';
import { StarBattleIcon } from './ui/StarBattleIcon';
import './ui/star-battle.css';

export const starBattle: GameModule = {
  id: GAME_ID,
  name: 'Star Battle',
  tagline: 'One star in every row, column and region',
  Icon: StarBattleIcon,
  color: 'linear-gradient(135deg, #b8378a, #8c2468)', // white text ≥ 4.5:1
  Hub: StarBattleHub,
  rules: RULES,
  stats: sbStats,
  resume: {
    store: sbSave as Store<unknown>,
    describe() {
      const g = sbSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: StarBattlePlay,
  },
};
