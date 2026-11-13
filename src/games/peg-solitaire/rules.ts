import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Remove pegs until only one is left.',
      'On the cross, the perfect finish leaves the last peg in the centre hole (marked with a ring).',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'A peg jumps over a neighbouring peg into the empty hole right behind it, in a straight line. The peg it jumped over is removed.',
      'On the cross, pegs jump up, down, left and right. On the triangle, also along the two diagonals.',
      'Tap a peg to pick it up (it gets a ring), then tap a hole with a dashed ring to jump there. Or drag the peg to the hole.',
      'When no peg can jump and more than one is left, the game is over: undo to try another way, or start again.',
    ],
  },
  {
    header: 'Tools and Modes',
    rules: [
      'Undo takes back a jump. Hint shows a jump that still leads to a single peg. Both count as assists.',
      'Start Again (the circular arrow next to Pause) sets up the board again. The game you were playing counts as lost.',
      'Cross is the classic 33-hole board, the centre empty at the start. Triangle has 15 holes, the top one empty.',
    ],
  },
];
