import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LAYOUT1, MODE_STATS_V1, savedGameV1, writeLayout1 } from '../../test/fixtures/layout1';

/** Fresh copies of all modules, so module-level stores re-read storage. */
async function boot() {
  vi.resetModules();
  const layout = await import('./layout');
  const report = layout.initStorage();
  const settings = await import('../settings');
  const sudoku = await import('../../games/sudoku/storage');
  const store = await import('./store');
  return { report, settings, sudoku, store, layout };
}

beforeEach(() => vi.resetModules());

describe('layout migrations', () => {
  it('starts fresh installs at the current layout', async () => {
    const { report, layout } = await boot();
    expect(report.status).toBe('fresh');
    expect(JSON.parse(localStorage.getItem('games/meta')!)).toEqual({ layout: layout.CURRENT_LAYOUT });
  });

  it('upgrades first-release data without losing anything', async () => {
    writeLayout1();
    const { report, settings, sudoku, store } = await boot();
    expect(report).toMatchObject({ from: 1, status: 'migrated' });
    expect(store.getReadOnlyReason()).toBeNull();

    expect(settings.settingsStore.get()).toEqual({ haptics: false });
    // Chain: layout 1 → 2 writes settings v1, then the store migrates v1 → v2 (theme removed).
    expect(JSON.parse(localStorage.getItem('games/app/settings')!).v).toBe(2);
    expect(sudoku.sudokuSettings.get()).toEqual({ mistakeLimit: false, highlightSame: true, autoRemoveNotes: false });
    expect(sudoku.sudokuStats.get('easy')).toEqual(MODE_STATS_V1);
    expect(sudoku.sudokuStats.get('daily').played).toBe(1);
    expect(sudoku.sudokuStats.daily!.get()).toEqual({ '2026-11-10': { timeMs: 500000, assists: 0 } });
    expect(sudoku.savedGame.get()).toEqual(savedGameV1);

    // Old keys are gone, caches dropped, and a safety copy exists.
    expect(Object.keys(localStorage).length).toBeGreaterThan(0);
    for (let i = 0; i < localStorage.length; i++) expect(localStorage.key(i)).not.toMatch(/^games:v1:/);
    const backup = JSON.parse(localStorage.getItem('games/backup/layout-1')!);
    expect(JSON.parse(backup.keys['games:v1:stats'])).toEqual(LAYOUT1['games:v1:stats']);
  });

  it('is idempotent on the next launch', async () => {
    writeLayout1();
    await boot();
    const { report, sudoku } = await boot();
    expect(report.status).toBe('current');
    expect(sudoku.sudokuStats.get('easy')).toEqual(MODE_STATS_V1);
  });

  it('restores everything and goes read-only if a migration fails', async () => {
    writeLayout1();
    vi.resetModules();
    const layout = await import('./layout');
    const store = await import('./store');
    const before = JSON.stringify(Object.fromEntries(Object.entries(LAYOUT1).map(([k]) => [k, localStorage.getItem(k)])));
    layout.LAYOUT_MIGRATIONS[0].run = () => {
      localStorage.removeItem('games:v1:stats');
      throw new Error('boom');
    };
    expect(layout.migrateLayout()).toMatchObject({ status: 'failed', error: 'boom' });
    const after = JSON.stringify(Object.fromEntries(Object.entries(LAYOUT1).map(([k]) => [k, localStorage.getItem(k)])));
    expect(after).toBe(before);
    expect(store.getReadOnlyReason()).not.toBeNull();
  });

  it('refuses to touch data from a newer layout', async () => {
    localStorage.setItem('games/meta', JSON.stringify({ layout: 99 }));
    const { report, store } = await boot();
    expect(report.status).toBe('newer');
    expect(store.getReadOnlyReason()).not.toBeNull();
  });
});

describe('backups', () => {
  it('round-trips all data', async () => {
    writeLayout1();
    const { sudoku } = await boot();
    sudoku.sudokuStats.record('hard', { outcome: 'won', timeMs: 1000, assists: 0 });
    const { createBackup, restoreBackup } = await import('./backup');
    const file = JSON.parse(JSON.stringify(createBackup()));
    expect(Object.keys(file.entries).some((k) => k.startsWith('games/cache/'))).toBe(false);

    localStorage.clear();
    restoreBackup(file);
    const after = await boot();
    expect(after.sudoku.sudokuStats.get('hard').won).toBe(1);
    expect(after.sudoku.sudokuStats.get('easy')).toEqual(MODE_STATS_V1);
  });

  it('restores a backup exported by the first release', async () => {
    await boot();
    const legacy = {
      app: 'games',
      version: 1,
      exportedAt: '2026-11-11T00:00:00Z',
      data: { settings: LAYOUT1['games:v1:settings'], stats: LAYOUT1['games:v1:stats'], daily: LAYOUT1['games:v1:daily'] },
    };
    const { restoreBackup } = await import('./backup');
    restoreBackup(legacy);
    const after = await boot();
    expect(after.sudoku.sudokuStats.get('easy')).toEqual(MODE_STATS_V1);
    expect(after.settings.settingsStore.get().haptics).toBe(false);
  });

  it('rejects foreign files and backups from newer versions', async () => {
    await boot();
    const { restoreBackup } = await import('./backup');
    expect(() => restoreBackup({ hello: 1 })).toThrow(/not a Games backup/);
    expect(() => restoreBackup({ app: 'games', format: 2, layout: 99, entries: {} })).toThrow(/newer version/);
  });
});
