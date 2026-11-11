import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Move all 52 cards to the four foundations at the top: one pile per suit, from ace up to king.',
      'Every deal can be won.',
    ],
  },
  {
    header: 'The Layout',
    rules: [
      'Seven columns are dealt, with one to seven cards each. Only the top card of each column is face up.',
      'The rest of the deck is the stock, top left. Tap it to turn cards over onto the waste next to it. When the stock is empty, tap it to turn the waste back over and go through it again, as often as you like.',
    ],
  },
  {
    header: 'Moving Cards',
    rules: [
      'In the columns, build down in alternating colours: a red 7 can go on a black 8, a black 7 on a red 8.',
      'You can move a single face-up card or a whole face-up run. When you move the last face-up card off a column, the card below turns over.',
      'Only a king, or a run starting with a king, can go into an empty column.',
      'On the foundations, build up by suit: ace, then 2, then 3, up to king. The top card of a foundation can be moved back to a column.',
      'Tap a card to move it to the best place it can go, or drag it to the pile you want.',
    ],
  },
  {
    header: 'Tools and Modes',
    rules: [
      'Undo takes back a move. Hint shows a good move. Both count as assists. Finish puts all cards home once everything is face up.',
      'Draw 1 turns over one card at a time. Draw 3 turns over three, and only the top one can be played.',
      'The Daily Challenge is the same Draw 1 deal for everyone on a day. Win it every day to build a streak.',
    ],
  },
];
