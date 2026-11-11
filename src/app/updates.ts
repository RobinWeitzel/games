import { registerSW } from 'virtual:pwa-register';

/**
 * Service worker updates.
 *
 * Browsers only look for a new version when the page loads. iOS almost never reloads a home
 * screen app: switching back to it resumes the old page from memory. So we also check
 * whenever the app returns to the foreground, and hourly while it stays open.
 *
 * A found update is never applied on its own (a running game must not reload); the shell
 * shows a toast and the player taps it.
 */
const HOURLY = 60 * 60 * 1000;
/** Don't hit the network on every quick app switch. */
const MIN_INTERVAL = 60 * 1000;

export function watchForUpdates(onUpdate: (apply: () => void) => void): void {
  const updateSW = registerSW({
    onNeedRefresh: () => onUpdate(() => void updateSW(true)),
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      let last = Date.now();
      const check = () => {
        if (Date.now() - last < MIN_INTERVAL || !navigator.onLine) return;
        last = Date.now();
        registration.update().catch(() => {}); // offline or flaky network: try again next time
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, HOURLY);
    },
  });
}
