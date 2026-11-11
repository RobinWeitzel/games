import { appKey, defineStore, gameKey } from './storage';

export type ThemeSetting = 'system' | 'light' | 'dark';

/** App-wide settings. Game-specific options live in each game (createGameSettings). */
export interface AppSettings {
  theme: ThemeSetting;
  haptics: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = { theme: 'system', haptics: true };

export const settingsStore = defineStore<AppSettings>({
  key: appKey('settings'),
  version: 1,
  initial: DEFAULT_APP_SETTINGS,
  // New settings get their default automatically, no version bump needed.
  normalize: (s) => ({ ...DEFAULT_APP_SETTINGS, ...stripUndefined(s) }),
});

/**
 * Settings owned by one game, stored under games/game/<id>/settings.
 * Adding a setting = add it to `defaults`; existing users get the default.
 */
export function createGameSettings<T extends object>(gameId: string, defaults: T, version = 1, migrations?: Record<number, (d: any) => any>) {
  return defineStore<T>({
    key: gameKey(gameId, 'settings'),
    version,
    initial: defaults,
    migrations,
    normalize: (s) => ({ ...defaults, ...stripUndefined(s) }),
  });
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;
}
