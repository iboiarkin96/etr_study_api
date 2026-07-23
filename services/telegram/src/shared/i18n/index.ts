/**
 * i18next bootstrap.
 *
 * Resources are inlined (no HTTP backend) because the Mini App bundle is one
 * request and Telegram's WebView has no cache warm-up we can exploit. Default
 * language is English; the AuthProvider swaps to the user's Telegram
 * `language_code` once the handshake resolves — see `switchLanguageFromLocale`.
 *
 * BCP-47 codes from Telegram (`en-US`, `ru-RU`) are trimmed to the base tag
 * (`en`, `ru`) before switching, so region variants don't fall through to the
 * fallback for no reason.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ru from './ru.json';

export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const OVERRIDE_KEY = 'lang.override';

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readOverride(): SupportedLanguage | null {
  const raw = safeStorage()?.getItem(OVERRIDE_KEY);
  if (!raw) return null;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(raw)
    ? (raw as SupportedLanguage)
    : null;
}

export function setLanguageOverride(lang: SupportedLanguage): void {
  safeStorage()?.setItem(OVERRIDE_KEY, lang);
}

export function clearLanguageOverride(): void {
  safeStorage()?.removeItem(OVERRIDE_KEY);
}

let initialised = false;

export function initI18n(): typeof i18n {
  if (initialised) return i18n;
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    lng: readOverride() ?? DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  initialised = true;
  return i18n;
}

/**
 * Switch the active language based on a Telegram `language_code` (or the
 * cached user `locale`). Silently ignores unsupported codes so we keep the
 * current language instead of dropping to fallback mid-session. A user's
 * manual override (from `LangSwitch`) wins over this — the handshake stops
 * clobbering the choice until the user explicitly clears it.
 */
export function switchLanguageFromLocale(locale: string | null | undefined): void {
  if (readOverride()) return;
  if (!locale) return;
  const base = locale.toLowerCase().split('-')[0] as SupportedLanguage;
  if (!SUPPORTED_LANGUAGES.includes(base)) return;
  if (i18n.language === base) return;
  void i18n.changeLanguage(base);
}

export default i18n;
