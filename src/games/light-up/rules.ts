import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Place light bulbs in the white cells so that every white cell is lit.',
      'A bulb lights its own cell and shines along its row and column in all four directions, until a black cell stops the light.',
      'No bulb may shine on another bulb.',
      'A black cell with a number touches exactly that many bulbs on its four sides. Black cells without a number can touch any number of bulbs.',
      'Every puzzle has exactly one solution, and you can find it by logic.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a white cell for a bulb. Tap again to mark it with a dot (“no bulb here”), and once more to clear it.',
      'Drag across white cells to dot several at once.',
      'Lit cells turn yellow with fine stripes. Two bulbs that light each other turn red. A number with too many bulbs gets a red ring; a number with exactly enough fades.',
      'Undo takes back a step. Hint places or fixes one bulb. Both count as assists.',
      'Restart (the circular arrow next to Pause) clears the board so you can start the same puzzle over. The timer keeps running, and a restart counts as an undo.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Easy is 7 × 7 with many numbers. Medium and Hard are 10 × 10, Hard with the fewest numbers. The Daily Challenge is a Medium puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
