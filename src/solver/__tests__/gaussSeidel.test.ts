import { describe, expect, it } from 'vitest';
import { fixedPoint } from '../gaussSeidel';

describe('fixedPoint solver (SPEC §7)', () => {
  it('converges on a classic contraction (cos x)', () => {
    const result = fixedPoint(Math.cos, 1.0, { tol: 1e-9, maxIter: 60 });
    expect(result.status).toBe('converged');
    expect(result.x).toBeCloseTo(0.7390851332, 8);
  });

  it('Aitken accelerates a slow contraction', () => {
    // g'(x*) ≈ 0.9 — plain iteration needs ~100+ evals at 1e-8.
    const g = (x: number) => 0.9 * x + 0.5;
    const accelerated = fixedPoint(g, 0, { tol: 1e-8, maxIter: 60 });
    expect(accelerated.status).toBe('converged');
    expect(accelerated.x).toBeCloseTo(5.0, 6);
    expect(accelerated.gEvals).toBeLessThan(10);

    const plain = fixedPoint(g, 0, { tol: 1e-8, maxIter: 60, aitken: false });
    expect(plain.status).toBe('diverged'); // runs out of its 60 evals
  });

  it('flags the battery snowball (no fixed point) as diverged', () => {
    // Superlinear growth with g(x) > x everywhere — the SPEC §7 snowball.
    const g = (x: number) => 0.36 + 1.8 * Math.pow(x + 0.3, 1.5);
    const result = fixedPoint(g, 0.1, { tol: 1e-6, maxIter: 60 });
    expect(result.status).toBe('diverged');
    expect(result.trace.length).toBeGreaterThan(0);
  });

  it('flags non-finite and runaway iterates as diverged', () => {
    expect(fixedPoint((x) => x * 1e3 + 1, 1).status).toBe('diverged');
    expect(fixedPoint(() => Number.NaN, 1).status).toBe('diverged');
  });

  it('records every iterate in the trace', () => {
    const result = fixedPoint(Math.cos, 1.0, { tol: 1e-6, maxIter: 60 });
    expect(result.trace.length).toBeGreaterThanOrEqual(result.gEvals);
  });
});
