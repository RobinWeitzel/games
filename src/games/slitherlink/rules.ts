import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Draw one closed loop along the lines between the dots.',
      'The loop never crosses itself and never branches: at every dot it either passes straight or turns, or doesn’t touch the dot at all.',
      'A number tells how many sides of its cell the loop uses: 0 to 3. Cells without a number can have any.',
      'Every puzzle has exactly one solution, and you can find it by logic.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap between two dots to draw a line. Tap again for a cross (“no line here”), and once more to clear it.',
      'Drag from dot to dot to draw several lines at once. A drag that starts on a line erases instead.',
      'A number fades once it has exactly that many lines (a 0 once its four sides are crossed). A number with too many lines, or too many crosses to still be met, gets a red ring. Lines that branch at a dot turn red there.',
      'Undo takes back a step. Hint fixes a wrong mark or draws one line of the loop. Both count as assists.',
      'Restart (the circular arrow next to Pause) clears the board so you can start the same puzzle over. The timer keeps running, and a restart counts as an undo.',
      'Tip: a 0 means all four sides are crosses, and a 3 in a corner of the grid always uses both outer sides.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Easy is 5 × 5 with many numbers, Medium 7 × 7 and Hard 9 × 9 with fewer. The Daily Challenge is a Medium puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
