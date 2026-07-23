/**
 * Skeleton for the due-cards block. Renders three placeholder rows inside a
 * `.tma-section__plate` so the layout doesn't jump when data arrives.
 */

export function DueCardsSkeleton() {
  const row = (i: number) => (
    <div
      key={i}
      className="tma-cell"
      aria-hidden="true"
      style={{ opacity: 0.7 - i * 0.15, cursor: 'default' }}
    >
      <div
        className="tma-cell__icon"
        data-tone="accent"
        style={{ background: 'var(--tma-border-soft)' }}
      />
      <div className="tma-cell__main">
        <div
          className="tma-cell__title"
          style={{
            background: 'var(--tma-border-soft)',
            height: 14,
            borderRadius: 'var(--tma-rad-1)',
            width: '65%',
          }}
        />
        <div
          className="tma-cell__subtitle"
          style={{
            background: 'var(--tma-border-soft)',
            height: 10,
            borderRadius: 'var(--tma-rad-1)',
            width: '35%',
            marginTop: 6,
          }}
        />
      </div>
    </div>
  );
  return (
    <div className="tma-section__plate" aria-label="Loading">
      {row(0)}
      {row(1)}
      {row(2)}
    </div>
  );
}
