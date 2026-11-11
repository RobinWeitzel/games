import { render } from 'preact';
import { App } from './app/App';
import { initTheme } from './app/theme';
import { requestPersistence } from './core/storage';
import { prefetchAll } from './games/sudoku/puzzles';
import './styles/base.css';
import './styles/app.css';
import './games/sudoku/ui/sudoku.css';

initTheme();
requestPersistence();

// Enables :active styles on iOS so buttons react the moment they're touched.
document.addEventListener('touchstart', () => {}, { passive: true });
// Block pinch-zoom gestures (iOS ignores user-scalable=no in some cases).
document.addEventListener('gesturestart', (e) => e.preventDefault());

render(<App />, document.getElementById('app')!);
prefetchAll();
