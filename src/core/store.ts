import { useEffect, useState } from 'preact/hooks';
import { load, save } from './storage';

/** Tiny observable value persisted in localStorage. */
export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: (v: T) => void): () => void;
  /** Re-read from storage (after import / reset). */
  reload(): void;
}

export function persistentStore<T>(key: string, initial: T, migrate?: (raw: T) => T): Store<T> {
  const read = () => {
    const raw = load<T>(key, initial);
    return migrate ? migrate(raw) : raw;
  };
  let value = read();
  const subs = new Set<(v: T) => void>();
  const emit = () => subs.forEach((fn) => fn(value));
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      save(key, value);
      emit();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    reload() {
      value = read();
      emit();
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  const [value, setValue] = useState(store.get());
  useEffect(() => {
    setValue(store.get());
    return store.subscribe(setValue);
  }, [store]);
  return value;
}
