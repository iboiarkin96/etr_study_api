/**
 * Placeholder for the Today screen — the real UI lands in W3 · T-14 / T-15.
 * For T-11 this proves the router mounts and reads through the theme +
 * viewport CSS variables end-to-end.
 */

export function Today() {
  return (
    <main
      style={{
        minHeight: 'var(--tma-viewport-h, 100dvh)',
        paddingTop: 'var(--tma-safe-top, 0)',
        paddingBottom: 'var(--tma-safe-bottom, 0)',
        background: 'var(--tg-bg-color, #0f0f10)',
        color: 'var(--tg-text-color, #f5f5f7)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 320, padding: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 .5rem' }}>study_app</h1>
        <p
          style={{
            opacity: 0.6,
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--tg-hint-color, #707579)',
          }}
        >
          Привет 👋 Скоро тут будет твой день.
        </p>
      </div>
    </main>
  );
}
