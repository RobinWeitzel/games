import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Have more discs of your colour on the board than the computer when the game ends.',
      'Your discs are dark with a ring, the computer’s are light with a cross.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Place a disc so that it closes in one or more lines of the computer’s discs between your new disc and another of yours: across, up and down, or diagonally.',
      'All the discs you close in turn over to your colour. A move must turn over at least one disc; the places you can play are marked with dots.',
      'If one player can’t move, the other plays again. When neither can move, the game ends and the discs are counted. Equal counts are a draw, which counts as not won.',
      'Who starts alternates from game to game.',
      'Undo takes you back to before your last move. Undos count as assists.',
    ],
  },
  {
    header: 'Levels',
    rules: ['Easy looks only at its next move and sometimes plays at random. Medium looks three moves ahead, Hard five, and both value corners and edges.'],
  },
];
