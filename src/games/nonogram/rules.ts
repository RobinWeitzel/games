import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Fill in the right cells of the grid to reveal a hidden picture.',
      'Every puzzle has exactly one solution and can be solved one row or column at a time, without guessing.',
    ],
  },
  {
    header: 'Reading the Clues',
    rules: [
      'The numbers next to each row and above each column list the runs of filled cells in that line, in order.',
      'For example, “3 1” means a run of 3 filled cells, then at least one empty cell, then a single filled cell.',
      'A line’s clue is struck through when the line matches it.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a cell to fill it, or drag along a row or column to fill several. Tap a filled cell to clear it.',
      'Cross: mark cells you know are empty with a ×. Crosses are only notes for you: they don’t count towards the solution.',
      'Mistakes aren’t pointed out while you play. The puzzle is solved as soon as the filled cells match every clue.',
      'Undo takes back your last stroke. Hint fixes a wrong mark, or marks a cell that follows from the clues, and counts as an assist.',
      'Restart (the circular arrow next to Pause) clears the grid so you can start the same picture over. The timer and hints are kept.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Grids of 5 × 5, 10 × 10 and 15 × 15.',
      'The Daily Challenge is the same 10 × 10 picture for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
