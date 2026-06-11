/**
 * 2-objective non-dominance filter — SPEC §8, O(n log n).
 * Sort by the first objective, sweep keeping the running best of the
 * second; survivors are the Pareto front, returned ordered along the front.
 */

export type Direction = 'min' | 'max';

export interface ParetoPoint {
  id: string;
  x: number;
  y: number;
}

export function paretoFront(
  points: ParetoPoint[],
  xDir: Direction,
  yDir: Direction,
): string[] {
  const usable = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  // Normalize to minimize–minimize space.
  const sx = xDir === 'min' ? 1 : -1;
  const sy = yDir === 'min' ? 1 : -1;
  const sorted = [...usable].sort(
    (a, b) => sx * a.x - sx * b.x || sy * a.y - sy * b.y,
  );
  const front: string[] = [];
  let bestY = Number.POSITIVE_INFINITY;
  for (const p of sorted) {
    const y = sy * p.y;
    if (y < bestY) {
      front.push(p.id);
      bestY = y;
    }
  }
  return front;
}
