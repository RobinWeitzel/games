import { randomSeed } from './random';

/**
 * Puzzle generation off the main thread, for games whose generator can take longer than a frame
 * (Nurikabe, Slitherlink). The game's worker file calls `servePuzzles(generate)`; the game
 * creates a source with `createPuzzleSource(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), generate)`.
 *
 * The source keeps one ready puzzle per mode in memory (filled by `prefetch` while the player
 * browses), so "New Game" is usually instant. Nothing is stored: a pool lost to a relaunch is
 * simply generated again. Where workers aren't available (tests), it generates on the spot.
 */

interface Request<M> {
  id: number;
  mode: M;
  seed: number;
}

/** In the worker: answer every request with `generate(mode, seed)`. */
export function servePuzzles<M, P>(generate: (mode: M, seed: number) => P): void {
  const scope = self as unknown as { onmessage: ((e: MessageEvent<Request<M>>) => void) | null; postMessage(m: unknown): void };
  scope.onmessage = (e) => {
    const { id, mode, seed } = e.data;
    scope.postMessage({ id, puzzle: generate(mode, seed) });
  };
}

export interface PuzzleSource<M, P> {
  /** A fresh random puzzle (from the pool when one is ready). */
  next(mode: M): Promise<P>;
  /** The puzzle of a seed, e.g. the daily one (generated once per session). */
  seeded(mode: M, seed: number): Promise<P>;
  /** Fill the pool for these modes in the background. */
  prefetch(modes: M[]): void;
}

export function createPuzzleSource<M extends string, P>(spawn: () => Worker, generate: (mode: M, seed: number) => P): PuzzleSource<M, P> {
  let worker: Worker | null = null;
  let broken = typeof Worker === 'undefined';
  let nextId = 1;
  const pending = new Map<number, { resolve: (p: P) => void; mode: M; seed: number }>();
  const pool = new Map<M, Promise<P>>();
  const bySeed = new Map<string, Promise<P>>();

  /** Generate on the main thread (no worker, or the worker failed). */
  const local = (mode: M, seed: number) => new Promise<P>((resolve) => setTimeout(() => resolve(generate(mode, seed)), 0));

  const getWorker = (): Worker | null => {
    if (broken) return null;
    if (!worker) {
      try {
        worker = spawn();
      } catch {
        broken = true;
        return null;
      }
      worker.onmessage = (e: MessageEvent<{ id: number; puzzle: P }>) => {
        pending.get(e.data.id)?.resolve(e.data.puzzle);
        pending.delete(e.data.id);
      };
      worker.onerror = () => {
        // E.g. the worker script couldn't load: finish everything here instead.
        broken = true;
        worker = null;
        for (const [id, p] of pending) {
          pending.delete(id);
          void local(p.mode, p.seed).then(p.resolve);
        }
      };
    }
    return worker;
  };

  const request = (mode: M, seed: number): Promise<P> => {
    const w = getWorker();
    if (!w) return local(mode, seed);
    return new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, { resolve, mode, seed });
      w.postMessage({ id, mode, seed } satisfies Request<M>);
    });
  };

  const refill = (mode: M) => {
    if (!pool.has(mode)) pool.set(mode, request(mode, randomSeed()));
  };

  return {
    next(mode) {
      const p = pool.get(mode) ?? request(mode, randomSeed());
      pool.delete(mode);
      setTimeout(() => refill(mode), 300);
      return p;
    },
    seeded(mode, seed) {
      const key = `${mode}:${seed}`;
      let p = bySeed.get(key);
      if (!p) bySeed.set(key, (p = request(mode, seed)));
      return p;
    },
    prefetch(modes) {
      modes.forEach(refill);
    },
  };
}
