import type { GameModule } from '../../games/types';
import { useRestorable } from '../../ui/game/useRestorable';
import { BarAccessory } from '../../ui/nav';
import { IconStar } from '../../ui/icons';
import { useStore } from '../../core/storage';
import { favoritesStore, setFavorite } from '../../core/favorites';

/**
 * A game's hub, tracked for state restoration by the shell (games don't need to do this).
 * The shell also puts the Favorites star in the hub's navigation bar.
 */
export function GameHubScreen({ game }: { game: GameModule }) {
  useRestorable(game.id, 'hub');
  return (
    <BarAccessory value={<FavoriteButton gameId={game.id} />}>
      <game.Hub />
    </BarAccessory>
  );
}

function FavoriteButton({ gameId }: { gameId: string }) {
  const on = useStore(favoritesStore).includes(gameId);
  return (
    <button class="nav-icon" aria-label="Favorite" aria-pressed={on} onClick={() => setFavorite(gameId, !on)}>
      <IconStar size={24} filled={on} />
    </button>
  );
}
