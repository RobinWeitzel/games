import { render } from 'preact';
import { initStorage, requestPersistence } from './core/storage';
import { App } from './app/App';
import { initTheme } from './app/theme';
import { GAMES, validateRegistry } from './games/registry';
import './styles/base.css';
import './styles/app.css';

// 1. Upgrade stored data to the current layout BEFORE anything reads it.
initStorage();
requestPersistence();
validateRegistry();
initTheme();

// Enables :active styles on iOS so buttons react the moment they're touched.
document.addEventListener('touchstart', () => {}, { passive: true });
// Block pinch-zoom gestures (iOS ignores user-scalable=no in some cases).
document.addEventListener('gesturestart', (e) => e.preventDefault());

render(<App />, document.getElementById('app')!);

// Let games warm caches once the UI is up.
const idle = (window as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb) => setTimeout(cb, 1500));
idle(() => GAMES.forEach((g) => g.prefetch?.()));
