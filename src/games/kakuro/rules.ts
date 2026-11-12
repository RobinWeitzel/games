import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Fill every white cell with a number from 1 to 9.',
      'White cells form runs: unbroken lines of cells across or down. The black cell before a run holds its sum: the number above the diagonal line is the sum of the run to its right, the number below the line the sum of the run beneath it.',
      'The numbers in a run add up to its sum, and no number appears twice in a run.',
      'Every puzzle has exactly one solution, and you can find it by logic.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a white cell, then a number. A wrong number turns red and is underlined, and counts as a mistake. Correct numbers stay.',
      'The line under the tools shows the sums of the selected cell’s runs, and those sums are shown as light labels on their black cells. The cells of those runs are highlighted.',
      'Notes: switch on Notes to write small candidate numbers into a cell. Placing a number removes it from the notes in its runs.',
      'Undo takes back your last step. Hint fills in a cell: the selected one, or one in the runs closest to finished. Hints count as assists.',
      'Tip: some sums can only be made one way. Two cells adding up to 3 are always 1 and 2, and two cells adding up to 17 are always 8 and 9.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Easy is 5 × 5 white cells with short runs, Medium 7 × 7, Hard 8 × 8 with longer runs. The Daily Challenge is a Medium puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
