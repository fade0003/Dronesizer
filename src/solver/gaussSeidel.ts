/**
 * Fixed-point solver with Aitken Δ² (Steffensen) acceleration — SPEC §7.
 * Solves x = g(x) for the battery-mass coupling loop. Returns the full
 * iteration trace for the convergence sparkline.
 *
 * Divergence policy (SPEC §7): monotone residual growth over 10 successive
 * iterations ⇒ 'diverged' ("design does not close" — the battery snowball).
 * Hitting maxIter without convergence also reports 'diverged' (D19).
 */

export interface FixedPointOptions {
  /** Absolute tolerance on x (SPEC: 1e-6 on mBatt). */
  tol?: number;
  /** Maximum g evaluations (SPEC: 60). */
  maxIter?: number;
  /** Aitken Δ² acceleration (SPEC default on; toggle is a P1 feature). */
  aitken?: boolean;
  /** Physical lower bound for x (mass cannot go negative). */
  lowerBound?: number;
  /** Treat iterates beyond this as a snowball (divergence). */
  upperBound?: number;
  /** Consecutive residual-growth iterations that flag divergence. */
  growthWindow?: number;
}

export interface FixedPointResult {
  status: 'converged' | 'diverged';
  /** Best estimate of the fixed point (last iterate). */
  x: number;
  /** Number of g evaluations performed. */
  gEvals: number;
  /** Iterate history (every candidate x), for the sparkline. */
  trace: number[];
}

export function fixedPoint(
  g: (x: number) => number,
  x0: number,
  options?: FixedPointOptions,
): FixedPointResult {
  const tol = options?.tol ?? 1e-6;
  const maxIter = options?.maxIter ?? 60;
  const aitken = options?.aitken ?? true;
  const lowerBound = options?.lowerBound ?? 0;
  const upperBound = options?.upperBound ?? 1e4;
  const growthWindow = options?.growthWindow ?? 10;

  const trace: number[] = [];
  let x = x0;
  let gEvals = 0;
  let lastResidual = Number.POSITIVE_INFINITY;
  let growthStreak = 0;

  const diverged = (): FixedPointResult => ({
    status: 'diverged',
    x,
    gEvals,
    trace,
  });

  // One monitored g evaluation; returns null when the run must stop.
  const step = (
    from: number,
  ): { value: number; converged: boolean } | null => {
    const value = g(from);
    gEvals++;
    trace.push(value);
    if (!Number.isFinite(value) || value > upperBound || value < lowerBound) {
      return null;
    }
    const residual = Math.abs(value - from);
    if (residual >= lastResidual) {
      growthStreak++;
    } else {
      growthStreak = 0;
    }
    lastResidual = residual;
    if (growthStreak >= growthWindow) return null;
    return { value, converged: residual < tol };
  };

  while (gEvals < maxIter) {
    const s1 = step(x);
    if (!s1) return diverged();
    if (s1.converged) return { status: 'converged', x: s1.value, gEvals, trace };
    const x1 = s1.value;

    if (gEvals >= maxIter) break;
    const s2 = step(x1);
    if (!s2) return diverged();
    if (s2.converged) return { status: 'converged', x: s2.value, gEvals, trace };
    const x2 = s2.value;

    if (aitken) {
      // Aitken Δ²: x* ≈ x − (Δx)² / Δ²x
      const denom = x2 - 2 * x1 + x;
      if (Math.abs(denom) > Number.EPSILON) {
        const accelerated = x - (x1 - x) ** 2 / denom;
        x = Number.isFinite(accelerated)
          ? Math.min(Math.max(accelerated, lowerBound), upperBound)
          : x2;
      } else {
        x = x2;
      }
      trace.push(x);
    } else {
      x = x2;
    }
  }

  return diverged();
}
