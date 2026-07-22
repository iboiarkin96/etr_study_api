/**
 * Toast primitive (T-26a).
 *
 * Non-blocking notifications rendered at the bottom of the viewport
 * above the Telegram MainButton safe zone. Three tones (info · success
 * · warning · error), optional single action button, auto-dismiss with
 * a per-toast override, keyboard-safe (role="status" + aria-live per
 * variant), motion-token-driven slide-and-fade. The stack caps at three
 * items — anything older shuffles up and out.
 *
 * Not a substitute for a full popover or a modal — those still live in
 * `WebApp.showPopup` / `WebApp.showAlert` when the user's confirmation
 * is required. Toast is «this thing happened, no confirmation needed».
 *
 * Provider mounts inside `<Providers>` next to the router so any screen
 * can call `useToast().toast({...})` from a mutation callback and get a
 * consistent visual affordance without importing / composing a modal
 * per callsite.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export type ToastInput = {
  /** Body copy. Kept short — one sentence, ~60 chars — since the
   *  surface is transient and the user shouldn't have to read a
   *  paragraph before it disappears. */
  message: string;
  /** Visual + a11y tone. Defaults to `info`. */
  tone?: ToastTone;
  /** Optional single action — «Undo», «Retry», «View». Renders as a
   *  ghost button on the right; tapping fires `onAction` and dismisses
   *  the toast. */
  action?: {
    label: string;
    onAction: () => void;
  };
  /** Auto-dismiss timeout override in ms. Default: 4 s for actionless,
   *  6 s when an action is present (user needs a beat to reach it).
   *  Pass `0` to keep the toast open until the caller dismisses it. */
  durationMs?: number;
};

type Toast = ToastInput & {
  id: string;
  createdAt: number;
};

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  toasts: readonly Toast[];
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_STACK = 3;

function nextId(): string {
  // React 19 has `useId` but this fires from mutation callbacks outside
  // render, so a monotonic counter is the honest way to keep ids stable.
  // Not cryptographically random — collisions would only matter if two
  // toasts landed on the same sub-microsecond, which they can't.
  return `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  // Timer handles per toast id so dismissing one doesn't cancel siblings.
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput): string => {
      const id = nextId();
      const next: Toast = { ...input, id, createdAt: Date.now() };
      setToasts((current) => {
        const kept = current.slice(-1 * (MAX_STACK - 1));
        return [...kept, next];
      });
      const timeoutMs =
        input.durationMs ?? (input.action ? 6_000 : 4_000);
      if (timeoutMs > 0) {
        const handle = window.setTimeout(() => dismiss(id), timeoutMs);
        timersRef.current.set(id, handle);
      }
      return id;
    },
    [dismiss],
  );

  // On unmount, clear any pending dismissal timers so React doesn't complain
  // about updating an unmounted tree if the app is torn down mid-toast.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((handle) => window.clearTimeout(handle));
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toast, dismiss, toasts }),
    [toast, dismiss, toasts],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

/** Read the toast API from context. Throws inside components rendered
 *  outside a `<ToastProvider>` — that's a wiring error, not a legit
 *  fallback surface. */
export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value === null) {
    throw new Error(
      'useToast() must be called inside a <ToastProvider>. Wrap the tree in providers.tsx.',
    );
  }
  return value;
}

/** Presenter — renders the current stack of toasts into a fixed
 *  container at the bottom of the viewport. Mount once, near the app
 *  root, alongside the router. Kept in the same module as the provider
 *  so a caller can `import { ToastProvider, Toaster, useToast }` from
 *  one path without knowing which file each lives in. */
export function Toaster() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div
      className="tma-toaster"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tone = toast.tone ?? 'info';
  const isAssertive = tone === 'error' || tone === 'warning';
  return (
    <div
      className="tma-toast"
      data-tone={tone}
      role="status"
      aria-live={isAssertive ? 'assertive' : 'polite'}
    >
      <div className="tma-toast__body">
        <span className="tma-toast__glyph" aria-hidden="true">
          {tone === 'success' ? '✓' : tone === 'error' ? '!' : tone === 'warning' ? '⚠' : 'i'}
        </span>
        <span className="tma-toast__message">{toast.message}</span>
      </div>
      {toast.action && (
        <button
          type="button"
          className="tma-toast__action"
          onClick={() => {
            toast.action?.onAction();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className="tma-toast__close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
