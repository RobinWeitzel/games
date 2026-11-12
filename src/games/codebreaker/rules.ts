import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Find the hidden code: a row of 4 symbols chosen from 6 (or 5 from 8 in the harder mode). A symbol can appear more than once.',
      'You have 10 guesses.',
    ],
  },
  {
    header: 'Guessing',
    rules: [
      'Tap symbols to fill your guess, then tap Check. Tap a symbol in your guess, or Delete, to take it out again.',
      'After each guess you see how close it was. A filled dot: a symbol in the right place. A ring: a symbol that is in the code, but in another place. A dash: no match.',
      'The marks don’t say which symbols they belong to; that’s the puzzle.',
      'Each symbol of the code counts only once: if the code has one heart and you guess two, only one of them can score.',
    ],
  },
  {
    header: 'Tools and Modes',
    rules: [
      'Hint reveals one symbol of the code and keeps it in place for your next guesses. Hints count as assists; the last symbol is always yours to find.',
      '4 of 6 is the classic game. 5 of 8 has a longer code and more symbols. The Daily Challenge is a 4 of 6 code, the same for everyone on a day. Crack it every day to build a streak.',
    ],
  },
];
