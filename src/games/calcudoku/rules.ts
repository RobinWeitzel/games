import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Fill the grid so that every row and every column holds each number once: 1 to 4 on a 4 × 4 grid, 1 to 6 on a 6 × 6 grid, and so on.',
      'Every puzzle has exactly one solution, and you can always find it by logic.',
    ],
  },
  {
    header: 'Cages',
    rules: [
      'The thick lines split the grid into cages. The label in a cage’s corner gives a target and how to reach it.',
      '“12+”: the numbers in the cage add up to 12. “60×”: they multiply to 60.',
      '“2−”: the larger of the two numbers minus the smaller is 2. “3÷”: the larger divided by the smaller is 3.',
      'A cage with just a number is that number.',
      'A number can repeat inside a cage, as long as it isn’t twice in the same row or column.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a cell, then a number. A wrong number turns red and is underlined, and counts as a mistake. Correct numbers stay.',
      'Notes: switch on Notes to write small candidate numbers into a cell. Placing a number removes it from the notes in its row and column.',
      'Undo takes back your last step. Hint fills in a cell: the selected one, or one in the smallest open cage. Hints count as assists.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      '4 × 4 is a quick warm-up, 7 × 7 a long think. The Daily Challenge is a 6 × 6 puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
