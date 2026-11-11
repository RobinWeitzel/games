/// <reference lib="webworker" />
import { createRng } from '../../../core/random';
import { Difficulty, generate } from './generator';

export interface WorkerRequest {
  id: number;
  difficulty: Difficulty;
  seed: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, difficulty, seed } = e.data;
  const p = generate(difficulty, createRng(seed));
  (self as unknown as Worker).postMessage({ id, puzzle: p.puzzle, solution: p.solution, level: p.level });
};
