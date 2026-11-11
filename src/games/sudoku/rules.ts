import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Fill the 9×9 grid so that every row, every column and every 3×3 box contains each number from 1 to 9 exactly once.',
      'Some numbers are given at the start. They can’t be changed. Every puzzle has exactly one solution and can be solved by logic, without guessing.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a cell, then tap a number to place it. Erase clears the cell.',
      'A wrong number is shown in red and underlined, and counts as a mistake.',
      'Touch and hold a number to lock it. Then every cell you tap gets that number. Tap the number again to stop.',
      'A finished row, column or box flashes. The puzzle is solved when every cell is filled correctly.',
    ],
  },
  {
    header: 'Tools',
    rules: [
      'Notes: numbers you tap become small pencil marks instead, so you can keep track of candidates.',
      'Auto notes fills in every possible candidate for all empty cells.',
      'Autofill: while it’s on, any cell left with a single note is filled in for you.',
      'Undo takes back your last move. Hint fills in a correct number and counts as an assist.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Easy, Medium, Hard and Expert differ in how many numbers are given and which solving techniques are needed.',
      'The Daily Challenge is the same puzzle for everyone on a day. Solve it every day to build a streak.',
      'With the mistake limit (Settings), the game is over after 3 mistakes. Games with hints never count as best times.',
    ],
  },
];
