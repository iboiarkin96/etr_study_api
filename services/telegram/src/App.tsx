export function App() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#f5f5f7',
        background: '#0f0f10',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 320, padding: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 .5rem' }}>study_app</h1>
        <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
          Mini App scaffold — T-05. Providers, screens and Telegram SDK wiring
          arrive in T-06 onwards.
        </p>
      </div>
    </main>
  );
}
