import { settingsStore } from '../core/settings';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function effectiveTheme(): 'light' | 'dark' {
  const t = settingsStore.get().theme;
  return t === 'system' ? (media.matches ? 'dark' : 'light') : t;
}

/** Apply theme to <html> and the status bar colour (theme-color). */
export function applyTheme(): void {
  const theme = effectiveTheme();
  document.documentElement.dataset.theme = theme;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = bg || (theme === 'dark' ? '#000000' : '#f2f2f7');
  document.head.appendChild(meta);
}

export function initTheme(): void {
  applyTheme();
  media.addEventListener('change', applyTheme);
  settingsStore.subscribe(applyTheme);
}
