import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Open every cell that doesn’t hide a mine. If you open a mine, the game is lost.',
      'Your first tap is always safe, and every board can be cleared by logic alone, without guessing.',
    ],
  },
  {
    header: 'Reading the Board',
    rules: [
      'An open cell’s number tells you how many of its eight neighbours (including diagonals) are mines.',
      'An open cell without a number has no mines around it, so its neighbours open automatically.',
      'The counter at the top shows the mines minus the flags you’ve placed.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a cell to open it. Touch and hold a cell to put a flag on it, where you’re sure a mine is.',
      'Flag mode: while the Flag tool is on, a tap flags and touch and hold opens.',
      'Tap an open number that already has that many flags around it to open all its other neighbours at once. A wrong flag means you open a mine.',
      'Hint opens a cell that is safe and counts as an assist.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Easy: 8 × 10 with 10 mines. Medium: 8 × 16 with 20 mines. Hard: 8 × 24 with 40 mines. Taller boards scroll.',
      'The Daily Challenge is the same board for everyone on a day and starts with an open area. Clear it every day to build a streak.',
    ],
  },
];
