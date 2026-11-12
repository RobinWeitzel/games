import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Build eight complete runs, each from king down to ace in one suit. A complete run leaves the table by itself.',
      'When all eight runs are complete, you win.',
    ],
  },
  {
    header: 'The Layout',
    rules: [
      'Two decks, 104 cards, are dealt into ten columns. Only the top card of each column is face up.',
      'The other 50 cards are the stock, top right: five deals of ten cards. The completed runs go top left.',
    ],
  },
  {
    header: 'Moving Cards',
    rules: [
      'Any card can go on a card one rank higher, whatever its suit: a 7 on any 8.',
      'Several cards can only move together when they are one suit, in order: 9♠ 8♠ 7♠ moves as one, 9♠ 8♥ doesn’t. So build in one suit whenever you can.',
      'Any card or run can go into an empty column.',
      'When you move the last face-up card off a column, the card below turns over.',
      'Tap a card to move it to the best place it can go (a card of its own suit first), or drag it to the column you want.',
    ],
  },
  {
    header: 'Dealing',
    rules: [
      'Tap the stock or Deal to put one new card on every column. You can only deal when no column is empty.',
      'When the stock is used up and no move helps any more, the game is stuck: undo a few moves or deal a new game. Not every deal can be won, especially with four suits.',
    ],
  },
  {
    header: 'Tools and Modes',
    rules: [
      'Undo takes back a move or a deal. Hint shows a good move. Both count as assists.',
      '1 Suit uses only spades and is the easiest. 2 Suits uses spades and hearts. 4 Suits uses all four and is the hardest.',
    ],
  },
];
