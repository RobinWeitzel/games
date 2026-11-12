import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Get four of your discs in a line before the computer does: across, up and down, or diagonally.',
      'Your discs show a ring, the computer’s a cross.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a column to drop a disc into it. It falls to the lowest free place.',
      'You and the computer take turns. Who starts alternates from game to game.',
      'When the board is full and nobody has four in a line, the game is a draw. A draw counts as not won.',
      'Undo takes back your last disc and the computer’s answer. Undos count as assists.',
    ],
  },
  {
    header: 'Levels',
    rules: [
      'Easy sometimes plays at random. Medium looks four moves ahead. Hard looks eight moves ahead.',
      'At every level the computer takes a winning move and blocks yours when it sees one.',
    ],
  },
];
