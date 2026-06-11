/**
 * DOE samplers — SPEC §8: Latin hypercube + full factorial.
 * Seeded RNG (mulberry32) keeps studies reproducible, which also makes the
 * inputHash dedup cache demonstrable: re-running the same study re-hits it.
 */

export interface VariableSpec {
  /** Dotted path into the input vector, e.g. "mission.hoverDurationS". */
  path: string;
  min: number;
  max: number;
  /** Grid steps for full factorial (default 5). */
  steps?: number;
}

/** Deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Latin hypercube: n samples; each variable's range is split into n strata
 * and every stratum is hit exactly once (independent shuffles per variable).
 */
export function latinHypercube(
  variables: VariableSpec[],
  n: number,
  seed = 1,
): Record<string, number>[] {
  const rng = mulberry32(seed);
  const strataPerVar = variables.map(() => {
    const order = Array.from({ length: n }, (_, i) => i);
    // Fisher–Yates
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    return order;
  });
  const samples: Record<string, number>[] = [];
  for (let i = 0; i < n; i++) {
    const vector: Record<string, number> = {};
    variables.forEach((v, vi) => {
      const stratum = strataPerVar[vi]![i]!;
      const u = (stratum + rng()) / n;
      vector[v.path] = v.min + u * (v.max - v.min);
    });
    samples.push(vector);
  }
  return samples;
}

/** Full factorial grid over `steps` levels per variable (inclusive ends). */
export function fullFactorial(
  variables: VariableSpec[],
): Record<string, number>[] {
  const levels = variables.map((v) => {
    const steps = Math.max(2, v.steps ?? 5);
    return Array.from(
      { length: steps },
      (_, i) => v.min + (i / (steps - 1)) * (v.max - v.min),
    );
  });
  let grid: Record<string, number>[] = [{}];
  variables.forEach((v, vi) => {
    const next: Record<string, number>[] = [];
    for (const partial of grid) {
      for (const value of levels[vi]!) {
        next.push({ ...partial, [v.path]: value });
      }
    }
    grid = next;
  });
  return grid;
}
