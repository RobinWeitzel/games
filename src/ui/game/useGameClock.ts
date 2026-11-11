import { useEffect, useRef, useState } from 'preact/hooks';
import { useIsTop } from '../nav';

/**
 * Game timer that behaves the way a native game should:
 * - only runs while `active` (game in progress), not paused, and the screen is on top
 * - pauses automatically when the app goes to the background (iOS may kill it any time),
 *   calling `onSuspend` so the game can save
 * - re-renders twice a second while running, for the on-screen time
 */
export function useGameClock(opts: { initialMs: number; active: boolean; onSuspend?: () => void }) {
  const isTop = useIsTop();
  const [paused, setPaused] = useState(false);
  const [, setTick] = useState(0);
  const clock = useRef({ base: opts.initialMs, since: null as number | null });
  const onSuspend = useRef(opts.onSuspend);
  onSuspend.current = opts.onSuspend;
  const active = useRef(opts.active);
  active.current = opts.active;

  const elapsed = () => clock.current.base + (clock.current.since != null ? performance.now() - clock.current.since : 0);
  const running = opts.active && !paused && isTop;

  useEffect(() => {
    if (!running) return;
    clock.current.since = performance.now();
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => {
      clearInterval(t);
      clock.current.base = elapsed();
      clock.current.since = null;
      onSuspend.current?.();
    };
  }, [running]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && active.current) {
        setPaused(true);
        onSuspend.current?.();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  return {
    /** Milliseconds played so far. */
    elapsed,
    paused,
    setPaused,
    /** Stop counting and freeze the time (e.g. on win). Returns the final time. */
    stop() {
      const t = elapsed();
      clock.current = { base: t, since: null };
      return t;
    },
    /** Restart from `ms` (e.g. restarting a puzzle). */
    reset(ms = 0) {
      clock.current = { base: ms, since: running ? performance.now() : null };
      setTick((n) => n + 1);
    },
  };
}
