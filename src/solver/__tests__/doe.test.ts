import { describe, expect, it } from 'vitest';
import { fullFactorial, latinHypercube, mulberry32 } from '../doe';

const VARS = [
  { path: 'a', min: 0, max: 10 },
  { path: 'b', min: 100, max: 200 },
];

describe('DOE samplers (SPEC §8)', () => {
  it('LHS produces n samples within bounds', () => {
    const samples = latinHypercube(VARS, 200, 7);
    expect(samples).toHaveLength(200);
    for (const s of samples) {
      expect(s['a']!).toBeGreaterThanOrEqual(0);
      expect(s['a']!).toBeLessThanOrEqual(10);
      expect(s['b']!).toBeGreaterThanOrEqual(100);
      expect(s['b']!).toBeLessThanOrEqual(200);
    }
  });

  it('LHS stratifies: every stratum hit exactly once per variable', () => {
    const n = 50;
    const samples = latinHypercube(VARS, n, 3);
    for (const v of VARS) {
      const strata = samples.map((s) =>
        Math.floor(((s[v.path]! - v.min) / (v.max - v.min)) * n),
      );
      expect(new Set(strata).size).toBe(n);
    }
  });

  it('LHS is deterministic per seed and differs across seeds', () => {
    expect(latinHypercube(VARS, 20, 5)).toEqual(latinHypercube(VARS, 20, 5));
    expect(latinHypercube(VARS, 20, 5)).not.toEqual(latinHypercube(VARS, 20, 6));
  });

  it('full factorial builds the steps^k grid with inclusive ends', () => {
    const grid = fullFactorial([
      { path: 'a', min: 0, max: 10, steps: 3 },
      { path: 'b', min: 0, max: 1, steps: 4 },
    ]);
    expect(grid).toHaveLength(12);
    expect(grid.map((g) => g['a'])).toContain(0);
    expect(grid.map((g) => g['a'])).toContain(10);
    expect(new Set(grid.map((g) => g['b'])).size).toBe(4);
  });

  it('mulberry32 is deterministic and uniform-ish', () => {
    const rng = mulberry32(42);
    const rng2 = mulberry32(42);
    const seq = Array.from({ length: 5 }, () => rng());
    expect(Array.from({ length: 5 }, () => rng2())).toEqual(seq);
    for (const v of seq) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
