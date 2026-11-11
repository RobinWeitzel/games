import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { Navigator } from './nav';
import { Home } from './screens/Home';
import { Toast } from '../ui/components';

export function App() {
  const [update, setUpdate] = useState<null | (() => void)>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
    });
  }, []);

  return (
    <>
      <Navigator root={<Home />} />
      {/* Never reloads on its own, so a running game is never interrupted. */}
      <Toast show={!!update} onClick={() => update?.()}>
        <strong>Update available</strong>
        <span>Tap to reload</span>
      </Toast>
    </>
  );
}
