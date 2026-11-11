import { useEffect, useState } from 'preact/hooks';
import { raw } from './raw';

/**
 * Versioned, observable values persisted in localStorage.
 *
 * Every persisted value is wrapped in an envelope `{ "v": <schema version>, "data": … }`.
 * When a store's `version` is raised, `migrations[n]` turns version-n data into version n+1,
 * one step at a time, so data written by any older release can always be read.
 * See docs/STORAGE.md for the rules.
 */
export interface Envelope<T = unknown> {
  v: number;
  data: T;
}

export interface Store<T> {
  readonly key: string;
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: (v: T) => void): () => void;
}

export interface StoreOptions<T> {
  key: string;
  /** Schema version of `data`. Start at 1; raise it (and add a migration) on any breaking change. */
  version: number;
  /** Value used when nothing is stored yet. */
  initial: T;
  /** migrations[n]: data at version n → data at version n + 1. */
  migrations?: Record<number, (data: any) => any>;
  /**
   * Repair/complete data after loading, e.g. fill in defaults for newly added optional fields.
   * Additive changes handled here don't need a version bump.
   */
  normalize?: (data: T) => T;
}

export interface StoreInfo {
  key: string;
  version: number;
  kind: 'data' | 'cache';
}

// ---------------------------------------------------------------------------
// Registry of every declared key (used for the storage contract test and backups).

const registry = new Map<string, StoreInfo>();

function register(info: StoreInfo): void {
  if (registry.has(info.key)) throw new Error(`Storage key "${info.key}" is declared twice.`);
  registry.set(info.key, info);
}

export function declaredStores(): StoreInfo[] {
  return [...registry.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------------------
// Read-only mode: entered when data can't be safely upgraded (failed migration, or data
// written by a newer app version). The app keeps working in memory but never overwrites
// what is stored, so nothing is lost.

let readOnlyReason: string | null = null;
const readOnlyListeners = new Set<() => void>();

export function enterReadOnly(reason: string): void {
  if (readOnlyReason) return;
  readOnlyReason = reason;
  console.warn(`[storage] read-only: ${reason}`);
  readOnlyListeners.forEach((fn) => fn());
}

export const getReadOnlyReason = () => readOnlyReason;
export function onReadOnlyChange(fn: () => void): () => void {
  readOnlyListeners.add(fn);
  return () => readOnlyListeners.delete(fn);
}

/** Stores must not be read before app-level migrations ran (see layout.ts). */
let ready = false;
export function markStorageReady(): void {
  ready = true;
}
/** Test helper. */
export function resetStorageReadyForTests(): void {
  ready = false;
  readOnlyReason = null;
}

// ---------------------------------------------------------------------------

/** Upgrade an envelope to `version`. Pure; exported for tests. */
export function upgrade<T>(env: Envelope, opts: Pick<StoreOptions<T>, 'version' | 'migrations' | 'key'>): T {
  let { v, data } = env;
  while (v < opts.version) {
    const step = opts.migrations?.[v];
    if (!step) throw new Error(`No migration for "${opts.key}" from v${v} to v${v + 1}`);
    data = step(data);
    v++;
  }
  return data as T;
}

function isEnvelope(x: unknown): x is Envelope {
  return !!x && typeof x === 'object' && typeof (x as Envelope).v === 'number' && 'data' in (x as object);
}

export function defineStore<T>(opts: StoreOptions<T>): Store<T> {
  register({ key: opts.key, version: opts.version, kind: 'data' });
  let loaded = false;
  let value: T = opts.initial;
  /** Set when stored data can't be used: then this key is never written. */
  let locked = false;
  const subs = new Set<(v: T) => void>();

  const load = () => {
    if (loaded) return;
    if (!ready && import.meta.env.DEV) {
      console.error(`[storage] "${opts.key}" read before migrations ran. Call initStorage() first.`);
    }
    loaded = true;
    const stored = raw.getJSON<unknown>(opts.key);
    if (stored === undefined) return; // nothing stored → initial
    try {
      if (!isEnvelope(stored)) throw new Error('not an envelope');
      if (stored.v > opts.version) {
        locked = true;
        enterReadOnly(`"${opts.key}" was saved by a newer version of the app.`);
        return;
      }
      const data = stored.v < opts.version ? upgrade<T>(stored, opts) : (stored.data as T);
      value = opts.normalize ? opts.normalize(data) : data;
      if (stored.v < opts.version) persist(); // write back upgraded data
    } catch (e) {
      // Keep the unreadable value aside instead of overwriting it.
      locked = true;
      raw.set(`games/backup/unreadable/${opts.key}`, JSON.stringify(stored));
      enterReadOnly(`"${opts.key}" could not be read (${(e as Error).message}).`);
    }
  };

  const persist = () => {
    if (locked || readOnlyReason) return;
    raw.setJSON(opts.key, { v: opts.version, data: value } satisfies Envelope);
  };

  return {
    key: opts.key,
    get() {
      load();
      return value;
    },
    set(next) {
      load();
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      persist();
      subs.forEach((fn) => fn(value));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/**
 * Disposable cached data (e.g. pre-generated puzzles). Not exported in backups, no migrations:
 * if the stored version differs, the cache is simply treated as empty.
 */
export interface Cache<T> {
  readonly key: string;
  get(): T | null;
  set(value: T): void;
  clear(): void;
}

export function defineCache<T>(key: string, version: number): Cache<T> {
  register({ key, version, kind: 'cache' });
  return {
    key,
    get() {
      const env = raw.getJSON<Envelope<T>>(key);
      return env && env.v === version ? env.data : null;
    },
    set(data) {
      raw.setJSON(key, { v: version, data });
    },
    clear() {
      raw.remove(key);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  const [value, setValue] = useState(() => store.get());
  useEffect(() => {
    setValue(store.get());
    return store.subscribe(setValue);
  }, [store]);
  return value;
}

/** Like useStore, for stores that may not exist (e.g. a game without a daily challenge). */
export function useOptionalStore<T>(store: Store<T> | null): T | null {
  const [value, setValue] = useState<T | null>(() => (store ? store.get() : null));
  useEffect(() => {
    if (!store) return;
    setValue(() => store.get());
    return store.subscribe((v) => setValue(() => v));
  }, [store]);
  return value;
}
