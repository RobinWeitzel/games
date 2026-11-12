import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: ['Clear all 28 cards from the pyramid.', 'Every deal can be won.'],
  },
  {
    header: 'Playing',
    rules: [
      'Remove two cards that add up to 13. Aces count 1, jacks 11, queens 12. A king counts 13 and is removed on its own.',
      'Only free cards can be removed: a card is free when no card lies on it. The top card of the waste pile is free too.',
      'Tap a card to pick it up (it gets an outline), then tap its partner. Tap a king to remove it.',
      'Tap the stock to turn over its next card onto the waste. When the stock is empty, tap it to go through the waste again. You can go through the cards three times.',
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
