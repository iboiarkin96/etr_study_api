/**
 * Assemble — entrance slot for Today's block choreography (assemble.css).
 *
 * The orb is the hero (`hero`): it appears first, in place. Every other
 * block flies in from below with a stagger set by `order`, so entrances
 * never cover the orb. Transform-only — a block's layout space exists
 * from the moment it mounts, so nothing below it jumps.
 */

import type { CSSProperties, ReactNode } from 'react';

type Props = {
  /** Stagger position among below-orb blocks (1 = first after the orb). */
  order?: number;
  /** The orb slot: enters first, fade + soft scale, no travel. */
  hero?: boolean;
  children: ReactNode;
};

export function Assemble({ order = 0, hero = false, children }: Props) {
  return (
    <div
      className={hero ? 'tma-assemble--hero' : 'tma-assemble'}
      style={{ '--assemble-order': order } as CSSProperties}
    >
      {children}
    </div>
  );
}
