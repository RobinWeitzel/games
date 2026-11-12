import type { GameRules } from '../../ui/game/rules';

export const RULES: GameRules = [
  {
    header: 'Goal',
    rules: [
      'Shade cells to make a sea around islands of white cells.',
      'Every number is part of one island, and the island has exactly that many cells. Each island has exactly one number.',
      'All shaded cells form one connected sea: you can walk from any shaded cell to any other through shaded cells, up, down, left or right.',
      'The sea has no pools: no 2 × 2 block may be all shaded.',
      'Every puzzle has exactly one solution, and you can find it by logic.',
    ],
  },
  {
    header: 'Playing',
    rules: [
      'Tap a cell to shade it. Tap again to mark it with a dot (“part of an island”), and once more to clear it.',
      'Drag across cells to give them all what the first cell got.',
      'A finished island’s number fades. A number whose island is too big, touches another number or has too little room gets a red ring. A 2 × 2 pool turns red with stripes.',
      'Undo takes back a step. Hint fixes a wrong mark or shades one cell. Both count as assists.',
      'Tip: cells between two numbers are always sea, and so are cells too far from every number.',
    ],
  },
  {
    header: 'Modes',
    rules: [
      'Easy is 6 × 6, Medium 8 × 8 and Hard 10 × 10. The Daily Challenge is a Medium puzzle, the same for everyone on a day. Solve it every day to build a streak.',
    ],
  },
];
