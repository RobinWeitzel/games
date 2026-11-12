import { useEffect, useState } from 'preact/hooks';
import { GAMES } from '../../games/registry';
import type { GameCategory, GameModule } from '../../games/types';
import { useIsTop, useNav, Screen } from '../../ui/nav';
import { sessionStore } from '../../core/session';
import { useStore } from '../../core/storage';
import { favoritesStore } from '../../core/favorites';
import { IconGear, IconPlay, IconShare, IconStar } from '../../ui/icons';
import { Settings } from './Settings';
import { GameHubScreen } from './GameHubScreen';

/** Home screen groups, in order. A Record, so TypeScript fails if a category has no group. */
const GROUP_TITLES: Record<GameCategory, string> = {
  numbers: 'Number Puzzles',
  logic: 'Logic Puzzles',
  cards: 'Card Games',
  board: 'Board Games',
};
const GROUPS = Object.entries(GROUP_TITLES).map(([id, title]) => ({ id: id as GameCategory, title }));

const isStandalone =
  (navigator as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export function Home() {
  const nav = useNav();
  const isTop = useIsTop();
  const favoriteIds = useStore(favoritesStore);
  // In the order they were added; ids of games no longer listed are kept but not shown.
  const favorites = favoriteIds.map((id) => GAMES.find((g) => g.id === id)).filter((g): g is GameModule => !!g);
  // Back on the home screen: nothing to restore on the next launch.
  useEffect(() => {
    if (isTop) sessionStore.set(null);
  }, [isTop]);
  return (
    <Screen
      class="home"
      largeTitle="Games"
      right={
        <button class="nav-icon" aria-label="Settings" onClick={() => nav.push(<Settings />)}>
          <IconGear size={24} />
        </button>
      }
    >
      {!isStandalone && <InstallHint />}
      {GAMES.map((g) => (
        <ContinueCard key={g.id} game={g} />
      ))}
      {favorites.length > 0 && <TileGroup title="Favorites" games={favorites} />}
      {GROUPS.map((group) => (
        <TileGroup key={group.id} title={group.title} games={GAMES.filter((g) => g.category === group.id)} />
      ))}
      {favorites.length === 0 && (
        <p class="home-footnote">
          Tap <IconStar size={16} class="inline-icon" /> on a game's page to add it to Favorites.
        </p>
      )}
    </Screen>
  );
}

function TileGroup({ title, games }: { title: string; games: GameModule[] }) {
  const nav = useNav();
  if (!games.length) return null;
  return (
    <section class="tile-group">
      <h2 class="tile-group-title">{title}</h2>
      <div class="tiles">
        {games.map((g) => (
          <button key={g.id} class="tile" style={{ background: g.color }} onClick={() => nav.push(<GameHubScreen game={g} />)}>
            <g.Icon size={44} />
            <span class="tile-name">{g.name}</span>
            <span class="tile-tagline">{g.tagline}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ContinueCard({ game }: { game: GameModule }) {
  const nav = useNav();
  const [, force] = useState(0);
  useEffect(() => game.resume?.store.subscribe(() => force((n) => n + 1)), [game]);
  const resume = game.resume;
  const info = resume?.describe();
  if (!info || !resume) return null;
  return (
    <button
      class="continue-card"
      onClick={() => nav.push(<resume.Screen />)}
    >
      <span class="continue-icon" style={{ background: game.color }}>
        <game.Icon size={28} />
      </span>
      <span class="continue-text">
        <span class="continue-label">Continue {game.name}</span>
        <span class="continue-sub">
          {info.label} · {Math.round(info.progress * 100)}%
        </span>
        <span class="progress">
          <span style={{ width: `${info.progress * 100}%` }} />
        </span>
      </span>
      <span class="continue-play">
        <IconPlay size={18} />
      </span>
    </button>
  );
}

function InstallHint() {
  return (
    <div class="install-hint">
      <strong>Install the app</strong>
      <span>
        Tap <IconShare size={16} class="inline-icon" /> Share, then <b>Add to Home Screen</b> for full-screen play and offline
        use.
      </span>
    </div>
  );
}
