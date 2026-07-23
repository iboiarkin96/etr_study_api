/**
 * Haptic vocabulary — the seven patterns every TMA screen speaks (T-25c).
 *
 * Wraps `window.Telegram.WebApp.HapticFeedback.*` so callers don't reach
 * into the SDK ambient global directly. The Telegram HapticFeedback API
 * itself is the same shape in the injected WebView, in our
 * `mock-telegram-env.ts` dev shim, and (as a no-op) in vitest — so a
 * missing SDK is a legitimate runtime state, not an error. If the shim
 * throws (some Android WebViews cough on unsupported patterns) we swallow
 * the exception: haptic feedback is decorative acknowledgement, never
 * load-bearing behaviour.
 *
 * Patterns are named for what they *mean*, not for the SDK call they map
 * onto — `impactMedium` isn't the interesting bit at the call site;
 * «swipe committed» is. See the `haptic()` docstring for the mapping
 * table and the reference page at
 * services/portal/internal/services/telegram/reference/components/haptics.html
 * for the full call-site catalogue.
 */

export type HapticTone =
  /** Discrete list highlight, tab change, spotlight open. Softest tone. */
  | 'selection'
  /** Primary button press, minor confirm (e.g. Focus reveal ack). */
  | 'impactLight'
  /** Decisive tap — swipe commit, «Log a miss» press. */
  | 'impactMedium'
  /** Destructive confirm, missed-card acknowledgement in Focus (Again). */
  | 'impactHeavy'
  /** Save landed, streak advanced, Focus session complete. */
  | 'notifySuccess'
  /** Soft error — rate-limited, throttled, retry-recommended. */
  | 'notifyWarning'
  /** Hard error — save failed, mutation rolled back. */
  | 'notifyError';

type TelegramHapticFeedback = {
  impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
  notificationOccurred: (type: 'success' | 'warning' | 'error') => void;
  selectionChanged: () => void;
};

function readSdk(): TelegramHapticFeedback | null {
  if (typeof window === 'undefined') return null;
  const wa = (window as { Telegram?: { WebApp?: { HapticFeedback?: TelegramHapticFeedback } } })
    .Telegram?.WebApp?.HapticFeedback;
  return wa ?? null;
}

/**
 * Fire a haptic pattern. Silently no-ops when no SDK is present, when the
 * shim throws, and in SSR. Never blocks or returns anything meaningful —
 * callers can fire-and-forget.
 */
export function haptic(tone: HapticTone): void {
  const sdk = readSdk();
  if (!sdk) return;
  try {
    switch (tone) {
      case 'selection':
        sdk.selectionChanged();
        return;
      case 'impactLight':
        sdk.impactOccurred('light');
        return;
      case 'impactMedium':
        sdk.impactOccurred('medium');
        return;
      case 'impactHeavy':
        sdk.impactOccurred('heavy');
        return;
      case 'notifySuccess':
        sdk.notificationOccurred('success');
        return;
      case 'notifyWarning':
        sdk.notificationOccurred('warning');
        return;
      case 'notifyError':
        sdk.notificationOccurred('error');
        return;
    }
  } catch {
    // Some WebViews throw on unsupported patterns; haptics are decorative.
  }
}
