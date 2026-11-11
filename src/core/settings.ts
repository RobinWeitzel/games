import { persistentStore } from './store';

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeSetting;
  haptics: boolean;
  sudoku: {
    /** End the game after 3 mistakes. */
    mistakeLimit: boolean;
    /** Highlight all cells with the selected number. */
    highlightSame: boolean;
    /** Remove a digit from notes in the same row / column / box when it is placed. */
    autoRemoveNotes: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  haptics: true,
  sudoku: { mistakeLimit: true, highlightSame: true, autoRemoveNotes: true },
};

export const settingsStore = persistentStore<Settings>('settings', DEFAULT_SETTINGS, (raw) => ({
  ...DEFAULT_SETTINGS,
  ...raw,
  sudoku: { ...DEFAULT_SETTINGS.sudoku, ...raw?.sudoku },
}));
