import { beforeAll, expect, it } from 'vitest';
import { markStorageReady, resetStorageReadyForTests } from './storage/store';
import { favoritesStore, isFavorite, setFavorite } from './favorites';

beforeAll(() => {
  resetStorageReadyForTests();
  markStorageReady();
});

// The store loads lazily and then keeps its value in memory, so the tests run in order on it.
it('reads stored favorites, keeping unknown game ids and dropping garbage', () => {
  // A literal stored value, including an id of a game that may be hidden and some garbage.
  localStorage.setItem('games/app/favorites', JSON.stringify({ v: 1, data: ['reversi', 'old-game', 7] }));
  expect(favoritesStore.get()).toEqual(['reversi', 'old-game']);
});

it('adds to the end and removes without touching other ids', () => {
  setFavorite('sudoku', true);
  setFavorite('sudoku', true);
  expect(favoritesStore.get()).toEqual(['reversi', 'old-game', 'sudoku']);
  setFavorite('reversi', false);
  expect(isFavorite('reversi')).toBe(false);
  expect(JSON.parse(localStorage.getItem('games/app/favorites')!)).toEqual({ v: 1, data: ['old-game', 'sudoku'] });
});
