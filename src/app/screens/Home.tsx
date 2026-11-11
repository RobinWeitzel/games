import { useEffect, useState } from 'preact/hooks';
import { GAMES, GameDef } from '../../games/registry';
import { useNav, Screen } from '../nav';
import { haptic } from '../../core/haptics';
import { IconGear, IconPlay, IconShare } from '../../ui/icons';
import { Settings } from './Settings';

const isStandalone =
  (navigator as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export function Home() {
  const nav = useNav();
  return (
    <Screen
      class="home"
      right={
        <button class="nav-icon" aria-label="Settings" onClick={() => nav.push(<Settings />)}>
          <IconGear size={24} />
        </button>
      }
    >
      <h1 class="large-title">Games</h1>
      {!isStandalone && <InstallHint />}
      {GAMES.map((g) => (
        <ContinueCard key={g.id} game={g} />
      ))}
      <div class="tiles">
        {GAMES.map((g) => (
          <button
            key={g.id}
            class="tile"
            style={{ background: g.color }}
            onClick={() => {
              haptic('selection');
              nav.push(g.home());
            }}
          >
            <g.Icon size={44} />
            <span class="tile-name">{g.name}</span>
            <span class="tile-tagline">{g.tagline}</span>
          </button>
        ))}
        <div class="tile tile-soon">
          <span class="tile-name">More soon</span>
          <span class="tile-tagline">Minesweeper & friends</span>
        </div>
      </div>
    </Screen>
  );
}

function ContinueCard({ game }: { game: GameDef }) {
  const nav = useNav();
  const [, force] = useState(0);
  useEffect(() => game.saved?.store.subscribe(() => force((n) => n + 1)), [game]);
  const info = game.saved?.describe();
  if (!info || !game.saved) return null;
  return (
    <button
      class="continue-card"
      onClick={() => {
        haptic('selection');
        nav.push(game.saved!.resume());
      }}
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
