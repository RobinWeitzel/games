import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Fill the grid so that every row, every column and every 3 × 3 box holds the numbers 1 to 9 once, as in Sudoku.',
      'No numbers are given. Instead, dashed outlines group the cells into cages, and the small number in a cage’s corner is the sum of its cells.',
      'A number never repeats inside a cage.',
      'Every puzzle has exactly one solution, and you can find it by logic.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a cell, then a number. A wrong number turns red and is underlined, and counts as a mistake. Correct numbers stay.',
      'Notes: switch on Notes to write small candidate numbers into a cell. Placing a number removes it from the notes in its row, column, box and cage.',
      'Undo takes back your last step. Hint fills in a cell: the selected one, or one in the most nearly finished cage. Hints count as assists.',
      'Restart (the circular arrow next to Pause) clears every number and note so you can start the same puzzle over. The timer, mistakes and hints are kept.',
      'Tip: the numbers 1 to 9 add up to 45, so every row, column and box sums to 45.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Easy has small cages of two or three cells, Hard larger ones of up to five. The Daily Challenge is a Medium puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
