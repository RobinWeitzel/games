import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Move all 52 cards to the four foundations at the top right: one pile per suit, from ace up to king.',
      'Every card is face up from the start, so it’s all about planning. Every deal can be won.',
    ],
  },
  {
    header: 'The Layout',
    rules: [
      'All cards are dealt into eight columns.',
      'Top left are four free cells. Each one can hold any single card for a while.',
    ],
  },
  {
    header: 'Moving Cards',
    rules: [
      'Move one card at a time: the top card of a column, or a card in a free cell.',
      'In the columns, build down in alternating colours: a red 7 can go on a black 8, a black 7 on a red 8.',
      'Any card can go into an empty column or an empty free cell.',
      'On the foundations, build up by suit: ace, then 2, then 3, up to king.',
      'You can also move an ordered run in one go. That’s the same as moving its cards one by one through the free cells and empty columns, so how many cards can move at once depends on how many are free.',
      'Cards that are no longer needed in the columns go to the foundations by themselves.',
      'Tap a card to move it to the best place it can go: its foundation, a column, or a free cell. Or drag it to the pile you want.',
    ],
  },
  {
    header: 'Tools and Modes',
    rules: [
      'Undo takes back a move. Hint shows a good move. Both count as assists. Finish puts all cards home once every column is in order.',
      'When nothing can move any more, the game is stuck: undo a few moves or deal a new game.',
      'Classic deals a new game every time. The Daily Challenge is the same deal for everyone on a day. Win it every day to build a streak.',
    ],
  },
];
