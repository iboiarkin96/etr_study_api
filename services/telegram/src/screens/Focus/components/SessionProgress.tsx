/**
 * SessionProgress — top-of-screen row of dots + «N / M» counter for Focus.
 *
 * One dot per queued card; `data-state` maps to `done | active | pending`.
 * Rendered as a compact strip so it never competes with the card itself.
 */

type Props = {
  total: number;
  index: number;
};

export function SessionProgress({ total, index }: Props) {
  return (
    <div className="tma-focus__progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index, total)}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="tma-focus__dot"
          data-state={i < index ? 'done' : i === index ? 'active' : 'pending'}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
