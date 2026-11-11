import { META_KEY, ROOT, isBackupKey } from './keys';
import { raw } from './raw';
import { enterReadOnly, markStorageReady } from './store';

/**
 * App-wide storage layout versions.
 *
 * Per-key schema changes are handled by each store's own `version` + `migrations`
 * (see store.ts). A *layout* migration is only needed when keys move, are split or merged,
 * i.e. when the overall key structure changes. See docs/STORAGE.md.
 *
 *   Layout 1 (first release): flat keys "games:v1:<name>", raw JSON values.
 *   Layout 2: namespaced keys (keys.ts) with versioned envelopes.
 *
 * Migrations are FROZEN once released: they describe how old data looked at that time, so
 * they must never import current types or stores. Copy any shapes they need.
 */
export const CURRENT_LAYOUT = 2;

export interface LayoutMigration {
  from: number;
  description: string;
  run(): void;
}

const V1 = 'games:v1:';

/** Layout 1 → 2: split the shared blobs into per-game namespaced, versioned keys. */
const layout1to2: LayoutMigration = {
  from: 1,
  description: 'Namespaced per-game keys with versioned envelopes',
  run() {
    const env = (data: unknown) => ({ v: 1, data });
    const read = <T>(name: string) => raw.getJSON<T>(V1 + name);

    // settings: { theme, haptics, sudoku: {...} } → app settings + per-game settings
    const settings = read<{ theme?: string; haptics?: boolean; sudoku?: object }>('settings');
    if (settings) {
      raw.setJSON('games/app/settings', env({ theme: settings.theme, haptics: settings.haptics }));
      if (settings.sudoku) raw.setJSON('games/game/sudoku/settings', env(settings.sudoku));
    }

    // stats: { [gameId]: { [mode]: ModeStats } } → per game
    const stats = read<Record<string, unknown>>('stats');
    for (const [gameId, modes] of Object.entries(stats ?? {})) {
      raw.setJSON(`games/game/${gameId}/stats`, env(modes));
    }

    // daily: { [gameId]: { [date]: entry } } → per game
    const daily = read<Record<string, unknown>>('daily');
    for (const [gameId, days] of Object.entries(daily ?? {})) {
      raw.setJSON(`games/game/${gameId}/daily`, env(days));
    }

    // In-progress sudoku game (same shape).
    const save = read<unknown>('sudoku:save');
    if (save) raw.setJSON('games/game/sudoku/save', env(save));

    // Caches (puzzle pool, daily puzzle) are simply dropped; they regenerate.
    for (const k of raw.keys()) if (k.startsWith(V1)) raw.remove(k);
  },
};

/** Ordered list; add new migrations at the end with `from` = previous CURRENT_LAYOUT. */
export const LAYOUT_MIGRATIONS: LayoutMigration[] = [layout1to2];

/** Which layout the stored data is in. 0 = nothing stored yet. */
export function detectLayout(): number {
  const meta = raw.getJSON<{ layout?: number }>(META_KEY);
  if (meta?.layout) return meta.layout;
  if (raw.keys().some((k) => k.startsWith(V1))) return 1;
  return 0;
}

/** Everything this app ever stored (current and legacy prefixes), excluding old safety copies. */
function snapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of raw.keys()) {
    if ((k.startsWith(ROOT) && !isBackupKey(k)) || k.startsWith(V1)) out[k] = raw.get(k)!;
  }
  return out;
}

function restore(snap: Record<string, string>): void {
  for (const k of raw.keys()) if ((k.startsWith(ROOT) && !isBackupKey(k)) || k.startsWith(V1)) raw.remove(k);
  for (const [k, v] of Object.entries(snap)) raw.set(k, v);
}

export interface MigrationReport {
  from: number;
  to: number;
  status: 'fresh' | 'current' | 'migrated' | 'failed' | 'newer';
  error?: string;
}

/**
 * Bring stored data up to CURRENT_LAYOUT. Must run before any store is read.
 *
 * Safety: a full copy of the old data is written to games/backup/layout-<from> first.
 * If a step throws, everything is restored and the app runs read-only for this session,
 * so a bug in a migration can never destroy user data.
 */
export function migrateLayout(): MigrationReport {
  const from = detectLayout();
  const done = (status: MigrationReport['status'], error?: string): MigrationReport => ({
    from,
    to: status === 'migrated' || status === 'fresh' ? CURRENT_LAYOUT : from,
    status,
    error,
  });

  if (from === 0) {
    raw.setJSON(META_KEY, { layout: CURRENT_LAYOUT });
    return done('fresh');
  }
  if (from === CURRENT_LAYOUT) return done('current');
  if (from > CURRENT_LAYOUT) {
    enterReadOnly('Your data was saved by a newer version of the app. Reload to update.');
    return done('newer');
  }

  const snap = snapshot();
  raw.setJSON(`games/backup/layout-${from}`, { takenAt: new Date().toISOString(), keys: snap });
  try {
    for (let layout = from; layout < CURRENT_LAYOUT; layout++) {
      const m = LAYOUT_MIGRATIONS.find((x) => x.from === layout);
      if (!m) throw new Error(`No layout migration from ${layout}`);
      m.run();
      raw.setJSON(META_KEY, { layout: layout + 1 });
    }
    return done('migrated');
  } catch (e) {
    restore(snap);
    enterReadOnly('Saved data could not be upgraded. Progress is not saved this session.');
    return done('failed', (e as Error).message);
  }
}

/** Entry point called once at startup, before anything reads a store. */
export function initStorage(): MigrationReport {
  const report = migrateLayout();
  markStorageReady();
  if (report.status === 'migrated' || report.status === 'failed') console.info('[storage]', report);
  return report;
}
