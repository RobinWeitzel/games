import { appKey, defineStore, gameKey } from './storage';

/**
 * App-wide settings. Game-specific options live in each game (createGameSettings).
 *
 * There is deliberately no appearance (light/dark) setting: the HIG says to follow the system
 * appearance instead of offering an app-specific one (docs/DESIGN.md).
 */
export interface AppSettings {
  haptics: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = { haptics: true };

export const settingsStore = defineStore<AppSettings>({
  key: appKey('settings'),
  version: 2,
  initial: DEFAULT_APP_SETTINGS,
  migrations: {
    // v1 → v2: the app-specific `theme` setting was removed (app follows the system appearance).
    1: (d: { theme?: string; haptics?: boolean }) => ({ haptics: d?.haptics }),
  },
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
