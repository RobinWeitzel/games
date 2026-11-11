import type { GameModule } from '../../games/types';
import { useRestorable } from '../../ui/game/useRestorable';

/** A game's hub, tracked for state restoration by the shell (games don't need to do this). */
export function GameHubScreen({ game }: { game: GameModule }) {
  useRestorable(game.id, 'hub');
  return <game.Hub />;
}
