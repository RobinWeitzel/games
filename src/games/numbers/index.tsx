import type { GameModule } from '../types';
import { RULES } from './rules';
import type { Store } from '../../core/storage';
import { GAME_ID, numbersSave, numbersStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { NumbersHub } from './ui/NumbersHub';
import { NumbersPlay } from './ui/NumbersPlay';
import { NumbersIcon } from './ui/NumbersIcon';
import './ui/numbers.css';

export const numbers: GameModule = {
  id: GAME_ID,
  name: 'Numbers',
  tagline: 'Hit the target with six numbers',
  Icon: NumbersIcon,
  color: 'linear-gradient(135deg, #00727a, #00666d)', // white text ≥ 4.5:1
  Hub: NumbersHub,
  rules: RULES,
  stats: numbersStats,
  resume: {
    store: numbersSave as Store<unknown>,
    describe() {
      const g = numbersSave.get();
      if (!g || (g.status !== 'playing' && g.status !== 'picking')) return null;
      return { label: g.status === 'picking' ? MODE_LABEL[g.mode] : `${MODE_LABEL[g.mode]} · Target ${g.target}`, progress: progress(g) };
    },
    Screen: NumbersPlay,
  },
};
