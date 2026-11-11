/**
 * Lowest storage level: string values in localStorage, never throwing.
 * Everything above this file works with JSON values and versioned envelopes.
 *
 * If localStorage is unavailable (private mode quirks, blocked storage) we fall back to an
 * in-memory map so the app still works for the session.
 */
const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const raw = {
  get(key: string): string | null {
    const s = ls();
    try {
      return s ? s.getItem(key) : (memory.get(key) ?? null);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string): boolean {
    const s = ls();
    try {
      if (s) s.setItem(key, value);
      else memory.set(key, value);
      return true;
    } catch {
      // Quota exceeded: keep the session working in memory.
      memory.set(key, value);
      return false;
    }
  },
  remove(key: string): void {
    memory.delete(key);
    try {
      ls()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  keys(): string[] {
    const s = ls();
    const out = new Set(memory.keys());
    try {
      if (s) for (let i = 0; i < s.length; i++) out.add(s.key(i)!);
    } catch {
      /* ignore */
    }
    return [...out];
  },
  getJSON<T>(key: string): T | undefined {
    const v = raw.get(key);
    if (v == null) return undefined;
    try {
      return JSON.parse(v) as T;
    } catch {
      return undefined;
    }
  },
  setJSON(key: string, value: unknown): boolean {
    return raw.set(key, JSON.stringify(value));
  },
};
