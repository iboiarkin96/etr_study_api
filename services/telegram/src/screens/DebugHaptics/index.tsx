/**
 * /debug/haptics — hand-testing surface for the seven-tone vocabulary
 * (T-25c).
 *
 * Top of the page: a diagnostic panel that reports whether the Telegram
 * SDK is actually reachable — platform, version, initData presence,
 * HapticFeedback availability. When haptics don't fire on-device, this
 * panel answers «is my code broken, is the SDK broken, or is the phone
 * muted?» without a fresh git checkout.
 *
 * Below: one row per HapticTone. Row briefly flashes on tap so the user
 * has a visual confirmation the click landed even if the vibration
 * doesn't (system haptics off, old Telegram build, etc.). The row also
 * surfaces any exception the SDK threw — so a wrapped-and-swallowed
 * failure becomes readable instead of vanishing into `console.debug`.
 */

import { useEffect, useState } from 'react';

import { haptic, type HapticTone } from '../../shared/haptics/haptics';

type Row = {
  tone: HapticTone;
  title: string;
  hint: string;
  emphasis: 'quiet' | 'warm' | 'danger';
};

const ROWS: readonly Row[] = [
  { tone: 'selection', title: 'selection', hint: 'Tab / list highlight — softest tick', emphasis: 'quiet' },
  { tone: 'impactLight', title: 'impactLight', hint: 'Primary button press · Reveal ack', emphasis: 'quiet' },
  { tone: 'impactMedium', title: 'impactMedium', hint: 'Swipe commit · Hard grade', emphasis: 'warm' },
  { tone: 'impactHeavy', title: 'impactHeavy', hint: 'Miss acknowledgement · Again', emphasis: 'danger' },
  { tone: 'notifySuccess', title: 'notifySuccess', hint: 'Save landed · Session complete', emphasis: 'warm' },
  { tone: 'notifyWarning', title: 'notifyWarning', hint: 'Soft error · rate-limit', emphasis: 'warm' },
  { tone: 'notifyError', title: 'notifyError', hint: 'Save failed · rollback', emphasis: 'danger' },
];

type Diagnostic = {
  hasTelegram: boolean;
  hasWebApp: boolean;
  hasHaptic: boolean;
  hasImpact: boolean;
  hasNotification: boolean;
  hasSelection: boolean;
  platform: string;
  version: string;
  initDataPresent: boolean;
  colorScheme: string;
  isMock: boolean;
};

function readDiagnostic(): Diagnostic {
  const w = window as {
    Telegram?: {
      WebApp?: {
        platform?: string;
        version?: string;
        initData?: string;
        colorScheme?: string;
        HapticFeedback?: {
          impactOccurred?: unknown;
          notificationOccurred?: unknown;
          selectionChanged?: unknown;
        };
      };
    };
  };
  const wa = w.Telegram?.WebApp;
  const hf = wa?.HapticFeedback;
  return {
    hasTelegram: !!w.Telegram,
    hasWebApp: !!wa,
    hasHaptic: !!hf,
    hasImpact: typeof hf?.impactOccurred === 'function',
    hasNotification: typeof hf?.notificationOccurred === 'function',
    hasSelection: typeof hf?.selectionChanged === 'function',
    platform: wa?.platform ?? '—',
    version: wa?.version ?? '—',
    initDataPresent: !!wa?.initData && wa.initData !== '',
    colorScheme: wa?.colorScheme ?? '—',
    isMock: !!wa?.initData && wa.initData === '',
  };
}

/** Fires the haptic OUTSIDE the wrapper's try/catch so exceptions surface
 * on the page instead of silently landing in console.debug. */
function fireRaw(tone: HapticTone): { ok: boolean; error?: string } {
  const w = window as {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
          notificationOccurred: (type: 'success' | 'warning' | 'error') => void;
          selectionChanged: () => void;
        };
      };
    };
  };
  const hf = w.Telegram?.WebApp?.HapticFeedback;
  if (!hf) return { ok: false, error: 'no HapticFeedback API' };
  try {
    switch (tone) {
      case 'selection': hf.selectionChanged(); return { ok: true };
      case 'impactLight': hf.impactOccurred('light'); return { ok: true };
      case 'impactMedium': hf.impactOccurred('medium'); return { ok: true };
      case 'impactHeavy': hf.impactOccurred('heavy'); return { ok: true };
      case 'notifySuccess': hf.notificationOccurred('success'); return { ok: true };
      case 'notifyWarning': hf.notificationOccurred('warning'); return { ok: true };
      case 'notifyError': hf.notificationOccurred('error'); return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function DebugHaptics() {
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [flashed, setFlashed] = useState<HapticTone | null>(null);
  const [lastResult, setLastResult] = useState<{ tone: HapticTone; ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    setDiag(readDiagnostic());
    // Refresh a few times during the first 3 seconds — on some builds the
    // SDK properties (initData, HapticFeedback subobject) land a tick after
    // WebApp injection. A one-shot read on mount can misreport «missing».
    const timers = [500, 1500, 3000].map((delay) =>
      window.setTimeout(() => setDiag(readDiagnostic()), delay),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  const onFire = (tone: HapticTone) => {
    // Route through the production wrapper so devtools log matches app usage,
    // and also fire raw so any thrown exception surfaces on the page.
    haptic(tone);
    const raw = fireRaw(tone);
    setLastResult({ tone, ...raw });
    setFlashed(tone);
    window.setTimeout(() => setFlashed((v) => (v === tone ? null : v)), 250);
  };

  return (
    <main
      className="tma-scope"
      data-density="regular"
      style={{
        minHeight: 'var(--tma-viewport-h, 100dvh)',
        paddingTop: 'var(--tma-safe-top, 0)',
        paddingBottom: 'var(--tma-safe-bottom, 0)',
        background: 'var(--tma-surface-canvas)',
        color: 'var(--tma-text-primary)',
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--tma-sp-6) var(--tma-sp-4) var(--tma-sp-12)' }}>
        <header style={{ marginBottom: 'var(--tma-sp-5)' }}>
          <h1
            style={{
              fontSize: 'var(--tma-fs-h2)',
              fontWeight: 'var(--tma-fw-bold)',
              letterSpacing: '-0.02em',
              margin: '0 0 var(--tma-sp-2)',
            }}
          >
            Haptic vocabulary
          </h1>
          <p style={{ color: 'var(--tma-text-tertiary)', fontSize: 'var(--tma-fs-small)', margin: 0 }}>
            Tap a row to fire the tone. Row flashes for 250 ms so you can tell
            a landed click apart from a stuck one — the vibration is separate.
          </p>
        </header>

        {diag && <DiagnosticCard diag={diag} onRefresh={() => setDiag(readDiagnostic())} />}
        {lastResult && <LastResultCard result={lastResult} />}

        <section className="tma-section" aria-labelledby="tones-h" style={{ marginTop: 'var(--tma-sp-5)' }}>
          <div className="tma-section__header" id="tones-h">7 tones</div>
          <div className="tma-section__plate">
            {ROWS.map((row) => {
              const isFlashed = flashed === row.tone;
              return (
                <button
                  key={row.tone}
                  type="button"
                  className="tma-cell"
                  onClick={() => onFire(row.tone)}
                  style={{
                    width: '100%',
                    border: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 180ms ease',
                    background: isFlashed
                      ? 'color-mix(in oklab, var(--tma-tone-accent) 22%, transparent)'
                      : 'transparent',
                  }}
                >
                  <div
                    className="tma-cell__icon"
                    data-tone={row.emphasis === 'danger' ? 'danger' : row.emphasis === 'warm' ? 'warn' : 'accent'}
                  >
                    ✧
                  </div>
                  <div className="tma-cell__main">
                    <div className="tma-cell__title" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                      {row.title}
                    </div>
                    <div className="tma-cell__meta">{row.hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function DiagnosticCard({ diag, onRefresh }: { diag: Diagnostic; onRefresh: () => void }) {
  const rows: Array<[string, string, 'ok' | 'bad' | 'info']> = [
    ['window.Telegram', diag.hasTelegram ? 'present' : 'MISSING', diag.hasTelegram ? 'ok' : 'bad'],
    ['WebApp', diag.hasWebApp ? 'present' : 'MISSING', diag.hasWebApp ? 'ok' : 'bad'],
    ['HapticFeedback', diag.hasHaptic ? 'present' : 'MISSING', diag.hasHaptic ? 'ok' : 'bad'],
    ['impactOccurred()', diag.hasImpact ? 'callable' : 'missing', diag.hasImpact ? 'ok' : 'bad'],
    ['notificationOccurred()', diag.hasNotification ? 'callable' : 'missing', diag.hasNotification ? 'ok' : 'bad'],
    ['selectionChanged()', diag.hasSelection ? 'callable' : 'missing', diag.hasSelection ? 'ok' : 'bad'],
    ['platform', diag.platform, 'info'],
    ['version', diag.version, 'info'],
    [
      'initData',
      diag.isMock
        ? 'empty (dev shim — you are NOT in real Telegram)'
        : diag.initDataPresent
          ? 'present (real Telegram)'
          : 'missing',
      diag.isMock ? 'bad' : diag.initDataPresent ? 'ok' : 'bad',
    ],
    ['colorScheme', diag.colorScheme, 'info'],
  ];
  return (
    <section className="tma-section" aria-labelledby="diag-h">
      <div className="tma-section__header" id="diag-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Environment</span>
        <button
          type="button"
          onClick={onRefresh}
          style={{
            border: 0,
            background: 'transparent',
            color: 'var(--tma-tone-accent)',
            fontSize: 'var(--tma-fs-micro)',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            cursor: 'pointer',
            padding: '2px 8px',
          }}
        >
          refresh
        </button>
      </div>
      <div className="tma-section__plate">
        {rows.map(([k, v, tone]) => (
          <div className="tma-cell" key={k} style={{ cursor: 'default' }}>
            <div
              className="tma-cell__icon"
              data-tone={tone === 'ok' ? 'success' : tone === 'bad' ? 'danger' : 'accent'}
            >
              {tone === 'ok' ? '✓' : tone === 'bad' ? '!' : 'i'}
            </div>
            <div className="tma-cell__main">
              <div className="tma-cell__title" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                {k}
              </div>
              <div className="tma-cell__meta">{v}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LastResultCard({ result }: { result: { tone: HapticTone; ok: boolean; error?: string } }) {
  return (
    <section className="tma-section" aria-labelledby="last-h" style={{ marginTop: 'var(--tma-sp-4)' }}>
      <div className="tma-section__header" id="last-h">Last call</div>
      <div className="tma-section__plate">
        <div className="tma-cell" style={{ cursor: 'default' }}>
          <div
            className="tma-cell__icon"
            data-tone={result.ok ? 'success' : 'danger'}
          >
            {result.ok ? '✓' : '!'}
          </div>
          <div className="tma-cell__main">
            <div className="tma-cell__title" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
              {result.tone}
            </div>
            <div className="tma-cell__meta">
              {result.ok
                ? 'SDK call returned without error — if no vibration, check system haptics settings.'
                : `SDK error: ${result.error ?? 'unknown'}`}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
