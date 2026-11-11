import { Grid } from './board';
import { grade } from './grader';
import { countSolutions, randomFullGrid } from './solver';
import { Rng, shuffle } from '../../../core/random';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
  /** Grade level actually achieved (1..4). */
  level: number;
}

/**
 * Remove givens in random (symmetric) order while the solution stays unique.
 * Stops when `minClues` is reached or `accept` rejects a removal.
 */
function dig(solution: Grid, rng: Rng, minClues: number, accept?: (g: Grid) => boolean): Grid {
  const puzzle = solution.slice();
  let clues = 81;
  const order = shuffle([...Array(41).keys()], rng); // pairs (i, 80 - i); 40 is the centre
  for (const i of order) {
    const j = 80 - i;
    const removing = i === j ? 1 : 2;
    if (clues - removing < minClues) continue;
    const a = puzzle[i];
    const b = puzzle[j];
    puzzle[i] = 0;
    puzzle[j] = 0;
    if (countSolutions(puzzle, 2) === 1 && (!accept || accept(puzzle))) {
      clues -= removing;
    } else {
      puzzle[i] = a;
      puzzle[j] = b;
    }
  }
  return puzzle;
}

function attempt(difficulty: Difficulty, rng: Rng): Puzzle {
  const solution = randomFullGrid(rng);
  let puzzle: Grid;
  switch (difficulty) {
    case 'easy':
      // Lots of givens, solvable with singles only.
      puzzle = dig(solution, rng, 38, (g) => grade(g, 1).solved);
      break;
    case 'medium':
      // Fewer givens, still singles only (but many hidden singles).
      puzzle = dig(solution, rng, 28, (g) => grade(g, 1).solved);
      break;
    default:
      // Minimal puzzle; graded below.
      puzzle = dig(solution, rng, 17);
  }
  return { puzzle, solution, difficulty, level: grade(puzzle).level };
}

/** Hardest technique level each difficulty should require. Level 4 (needs guessing/chains) is never served. */
const TARGET_LEVEL: Record<Difficulty, number> = { easy: 1, medium: 1, hard: 2, expert: 3 };

function distance(p: Puzzle): number {
  if (p.level === 4) return 10;
  const d = Math.abs(p.level - TARGET_LEVEL[p.difficulty]);
  // Medium should also have clearly fewer givens than easy.
  return p.difficulty === 'medium' && p.puzzle.filter(Boolean).length > 32 ? d + 0.5 : d;
}

/** Generate a puzzle of the requested difficulty. Deterministic for a given rng. */
export function generate(difficulty: Difficulty, rng: Rng, maxAttempts = 400): Puzzle {
  let best: Puzzle | null = null;
  for (let n = 0; n < maxAttempts; n++) {
    const p = attempt(difficulty, rng);
    if (distance(p) === 0) return p;
    if (!best || distance(p) < distance(best)) best = p;
  }
  return best!;
}
