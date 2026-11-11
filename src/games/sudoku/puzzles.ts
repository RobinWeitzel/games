import { load, save } from '../../core/storage';
import { hashString, randomSeed } from '../../core/random';
import { todayKey } from '../../core/daily';
import type { Difficulty } from './engine/generator';
import type { WorkerRequest } from './engine/worker';

export interface StoredPuzzle {
  puzzle: number[];
  solution: number[];
}

type Pool = Partial<Record<Difficulty, StoredPuzzle[]>>;
const POOL_KEY = 'sudoku:pool';
const DAILY_KEY = 'sudoku:daily-cache';
const POOL_SIZE = 2;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (p: StoredPuzzle) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, puzzle, solution } = e.data;
      pending.get(id)?.({ puzzle, solution });
      pending.delete(id);
    };
  }
  return worker;
}

function generateInWorker(difficulty: Difficulty, seed: number): Promise<StoredPuzzle> {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    const req: WorkerRequest = { id, difficulty, seed };
    getWorker().postMessage(req);
  });
}

const filling = new Set<Difficulty>();

/** Top up the pool in the background so "New game" is instant. */
export async function refillPool(difficulty: Difficulty): Promise<void> {
  if (filling.has(difficulty)) return;
  filling.add(difficulty);
  try {
    while ((load<Pool>(POOL_KEY, {})[difficulty]?.length ?? 0) < POOL_SIZE) {
      const p = await generateInWorker(difficulty, randomSeed());
      const pool = load<Pool>(POOL_KEY, {});
      save(POOL_KEY, { ...pool, [difficulty]: [...(pool[difficulty] ?? []), p] });
    }
  } finally {
    filling.delete(difficulty);
  }
}

export async function getPuzzle(difficulty: Difficulty): Promise<StoredPuzzle> {
  const pool = load<Pool>(POOL_KEY, {});
  const list = pool[difficulty] ?? [];
  let p: StoredPuzzle;
  if (list.length) {
    p = list[0];
    save(POOL_KEY, { ...pool, [difficulty]: list.slice(1) });
  } else {
    p = await generateInWorker(difficulty, randomSeed());
  }
  setTimeout(() => refillPool(difficulty), 500);
  return p;
}

/** Day of week -> daily difficulty (Sunday first). */
const DAILY_DIFFICULTY: Difficulty[] = ['expert', 'easy', 'medium', 'hard', 'medium', 'hard', 'expert'];

export function dailyDifficulty(date: string): Difficulty {
  const [y, m, d] = date.split('-').map(Number);
  return DAILY_DIFFICULTY[new Date(y, m - 1, d).getDay()];
}

export async function getDaily(date = todayKey()): Promise<StoredPuzzle & { difficulty: Difficulty }> {
  const difficulty = dailyDifficulty(date);
  const cached = load<{ date: string; p: StoredPuzzle } | null>(DAILY_KEY, null);
  if (cached?.date === date) return { ...cached.p, difficulty };
  // Same seed for everyone on the same day.
  const p = await generateInWorker(difficulty, hashString(`sudoku-daily-${date}`));
  save(DAILY_KEY, { date, p });
  return { ...p, difficulty };
}

/** Warm up: fill pools and today's daily while the user browses. */
export function prefetchAll(): void {
  const run = async () => {
    await getDaily();
    for (const d of ['easy', 'medium', 'hard', 'expert'] as Difficulty[]) await refillPool(d);
  };
  const idle = (window as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(() => void run());
  else setTimeout(() => void run(), 1500);
}
