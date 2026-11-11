import type { FunctionComponent } from 'preact';
import type { GameStats } from '../core/stats';
import type { Store } from '../core/storage';

/**
 * The contract between the app shell and a game. The shell (home screen, settings,
 * statistics, backups) only ever talks to games through this interface, so adding a game
 * never requires changes outside `src/games/<id>/` and one line in `registry.ts`.
 *
 * See docs/ADDING_A_GAME.md.
 */
export interface GameModule {
  /**
   * Permanent identifier: lowercase letters, digits, dashes. It is part of every storage key
   * of the game (games/game/<id>/…), so it must NEVER change once released.
   */
  id: string;
  name: string;
  /** One line shown on the home tile. */
  tagline: string;
  /** White glyph drawn on the tile. */
  Icon: FunctionComponent<{ size?: number }>;
  /** CSS background of the tile (usually a gradient). */
  color: string;

  /** First screen of the game (difficulty picker, daily, stats link…). Pushed on tile tap. */
  Hub: FunctionComponent;

  /** Per-mode statistics; drives the Statistics screen, reset and backups. */
  stats: GameStats;

  /** Lets the home screen show a "Continue" card for a game in progress. */
  resume?: {
    /** Store holding the game in progress (subscribed to for updates). */
    store: Store<unknown>;
    /** null when there is nothing to continue. */
    describe(): { label: string; progress: number } | null;
    /** Screen that continues the saved game. */
    Screen: FunctionComponent;
  };

  /** Rendered as a section in the Settings screen. */
  SettingsSection?: FunctionComponent;

  /** Called once after launch when the app is idle (warm caches, pre-generate levels…). */
  prefetch?: () => void;
}
