/**
 * Light/Dark follows the system appearance only (HIG: no app-specific appearance setting).
 * CSS tokens switch on [data-theme]; the status bar colour comes from the media-dependent
 * theme-color metas in index.html.
 */
const media = window.matchMedia('(prefers-color-scheme: dark)');

function apply(): void {
  document.documentElement.dataset.theme = media.matches ? 'dark' : 'light';
}

export function initTheme(): void {
  apply();
  media.addEventListener('change', apply);
}
