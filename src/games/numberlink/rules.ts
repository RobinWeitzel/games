import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Join every pair of equal numbers with a path.',
      'Paths go from cell to neighbouring cell (up, down, left, right). They can’t cross, branch or run through a number.',
      'When all pairs are joined and every cell is part of a path, you win. Any solution that does this counts.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Drag from a number to draw its path. Drag back along the path to shorten it.',
      'Drawing over another path cuts that path at the crossing.',
      'Drag from the end of a path to carry on, or from a number to start that pair again. Tap a number to clear its path.',
      'You can also draw by tapping: tap a number, then the neighbouring cells one by one.',
      'The two numbers of a joined pair get a ring.',
    ],
  },
  {
    header: 'Tools and Modes',
    rules: [
      'Undo takes back a step. Hint draws one pair’s path, cutting paths in its way. Both count as assists.',
      '5 × 5, 7 × 7 and 9 × 9 grids, with more pairs on bigger grids. The Daily Challenge is a 7 × 7 puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
