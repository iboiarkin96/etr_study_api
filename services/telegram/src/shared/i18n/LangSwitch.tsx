/**
 * In-header EN / RU toggle — built on the kit's `.tma-btn` primitives so
 * the pill matches every other action in the app (density, radius, font).
 *
 * The active language is `.tma-btn--tinted[data-tone="accent"]`; inactive
 * is `.tma-btn--ghost`. Right-click / long-press on the active pill
 * clears the manual override so the next auth handshake reads Telegram's
 * `initData.language_code` again.
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
        gap: 'var(--tma-sp-1)',
        padding: 2,
        borderRadius: 'var(--tma-rad-full)',
        background: 'var(--tma-surface-plate)',
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
            className={
              isActive
                ? 'tma-btn tma-btn--tinted'
                : 'tma-btn tma-btn--ghost'
            }
            data-tone={isActive ? 'accent' : undefined}
            style={{
              minWidth: 40,
              minHeight: 0,
              padding: '4px 10px',
              fontSize: 'var(--tma-fs-micro)',
              fontWeight: 'var(--tma-fw-semi)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              borderRadius: 'var(--tma-rad-full)',
            }}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
