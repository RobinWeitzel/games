import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Connect the islands with bridges so that each island has exactly as many bridges as its number.',
      'In the end, all islands must be connected: you can walk from any island to any other over bridges.',
      'Every puzzle has exactly one solution.',
    ],
  },
  {
    header: 'Bridges',
    rules: [
      'Bridges run straight across, horizontally or vertically, between two islands that see each other.',
      'Two islands can be joined by one or two bridges, never more.',
      'Bridges can’t cross other bridges or islands.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap the water between two islands to build a bridge. Tap again for a second bridge, and once more to take both away.',
      'Or drag from an island towards a neighbour to do the same.',
      'An island with all its bridges turns solid. An island with too many is drawn with a dashed red ring.',
      'Undo takes back a step. Hint fixes or builds one bridge. Both count as assists.',
      'Restart (the circular arrow next to Pause) clears the board so you can start the same puzzle over. The timer keeps running, and a restart counts as an undo.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Easy is a 7 × 7 grid, Medium 9 × 9, Hard 11 × 11. The Daily Challenge is a 9 × 9 puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
