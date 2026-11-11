import { beforeEach, describe, expect, it } from 'vitest';
import { defineCache, defineStore, getReadOnlyReason, markStorageReady, resetStorageReadyForTests, upgrade } from './store';

let n = 0;
const uniqueKey = () => `games/game/test/k${n++}`;

beforeEach(() => {
  resetStorageReadyForTests();
  markStorageReady();
});

describe('defineStore', () => {
  it('returns the initial value and persists an envelope', () => {
    const key = uniqueKey();
    const s = defineStore({ key, version: 1, initial: { a: 1 } });
    expect(s.get()).toEqual({ a: 1 });
    s.set({ a: 2 });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ v: 1, data: { a: 2 } });
  });

  it('runs migrations step by step and writes the upgraded value back', () => {
    const key = uniqueKey();
    localStorage.setItem(key, JSON.stringify({ v: 1, data: { name: 'x' } }));
    const s = defineStore({
      key,
      version: 3,
      initial: { title: '', count: 0 },
      migrations: {
        1: (d: { name: string }) => ({ title: d.name }),
        2: (d: { title: string }) => ({ ...d, count: 0 }),
      },
    });
    expect(s.get()).toEqual({ title: 'x', count: 0 });
    expect(JSON.parse(localStorage.getItem(key)!).v).toBe(3);
  });

  it('applies normalize (defaults for new fields)', () => {
    const key = uniqueKey();
    localStorage.setItem(key, JSON.stringify({ v: 1, data: { a: true } }));
    const defaults = { a: false, b: 5 };
    const s = defineStore({ key, version: 1, initial: defaults, normalize: (d) => ({ ...defaults, ...d }) });
    expect(s.get()).toEqual({ a: true, b: 5 });
  });

  it('never overwrites data written by a newer version', () => {
    const key = uniqueKey();
    const stored = JSON.stringify({ v: 9, data: 'future' });
    localStorage.setItem(key, stored);
    const s = defineStore({ key, version: 1, initial: 'x' });
    expect(s.get()).toBe('x');
    s.set('y');
    expect(localStorage.getItem(key)).toBe(stored);
    expect(getReadOnlyReason()).toMatch(/newer version/);
  });

  it('keeps unreadable data aside instead of destroying it', () => {
    const key = uniqueKey();
    localStorage.setItem(key, JSON.stringify({ v: 1, data: 1 }));
    const s = defineStore({ key, version: 2, initial: 0 }); // migration missing
    expect(s.get()).toBe(0);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ v: 1, data: 1 });
    expect(localStorage.getItem(`games/backup/unreadable/${key}`)).not.toBeNull();
  });

  it('rejects duplicate keys', () => {
    const key = uniqueKey();
    defineStore({ key, version: 1, initial: 0 });
    expect(() => defineStore({ key, version: 1, initial: 0 })).toThrow(/declared twice/);
  });

  it('upgrade() throws on a gap in the migration chain', () => {
    expect(() => upgrade({ v: 1, data: 0 }, { key: 'k', version: 3, migrations: { 1: (x) => x } })).toThrow(/v2 to v3/);
  });
});

describe('defineCache', () => {
  it('treats a different version as empty', () => {
    const key = `games/cache/test/c${n++}`;
    localStorage.setItem(key, JSON.stringify({ v: 1, data: [1] }));
    expect(defineCache<number[]>(key, 2).get()).toBeNull();
  });
});
