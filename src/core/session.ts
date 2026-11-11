import { appKey, defineStore } from './storage';

/**
 * Where the player was when the app was last closed, so a relaunch returns them there
 * (HIG: "Restore the previous state when your app restarts"). iOS kills backgrounded home
 * screen apps freely, so from the player's point of view this is "the app was never closed".
 *
 * Whichever screen is on top records itself: Home clears it, the shell records a game's hub,
 * and game screens call useRestorable().
 */
export interface SessionState {
  gameId: string;
  /** 'hub' = the game's first screen; 'resume' = its in-progress game screen. */
  screen: 'hub' | 'resume';
}

export const sessionStore = defineStore<SessionState | null>({
  key: appKey('session'),
  version: 1,
  initial: null,
});

let restoredOnLaunch: { gameId: string; screen: string } | null = null;

/** Set by the shell when it rebuilt the navigation stack from the stored session. */
export function markRestored(s: { gameId: string; screen: string } | null): void {
  restoredOnLaunch = s;
}

/** True once for the screen that was recreated by launch restoration. */
export function consumeRestored(gameId: string, screen: string): boolean {
  if (restoredOnLaunch?.gameId === gameId && restoredOnLaunch.screen === screen) {
    restoredOnLaunch = null;
    return true;
  }
  return false;
}
