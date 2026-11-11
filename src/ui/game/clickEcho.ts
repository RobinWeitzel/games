import { useRef } from 'preact/hooks';

/** A click this soon after the finger lifted is the browser's echo of that touch. */
const ECHO_MS = 600;

/**
 * For boards that handle touches on pointerup (fast, and needed for touch and hold or drags) but
 * still listen to `click` for VoiceOver, Switch Control and keyboards. The browser also sends a
 * click after every touch, and that click must not count a second time.
 *
 *   const echo = useClickEcho();
 *   onPointerUp={() => { echo.touched(); … }}   // also onPointerCancel
 *   onClick={(e) => { if (echo.isEcho(e)) return; … }}
 *
 * Uses the time of the last touch rather than a flag cleared by a timer: with a timer, quick
 * repeated taps could clear the flag of the next tap before its click arrived, so one tap
 * counted twice (e.g. drawing two sets of cards from a solitaire stock).
 */
export function useClickEcho() {
  const last = useRef(-Infinity);
  return {
    /** The finger lifted (or the browser took the touch over to scroll). */
    touched() {
      last.current = performance.now();
    },
    isEcho(_e?: Event): boolean {
      return performance.now() - last.current < ECHO_MS;
    },
  };
}
