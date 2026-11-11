import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { Navigator } from '../ui/nav';
import { Home } from './screens/Home';
import { Toast } from '../ui/components';
import { getReadOnlyReason, onReadOnlyChange } from '../core/storage';
import { markRestored, sessionStore } from '../core/session';
import { GAMES } from '../games/registry';
import { GameHubScreen } from './screens/GameHubScreen';

/** Rebuild the navigation stack the player left (HIG: restore state on relaunch). */
function restoredStack() {
  const s = sessionStore.get();
  const game = s && GAMES.find((g) => g.id === s.gameId);
  if (!s || !game) return [];
  const resume = s.screen === 'resume' && game.resume?.describe() ? game.resume : null;
  markRestored({ gameId: game.id, screen: resume ? 'resume' : 'hub' });
  return resume ? [<GameHubScreen game={game} />, <resume.Screen />] : [<GameHubScreen game={game} />];
}

export function App() {
  const [update, setUpdate] = useState<null | (() => void)>(null);
  const [readOnly, setReadOnly] = useState(getReadOnlyReason());
  const [initial] = useState(restoredStack);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
    });
    return onReadOnlyChange(() => setReadOnly(getReadOnlyReason()));
  }, []);

  return (
    <>
      <Navigator root={<Home />} initial={initial} />
      {/* Never reloads on its own, so a running game is never interrupted. */}
      <Toast show={!!update} onClick={() => update?.()}>
        <strong>Update available</strong>
        <span>Tap to reload</span>
      </Toast>
      {/* Storage problems never delete data; we just stop saving and say so. */}
      <Toast show={!update && !!readOnly} onClick={() => location.reload()}>
        <strong>Progress isn't being saved</strong>
        <span>{readOnly}</span>
      </Toast>
    </>
  );
}
