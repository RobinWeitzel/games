/**
 * Versioned localStorage wrapper. Everything the app persists lives under one prefix,
 * which makes export / import / reset trivial.
 */
const PREFIX = 'games:v1:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota or private mode: nothing sensible to do, the app keeps working in memory.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

function allKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
    }
  } catch {
    /* ignore */
  }
  return keys;
}

/** Keys that are caches and need not be exported. */
const EPHEMERAL = /(^|:)(pool|daily-cache)$/;

export interface Backup {
  app: 'games';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function exportAll(): Backup {
  const data: Record<string, unknown> = {};
  for (const k of allKeys()) if (!EPHEMERAL.test(k)) data[k] = load(k, null);
  return { app: 'games', version: 1, exportedAt: new Date().toISOString(), data };
}

export function importAll(backup: unknown): void {
  const b = backup as Backup;
  if (!b || b.app !== 'games' || b.version !== 1 || typeof b.data !== 'object') {
    throw new Error('This file is not a Games backup.');
  }
  for (const k of allKeys()) if (!EPHEMERAL.test(k)) remove(k);
  for (const [k, v] of Object.entries(b.data)) save(k, v);
}

/** Ask the browser not to evict our storage. Home screen apps on iOS are usually exempt anyway. */
export function requestPersistence(): void {
  navigator.storage?.persist?.().catch(() => {});
}
