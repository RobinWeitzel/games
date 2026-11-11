import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Reach the three-digit target exactly, using the six numbers you’re given and + − × ÷.',
      'Every target can be reached. You don’t have to use all six numbers.',
    ],
  },
  {
    header: 'The Numbers',
    rules: [
      'First choose how many large numbers you want, from 0 to 4. Large numbers are 25, 50, 75 and 100. The rest are small numbers from 1 to 10.',
      'Then six numbers are drawn and the target appears, somewhere from 101 to 999.',
    ],
  },
  {
    header: 'Calculating',
    rules: [
      'Tap a number, an operation, then a second number. The two numbers are replaced by the result, which you can keep calculating with.',
      'Each number can be used only once. Results are always whole numbers: a division has to come out even, and a subtraction can’t give zero.',
      'Undo takes back your last calculation. Reset starts over with the six numbers. Hint suggests a next step and counts as an assist.',
      'Give Up ends the game as lost and shows a solution.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Relaxed: take as long as you need.',
      'Timed: you have 30 seconds to hit the target.',
      'The Daily Challenge deals the same numbers to everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
