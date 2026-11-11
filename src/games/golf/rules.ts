import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: ['Clear all 35 cards from the seven columns onto the waste pile.', 'Every deal can be won.'],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a column to put its top card on the waste pile at the bottom.',
      'It must be one rank higher or lower than the waste card, whatever the suit: a 7 goes on a 6 or an 8. King and ace are not next to each other, so only a queen goes on a king and only a 2 on an ace.',
      'When nothing fits, tap the stock to turn over a new waste card. The stock is used once; when it is empty and nothing fits, the game is stuck.',
      'Your streak counts the cards you play in a row without turning over the stock.',
    ],
  },
  {
    header: 'Tools and Modes',
    rules: [
      'Undo takes back a move. Hint shows a good move. Both count as assists.',
      'Classic deals a new game every time. The Daily Challenge is the same deal for everyone on a day. Win it every day to build a streak.',
    ],
  },
];
