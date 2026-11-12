import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Put the numbered tiles in order, 1 in the top left corner, row by row, with the empty space last.',
      'Every arrangement you get can be solved.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a tile next to the empty space to slide it in.',
      'Tap a tile further away in the same row or column to slide it and all tiles between at once.',
      'A tile in its final place gets a thick frame.',
      'Undo slides the last move back. Undos count as assists. Each tile moved counts as one move.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      '3 × 3 has 8 tiles, 4 × 4 the classic 15, 5 × 5 has 24. The Daily Challenge is a 4 × 4 puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
