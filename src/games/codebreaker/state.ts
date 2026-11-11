import type { Rng } from '../../core/random';

/**
 * Codebreaker game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * A hidden code of `pegs` symbols (out of `symbols`, repeats allowed). Each guess gets feedback:
 * how many symbols are in the right place (exact) and how many more are in the code but in
 * another place (partial). Find the code within `maxGuesses`.
 *
 * The whole CodebreakerGame object is persisted (games/game/codebreaker/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type CodebreakerMode = 'classic' | 'hard' | 'daily';

export const SHAPES: Record<CodebreakerMode, { pegs: number; symbols: number; maxGuesses: number }> = {
  classic: { pegs: 4, symbols: 6, maxGuesses: 10 },
  hard: { pegs: 5, symbols: 8, maxGuesses: 10 },
  daily: { pegs: 4, symbols: 6, maxGuesses: 10 },
};

export interface Guess {
  pegs: number[];
  exact: number;
  partial: number;
}

export interface CodebreakerGame {
  mode: CodebreakerMode;
  date?: string;
  pegs: number;
  symbols: number;
  maxGuesses: number;
  code: number[];
  guesses: Guess[];
  /** The guess being built (null = empty slot). */
  current: (number | null)[];
  /** Positions of the code shown by hints. */
  revealed: number[];
  status: 'playing' | 'won' | 'lost';
  hints: number;
  elapsedMs: number;
  touched: boolean;
}

export type Action =
  /** Put a symbol in the next empty slot. */
  | { type: 'add'; symbol: number }
  /** Empty a slot (tap it). */
  | { type: 'clear'; slot: number }
  /** Remove the last symbol. */
  | { type: 'backspace' }
  | { type: 'submit' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'changed' }
  | { kind: 'scored'; guess: Guess }
  | { kind: 'hint'; slot: number }
  | { kind: 'won' }
  | { kind: 'lost' };

export function newGame(mode: CodebreakerMode, rng: Rng, date?: string): CodebreakerGame {
  const { pegs, symbols, maxGuesses } = SHAPES[mode];
  return {
    mode,
    ...(date ? { date } : {}),
    pegs,
    symbols,
    maxGuesses,
    code: Array.from({ length: pegs }, () => Math.floor(rng() * symbols)),
    guesses: [],
    current: new Array(pegs).fill(null),
    revealed: [],
    status: 'playing',
    hints: 0,
    elapsedMs: 0,
    touched: false,
  };
}

/** Exact: right symbol in the right place. Partial: right symbol in another place (each code peg counts once). */
export function score(code: number[], guess: number[]): { exact: number; partial: number } {
  let exact = 0;
  const restCode: number[] = [];
  const restGuess: number[] = [];
  code.forEach((c, i) => (c === guess[i] ? exact++ : (restCode.push(c), restGuess.push(guess[i]))));
  let partial = 0;
  for (const g of restGuess) {
    const k = restCode.indexOf(g);
    if (k >= 0) {
      partial++;
      restCode.splice(k, 1);
    }
  }
  return { exact, partial };
}

export const progress = (g: CodebreakerGame) => g.guesses.length / g.maxGuesses;

export function reduce(g: CodebreakerGame, action: Action): [CodebreakerGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'add': {
      const slot = g.current.indexOf(null);
      if (slot < 0 || action.symbol < 0 || action.symbol >= g.symbols) return [g, { kind: 'none' }];
      const current = g.current.slice();
      current[slot] = action.symbol;
      return [{ ...g, current, touched: true }, { kind: 'changed' }];
    }
    case 'clear': {
      if (g.current[action.slot] == null || g.revealed.includes(action.slot)) return [g, { kind: 'none' }];
      const current = g.current.slice();
      current[action.slot] = null;
      return [{ ...g, current }, { kind: 'changed' }];
    }
    case 'backspace': {
      let slot = -1;
      g.current.forEach((s, i) => s != null && !g.revealed.includes(i) && (slot = i));
      return slot < 0 ? [g, { kind: 'none' }] : reduce(g, { type: 'clear', slot });
    }
    case 'submit': {
      if (g.current.some((s) => s == null)) return [g, { kind: 'none' }];
      const pegs = g.current as number[];
      const guess = { pegs, ...score(g.code, pegs) };
      const guesses = [...g.guesses, guess];
      // Revealed positions stay filled in the next row.
      const current = g.current.map((_, i) => (g.revealed.includes(i) ? g.code[i] : null));
      const next = { ...g, guesses, current, touched: true };
      if (guess.exact === g.pegs) return [{ ...next, status: 'won' }, { kind: 'won' }];
      if (guesses.length >= g.maxGuesses) return [{ ...next, status: 'lost' }, { kind: 'lost' }];
      return [next, { kind: 'scored', guess }];
    }
    case 'hint': {
      const slot = g.code.findIndex((_, i) => !g.revealed.includes(i));
      // Always leave one peg to find.
      if (slot < 0 || g.revealed.length >= g.pegs - 1) return [g, { kind: 'none' }];
      const current = g.current.slice();
      current[slot] = g.code[slot];
      return [{ ...g, current, revealed: [...g.revealed, slot], hints: g.hints + 1, touched: true }, { kind: 'hint', slot }];
    }
  }
}
