import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, slSave, slStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { SlideHub } from './ui/SlideHub';
import { SlidePlay } from './ui/SlidePlay';
import { SlideIcon } from './ui/SlideIcon';
import './ui/sliding-puzzle.css';

export const slidingPuzzle: GameModule = {
  id: GAME_ID,
  name: 'Sliding Puzzle',
  tagline: 'Slide the tiles into order',
  category: 'board',
  Icon: SlideIcon,
  color: 'linear-gradient(135deg, #a8550f, #7f3f0a)', // white text ≥ 4.5:1
  Hub: SlideHub,
  rules: RULES,
  stats: slStats,
  resume: {
    store: slSave as Store<unknown>,
    describe() {
      const g = slSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: SlidePlay,
  },
};
