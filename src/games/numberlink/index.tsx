import type { GameModule } from '../types';
import type { Store } from '../../core/storage';
import { RULES } from './rules';
import { GAME_ID, nlSave, nlStats } from './storage';
import { progress } from './state';
import { MODE_LABEL } from './session';
import { NumberlinkHub } from './ui/NumberlinkHub';
import { NumberlinkPlay } from './ui/NumberlinkPlay';
import { NumberlinkIcon } from './ui/NumberlinkIcon';
import './ui/numberlink.css';

export const numberlink: GameModule = {
  id: GAME_ID,
  name: 'Numberlink',
  tagline: 'Join the pairs, fill the grid',
  category: 'logic',
  Icon: NumberlinkIcon,
  color: 'linear-gradient(135deg, #00727a, #00525a)', // white text ≥ 4.5:1
  Hub: NumberlinkHub,
  rules: RULES,
  stats: nlStats,
  resume: {
    store: nlSave as Store<unknown>,
    describe() {
      const g = nlSave.get();
      if (!g || g.status !== 'playing') return null;
      return { label: MODE_LABEL[g.mode], progress: progress(g) };
    },
    Screen: NumberlinkPlay,
  },
};
