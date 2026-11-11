import { useEffect, useState } from 'preact/hooks';
import { consumeRestored, sessionStore } from '../../core/session';
import { useIsTop } from '../nav';

/**
 * Call in a game's in-progress screen (the one in `GameModule.resume.Screen`):
 *
 *   const restored = useRestorable(GAME_ID, 'resume');
 *
 * Whenever the screen is on top, it is recorded as the place to return to if iOS closes the
 * app. Returns true when this screen was recreated by such a relaunch (e.g. start the game
 * paused so the player can get oriented).
 */
export function useRestorable(gameId: string, screen: 'hub' | 'resume'): boolean {
  const isTop = useIsTop();
  const [restored] = useState(() => consumeRestored(gameId, screen));
  useEffect(() => {
    if (isTop) sessionStore.set({ gameId, screen });
  }, [isTop, gameId, screen]);
  return restored;
}
