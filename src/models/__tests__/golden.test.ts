/**
 * GOLDEN TEST — SPEC §7, written before the solver per CLAUDE.md rule 4.
 *
 * Fixed mass 3.3 kg, A = 0.45 m², FM 0.65, 30 min hover, DoD·η = 0.68,
 * e = 180 Wh/kg ⇒ mtow = 6.0 ± 0.05 kg, mBatt = 2.70 ± 0.05 kg,
 * pHover = 661 ± 10 W, in ≤ 30 iterations.
 *
 * Note (DECISIONS.md D13): the hand calculation behind 661 W applies the
 * figure of merit only — ηDrive = 1.0 here; DoD·η = 0.68 is passed as the
 * combined usable-energy fraction.
 */
import { describe, expect, it } from 'vitest';
import { fixedPoint } from '../../solver/gaussSeidel';
import { massRollup } from '../massRollup';
import { hoverPower } from '../hoverPower';
import { missionEnergy } from '../missionEnergy';
import { batteryEnergy } from '../batteryEnergy';

const GOLDEN = {
  fixedMassKg: 3.3,
  diskAreaM2: 0.45,
  fm: 0.65,
  etaDrive: 1.0,
  hoverDurationS: 1800,
  specificEnergyWhKg: 180,
  usableFraction: 0.68, // DoD·η combined
};

function goldenIteration(mBattKg: number): number {
  const { mtowKg } = massRollup.fn(
    { mBattKg },
    { fixedMassKg: GOLDEN.fixedMassKg },
  )!;
  const { pHoverW } = hoverPower.fn(
    { mtowKg: mtowKg! },
    { diskAreaM2: GOLDEN.diskAreaM2, fm: GOLDEN.fm, etaDrive: GOLDEN.etaDrive },
  );
  const { eMissionWh } = missionEnergy.fn(
    { pHoverW: pHoverW!, pCruiseW: 0, pDashW: 0 },
    { segments: [{ kind: 'hover', durationS: GOLDEN.hoverDurationS }] },
  );
  const next = batteryEnergy.fn(
    { eMissionWh: eMissionWh! },
    {
      specificEnergyWhKg: GOLDEN.specificEnergyWhKg,
      dod: GOLDEN.usableFraction,
      etaDis: 1.0,
    },
  );
  return next['mBattKg']!;
}

describe('golden case (SPEC §7) — pins the demo to the hand calculation', () => {
  it('converges to mtow = 6.0 ± 0.05 kg in ≤ 30 iterations', () => {
    const result = fixedPoint(goldenIteration, 0.5, {
      tol: 1e-6,
      maxIter: 60,
    });

    expect(result.status).toBe('converged');
    expect(result.gEvals).toBeLessThanOrEqual(30);

    const mBattKg = result.x;
    const mtowKg = GOLDEN.fixedMassKg + mBattKg;
    const { pHoverW } = hoverPower.fn(
      { mtowKg },
      {
        diskAreaM2: GOLDEN.diskAreaM2,
        fm: GOLDEN.fm,
        etaDrive: GOLDEN.etaDrive,
      },
    );

    expect(Math.abs(mtowKg - 6.0)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(mBattKg - 2.7)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(pHoverW! - 661)).toBeLessThanOrEqual(10);
  });

  it('produces a usable iteration trace for the convergence sparkline', () => {
    const result = fixedPoint(goldenIteration, 0.5, { tol: 1e-6, maxIter: 60 });
    expect(result.trace.length).toBeGreaterThanOrEqual(3);
    // Trace ends at the converged value.
    expect(
      Math.abs(result.trace[result.trace.length - 1]! - result.x),
    ).toBeLessThan(1e-3);
  });

  it('Aitken acceleration converges faster than plain fixed-point', () => {
    const accelerated = fixedPoint(goldenIteration, 0.5, {
      tol: 1e-6,
      maxIter: 60,
      aitken: true,
    });
    const plain = fixedPoint(goldenIteration, 0.5, {
      tol: 1e-6,
      maxIter: 60,
      aitken: false,
    });
    expect(accelerated.status).toBe('converged');
    expect(plain.status).toBe('converged');
    expect(accelerated.gEvals).toBeLessThan(plain.gEvals);
  });
});
