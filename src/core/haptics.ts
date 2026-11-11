import { settingsStore } from './settings';

/**
 * iOS Safari has no Vibration API. Since iOS 18, toggling an <input type="checkbox" switch>
 * plays the system "selection" haptic, so we keep a hidden one around and click its label.
 * Elsewhere we fall back to navigator.vibrate (Android) or do nothing.
 */
let label: HTMLLabelElement | null = null;

function ensureSwitch(): HTMLLabelElement {
  if (label) return label;
  label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-100px;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);

function pulse(): void {
  if (isIOS) ensureSwitch().click();
  else navigator.vibrate?.(10);
}

export type HapticKind = 'selection' | 'success' | 'error' | 'heavy';

/** Must be called from inside a user gesture (click handler) to work on iOS. */
export function haptic(kind: HapticKind = 'selection'): void {
  if (!settingsStore.get().haptics) return;
  try {
    if (!isIOS && navigator.vibrate) {
      navigator.vibrate({ selection: 8, success: [10, 60, 10], error: [30, 40, 30], heavy: 25 }[kind]);
      return;
    }
    pulse();
    // Multiple ticks for stronger feedback. The switch only fires once per gesture-tick,
    // so space them a little.
    if (kind === 'error' || kind === 'success') setTimeout(pulse, 90);
  } catch {
    /* ignore */
  }
}
