import { describe, expect, it } from 'vitest';
import { paretoFront } from '../pareto';

describe('pareto non-dominance filter (SPEC §8)', () => {
  // Classic min-min staircase: front is the lower-left envelope.
  const points = [
    { id: 'a', x: 1, y: 5 },
    { id: 'b', x: 2, y: 3 },
    { id: 'c', x: 3, y: 4 }, // dominated by b
    { id: 'd', x: 4, y: 1 },
    { id: 'e', x: 5, y: 2 }, // dominated by d
  ];

  it('min/min keeps the staircase, ordered along x', () => {
    expect(paretoFront(points, 'min', 'min')).toEqual(['a', 'b', 'd']);
  });

  it('max/max mirrors to the upper-right envelope', () => {
    expect(paretoFront(points, 'max', 'max')).toEqual(['e', 'c', 'a']);
  });

  it('min/max — e.g. minimize mass, maximize endurance', () => {
    // Lower-x, higher-y survive.
    expect(paretoFront(points, 'min', 'max')).toEqual(['a']);
    expect(
      paretoFront(
        [
          { id: 'p', x: 1, y: 1 },
          { id: 'q', x: 2, y: 4 },
          { id: 'r', x: 3, y: 2 }, // dominated by q
          { id: 's', x: 4, y: 6 },
        ],
        'min',
        'max',
      ),
    ).toEqual(['p', 'q', 's']);
  });

  it('drops non-finite points and handles duplicates', () => {
    expect(
      paretoFront(
        [
          { id: 'a', x: NaN, y: 1 },
          { id: 'b', x: 1, y: 1 },
          { id: 'c', x: 1, y: 1 }, // duplicate — only one survives
        ],
        'min',
        'min',
      ),
    ).toEqual(['b']);
  });

  it('handles 10k points quickly (n log n)', () => {
    const big = Array.from({ length: 10000 }, (_, i) => ({
      id: String(i),
      x: Math.sin(i * 12.9898) * 1000,
      y: Math.sin(i * 78.233) * 1000,
    }));
    const start = performance.now();
    const front = paretoFront(big, 'min', 'min');
    expect(performance.now() - start).toBeLessThan(200);
    expect(front.length).toBeGreaterThan(0);
  });
});
