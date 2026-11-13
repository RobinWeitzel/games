import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Place stars so that every row, every column and every region has exactly one star. On the 10 × 10 grid, it’s two stars each.',
      'Stars may never touch each other, not even diagonally.',
      'Regions are the shapes outlined with thick lines (each also has its own tint).',
      'Every puzzle has exactly one solution, and you can find it by logic.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a cell once to mark it with a cross (“no star here”), twice for a star, and a third time to clear it.',
      'Drag across cells to cross out several at once.',
      'A star that breaks a rule turns red with a ring around it, and the line below the board says why.',
      'Undo takes back a step. Hint places or fixes one star. Both count as assists.',
      'Restart (the circular arrow next to Pause) clears the board so you can start the same puzzle over. The timer keeps running, and a restart counts as an undo.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      '6 × 6 and 8 × 8 have one star per row, column and region. 10 × 10 has two. The Daily Challenge is an 8 × 8 puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
