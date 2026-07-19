/**
 * Loading state for the due-cards block — three silhouette rows.
 * Wireframe-only; the real skeleton (with subtle pulse animation) lands
 * in T-15 alongside the real UI.
 */

export function DueCardsSkeleton() {
  const skeletonRow = (opacity: number, i: number) => (
    <div
      key={i}
      style={{
        height: 64,
        background: 'var(--tg-secondary-bg-color, #232e3c)',
        opacity,
        borderRadius: 12,
        marginBottom: 8,
      }}
    />
  );
  return (
    <div style={{ padding: '0.75rem 0' }} aria-label="Due cards loading">
      {skeletonRow(0.9, 0)}
      {skeletonRow(0.65, 1)}
      {skeletonRow(0.4, 2)}
    </div>
  );
}
