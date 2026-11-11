import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Win more boxes than the computer.',
      'Your boxes show a ring, the computer’s a cross.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Take turns drawing one line between two neighbouring dots. Tap near the line you want.',
      'Whoever draws the fourth side of a box wins it, and must then draw another line.',
      'Avoid drawing the third side of a box: the other player can then take it. Late in the game, every line gives something away, and the art is to give away as little as possible.',
      'When all lines are drawn, the one with more boxes wins. Equal counts are a draw, which counts as not won.',
      'Who starts alternates from game to game. Undo takes back your last line and the computer’s answer. Undos count as assists.',
    ],
  },
  {
    header: 'Levels',
    rules: [
      'Easy is a 3 × 3 board against a computer that sometimes misses a box. Medium is 4 × 4: the computer takes every box and gives away as little as it can. Hard is 5 × 5, and near the end the computer plays perfectly.',
    ],
  },
];
