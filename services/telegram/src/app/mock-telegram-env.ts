/**
 * Install a fake `window.Telegram.WebApp` so the app boots outside real
 * Telegram (plain browser dev loop).
 *
 * Called from `main.tsx` before React mounts. No-op when a real Telegram
 * WebView already injected the object (detected by the presence of
 * `window.Telegram.WebApp.initData` — real Telegram sets a non-empty string;
 * an accidentally-executed second call from our own code would not).
 *
 * Under the shipped W1 auth contract the client will additionally need a
 * signed `initData` string minted by `tools/dev/sign_init_data.py`; that is
 * consumed by the auth bootstrap (T-12), not by this shim. Here we only
 * populate what the theme + viewport providers read.
 */

type ThemeParams = {
  bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  secondary_bg_color: string;
  header_bg_color: string;
  accent_text_color: string;
  section_bg_color: string;
  section_header_text_color: string;
  subtitle_text_color: string;
  destructive_text_color: string;
};

type ColorScheme = 'light' | 'dark';

type WebAppButton = {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

type MockWebApp = {
  version: string;
  platform: string;
  colorScheme: ColorScheme;
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset: { top: number; bottom: number; left: number; right: number };
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  ready: () => void;
  expand: () => void;
  close: () => void;
  onEvent: (event: string, cb: (...args: unknown[]) => void) => void;
  offEvent: (event: string, cb: (...args: unknown[]) => void) => void;
  BackButton: WebAppButton;
  MainButton: WebAppButton & { setText: (text: string) => void };
  SettingsButton: WebAppButton;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'success' | 'warning' | 'error') => void;
    selectionChanged: () => void;
  };
  CloudStorage: {
    setItem: (key: string, value: string, cb?: (err: Error | null) => void) => void;
    getItem: (key: string, cb: (err: Error | null, value: string | null) => void) => void;
    getKeys: (cb: (err: Error | null, keys: string[]) => void) => void;
    removeItem: (key: string, cb?: (err: Error | null) => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp: MockWebApp };
  }
}

const LIGHT_THEME: ThemeParams = {
  bg_color: '#ffffff',
  text_color: '#000000',
  hint_color: '#707579',
  link_color: '#3390ec',
  button_color: '#3390ec',
  button_text_color: '#ffffff',
  secondary_bg_color: '#f4f4f5',
  header_bg_color: '#ffffff',
  accent_text_color: '#3390ec',
  section_bg_color: '#ffffff',
  section_header_text_color: '#6d6d71',
  subtitle_text_color: '#8e8e93',
  destructive_text_color: '#eb5545',
};

const DARK_THEME: ThemeParams = {
  bg_color: '#17212b',
  text_color: '#f5f5f5',
  hint_color: '#708499',
  link_color: '#6ab3f3',
  button_color: '#5288c1',
  button_text_color: '#ffffff',
  secondary_bg_color: '#232e3c',
  header_bg_color: '#17212b',
  accent_text_color: '#6ab3f3',
  section_bg_color: '#17212b',
  section_header_text_color: '#8697a5',
  subtitle_text_color: '#708499',
  destructive_text_color: '#ec3942',
};

function _noopButton(): WebAppButton {
  return {
    isVisible: false,
    show: () => {},
    hide: () => {},
    onClick: () => {},
    offClick: () => {},
  };
}

function buildMockWebApp(): MockWebApp {
  const isDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const scheme: ColorScheme = isDark ? 'dark' : 'light';
  const height = typeof window !== 'undefined' ? window.innerHeight : 812;

  const cloudStore = new Map<string, string>();

  return {
    version: '7.0',
    platform: 'weba',
    colorScheme: scheme,
    themeParams: scheme === 'dark' ? DARK_THEME : LIGHT_THEME,
    isExpanded: true,
    viewportHeight: height,
    viewportStableHeight: height,
    safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    initData: '',
    initDataUnsafe: {},
    ready: () => {},
    expand: () => {},
    close: () => {},
    onEvent: () => {},
    offEvent: () => {},
    BackButton: _noopButton(),
    MainButton: { ..._noopButton(), setText: () => {} },
    SettingsButton: _noopButton(),
    HapticFeedback: {
      impactOccurred: () => {},
      notificationOccurred: () => {},
      selectionChanged: () => {},
    },
    CloudStorage: {
      setItem: (key, value, cb) => {
        cloudStore.set(key, value);
        cb?.(null);
      },
      getItem: (key, cb) => cb(null, cloudStore.get(key) ?? null),
      getKeys: (cb) => cb(null, [...cloudStore.keys()]),
      removeItem: (key, cb) => {
        cloudStore.delete(key);
        cb?.(null);
      },
    },
  };
}

/**
 * Install the mock. Idempotent; no-op inside real Telegram (which sets
 * `initData` to a non-empty signed string).
 */
export function installTelegramMock(): void {
  if (typeof window === 'undefined') return;
  const existing = window.Telegram?.WebApp;
  if (existing && existing.initData !== '') {
    // Real Telegram — leave it alone.
    return;
  }
  window.Telegram = { WebApp: buildMockWebApp() };
}
