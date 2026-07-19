/**
 * Full-screen error state.
 *
 * Shown when the whole app can't proceed — auth handshake failed, server
 * unreachable, etc. Different from `ErrorInline` (which is a single-block
 * error for a partial hook failure); this one occupies the entire
 * viewport, matches the calm-but-signal design of the empty state, and
 * carries the retry as its only primary action.
 *
 * Visual — a broken orb (grey ring + orange offset dot) that echoes the
 * Today streak orb in absence: something signature is broken. All motion
 * respects `prefers-reduced-motion`.
 */

type Props = {
  title: string;
  body?: string;
  ctaLabel: string;
  onRetry: () => void;
};

export function ErrorScreen({ title, body, ctaLabel, onRetry }: Props) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        minHeight: 'var(--tma-viewport-h, 100dvh)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--tma-sp-8) var(--tma-sp-6)',
      }}
    >
      <div
        style={{
          maxWidth: 360,
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--tma-sp-4)',
        }}
      >
        <BrokenOrb />

        <h1
          style={{
            fontSize: 'var(--tma-fs-h2)',
            fontWeight: 'var(--tma-fw-heavy)',
            letterSpacing: '-0.02em',
            color: 'var(--tma-text-primary)',
            margin: 0,
            lineHeight: 'var(--tma-lh-tight)',
          }}
        >
          {title}
        </h1>

        {body && (
          <p
            style={{
              fontSize: 'var(--tma-fs-body)',
              lineHeight: 'var(--tma-lh-normal)',
              color: 'var(--tma-text-tertiary)',
              margin: 0,
              maxWidth: 300,
            }}
          >
            {body}
          </p>
        )}

        <button
          type="button"
          onClick={onRetry}
          className="tma-btn tma-btn--primary tma-btn--block"
          style={{
            marginTop: 'var(--tma-sp-2)',
            maxWidth: 240,
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

/** SVG placeholder — a grey ring with an ember-tinted offset dot suggesting
 *  a broken / off-axis connection. Static; no motion in-file. */
function BrokenOrb() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      role="img"
      aria-hidden="true"
      style={{ marginBottom: 'var(--tma-sp-2)' }}
    >
      <defs>
        <radialGradient id="broken-orb-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--tma-ember-400)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--tma-ember-400)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft glow behind the ring */}
      <circle cx="60" cy="60" r="55" fill="url(#broken-orb-glow)" />

      {/* Broken outer ring — dashed to signal disconnection */}
      <circle
        cx="60"
        cy="60"
        r="42"
        fill="none"
        stroke="var(--tma-border-bold)"
        strokeWidth="3"
        strokeDasharray="8 6"
        strokeLinecap="round"
        transform="rotate(-15 60 60)"
      />

      {/* Small ember dot offset from center — the signal that «something
       *  is off» without going full sad-face. */}
      <circle
        cx="76"
        cy="52"
        r="6"
        fill="var(--tma-ember-500)"
      />
      <circle
        cx="76"
        cy="52"
        r="10"
        fill="none"
        stroke="var(--tma-ember-500)"
        strokeWidth="1.5"
        strokeOpacity="0.4"
      />
    </svg>
  );
}
