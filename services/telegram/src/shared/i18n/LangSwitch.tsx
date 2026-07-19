/**
 * In-header EN / RU toggle.
 *
 * Two-line ambition: the toggle overrides the language the auth handshake
 * derives from `initData.language_code`, and the choice survives a reload
 * (stored in `localStorage`, read back at i18n init and again by
 * `switchLanguageFromLocale`). To go back to «follow Telegram», the user
 * long-presses the currently active tag — see `onContextMenu`.
 */

import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES, clearLanguageOverride, setLanguageOverride } from './index';
import type { SupportedLanguage } from './index';

export function LangSwitch() {
  const { i18n } = useTranslation();
  const active = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage;

  const onClick = (lang: SupportedLanguage) => () => {
    if (lang === active) return;
    setLanguageOverride(lang);
    void i18n.changeLanguage(lang);
  };

  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    clearLanguageOverride();
    // Language stays as-is until the next auth handshake re-applies
    // whatever `initData.language_code` says.
  };

  return (
    <div
      role="group"
      aria-label="Language"
      title="Right-click / long-press to clear the override and follow Telegram."
      onContextMenu={onContextMenu}
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 2,
        borderRadius: 999,
        background: 'var(--tg-secondary-bg-color, #232e3c)',
        fontSize: '0.7rem',
        letterSpacing: '0.05em',
        fontWeight: 600,
      }}
    >
      {SUPPORTED_LANGUAGES.map((code) => {
        const isActive = code === active;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={isActive}
            onClick={onClick(code)}
            style={{
              minWidth: 28,
              padding: '2px 8px',
              borderRadius: 999,
              border: 'none',
              cursor: isActive ? 'default' : 'pointer',
              background: isActive
                ? 'var(--tg-button-color, #3390ec)'
                : 'transparent',
              color: isActive
                ? 'var(--tg-button-text-color, #ffffff)'
                : 'var(--tg-hint-color, #708499)',
              textTransform: 'uppercase',
            }}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
