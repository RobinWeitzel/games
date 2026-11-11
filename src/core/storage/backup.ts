import { META_KEY, ROOT, isDataKey } from './keys';
import { CURRENT_LAYOUT, detectLayout, migrateLayout } from './layout';
import { raw } from './raw';

/**
 * Backup file format 2: the raw stored values of every data key, plus the layout they're in.
 * Importing writes them back and runs the normal layout migrations, so a backup made by any
 * older release can be restored into any newer one.
 */
export interface BackupFile {
  app: 'games';
  format: 2;
  layout: number;
  exportedAt: string;
  entries: Record<string, unknown>;
}

/** Format written by the first release (layout 1). */
interface LegacyBackupV1 {
  app: 'games';
  version: 1;
  data: Record<string, unknown>;
}

export function createBackup(): BackupFile {
  const entries: Record<string, unknown> = {};
  for (const k of raw.keys()) if (isDataKey(k) && k !== META_KEY) entries[k] = raw.getJSON(k);
  return { app: 'games', format: 2, layout: detectLayout() || CURRENT_LAYOUT, exportedAt: new Date().toISOString(), entries };
}

/** Normalize any supported backup into { layout, keys } of raw values. */
function parse(input: unknown): { layout: number; entries: Record<string, unknown> } {
  const b = input as Partial<BackupFile & LegacyBackupV1>;
  if (!b || b.app !== 'games') throw new Error('This file is not a Games backup.');
  if (b.format === 2 && b.entries && typeof b.layout === 'number') return { layout: b.layout, entries: b.entries };
  if (b.version === 1 && b.data) {
    const entries: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(b.data)) entries[`games:v1:${k}`] = v;
    return { layout: 1, entries };
  }
  throw new Error('This backup format is not supported.');
}

/**
 * Replace all user data with the backup. The caller should reload the app afterwards so every
 * store re-reads (and migrates) the restored data.
 */
export function restoreBackup(input: unknown): void {
  const { layout, entries } = parse(input);
  if (layout > CURRENT_LAYOUT) throw new Error('This backup was made by a newer version. Update the app first.');

  // Safety copy of what we're about to replace.
  raw.setJSON('games/backup/before-import', { takenAt: new Date().toISOString(), backup: createBackup() });

  for (const k of raw.keys()) if ((k.startsWith(ROOT) && isDataKey(k)) || k.startsWith('games:v1:')) raw.remove(k);
  for (const [k, v] of Object.entries(entries)) raw.setJSON(k, v);
  if (layout >= 2) raw.setJSON(META_KEY, { layout });
  const report = migrateLayout();
  if (report.status === 'failed') throw new Error('The backup could not be upgraded to this version.');
}
