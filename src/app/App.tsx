import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { Navigator } from '../ui/nav';
import { Home } from './screens/Home';
import { Toast } from '../ui/components';
import { getReadOnlyReason, onReadOnlyChange } from '../core/storage';

export function App() {
  const [update, setUpdate] = useState<null | (() => void)>(null);
  const [readOnly, setReadOnly] = useState(getReadOnlyReason());

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
    });
    return onReadOnlyChange(() => setReadOnly(getReadOnlyReason()));
  }, []);

  return (
    <>
      <Navigator root={<Home />} />
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
