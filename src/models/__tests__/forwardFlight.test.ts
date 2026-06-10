import { describe, expect, it } from 'vitest';
import { forwardFlight, interpolateEta } from '../forwardFlight';
import type { ForwardFlightParams } from '../forwardFlight';

// Representative 5-inch FPV quad (matches the seeded archetype roughly).
const FPV: ForwardFlightParams = {
  cdaM2: 0.008,
  cdaTiltFactor: 0.5,
  diskAreaM2: 0.0527,
  propDiamM: 5.1 * 0.0254,
  etaCurve: [
    [0.3, 0.42],
    [0.6, 0.58],
    [0.9, 0.6],
    [1.1, 0.5],
  ],
  kvRpmPerV: 1855,
  vBattV: 22.2,
};

const INPUT = { mtowKg: 0.55, pHoverW: 60 };

describe('forwardFlight@1.0 (SPEC §7)', () => {
  it('pitch and power increase monotonically with speed', () => {
    let lastPitch = -1;
    let lastPower = 0;
    for (const v of [10, 20, 30, 40, 50]) {
      const out = forwardFlight.fn({ ...INPUT, speedMs: v }, FPV);
      expect(out['pitchDeg']!).toBeGreaterThan(lastPitch);
      expect(out['pCruiseW']!).toBeGreaterThan(lastPower);
      lastPitch = out['pitchDeg']!;
      lastPower = out['pCruiseW']!;
    }
  });

  it('degenerates to hover power at zero speed', () => {
    const out = forwardFlight.fn({ ...INPUT, speedMs: 0 }, FPV);
    expect(out['pCruiseW']).toBe(60);
    expect(out['pitchDeg']).toBe(0);
  });

  it('Glauert induced velocity matches the hover limit', () => {
    // At very low speed the Newton solve must approach vi_hover = √(T/2ρA):
    // P_ind ≈ κ·T·vi_hover.
    const out = forwardFlight.fn({ ...INPUT, speedMs: 0.2 }, FPV);
    // 0.55 kg → T ≈ W = 5.40 N; vi_h = √(5.40/0.129) ≈ 6.47 m/s
    // P_ind ≈ 1.15 × 5.40 × 6.47 ≈ 40 W; plus profile 9 W, drag ~0,
    // / 0.85 / ηProp(J≈0)=0.42 → ≈ 137 W. Loose band:
    expect(out['pCruiseW']!).toBeGreaterThan(100);
    expect(out['pCruiseW']!).toBeLessThan(180);
  });

  it('bisects vMax against the power ceiling', () => {
    const out = forwardFlight.fn(
      { ...INPUT, speedMs: 20 },
      { ...FPV, pLimitW: 2400 },
    );
    const vMax = out['vMaxMs']!;
    expect(vMax).toBeGreaterThan(35);
    expect(vMax).toBeLessThan(80);
    // Power at vMax sits on the ceiling.
    const atVmax = forwardFlight.fn({ ...INPUT, speedMs: vMax }, FPV);
    expect(atVmax['pCruiseW']!).toBeCloseTo(2400, 0);
  });

  it('caps vMax at 80 m/s when the ceiling is never reached', () => {
    const out = forwardFlight.fn(
      { ...INPUT, speedMs: 20 },
      { ...FPV, pLimitW: 1e9 },
    );
    expect(out['vMaxMs']).toBe(80);
  });

  it('skips vMax when no power limit is supplied', () => {
    const out = forwardFlight.fn({ ...INPUT, speedMs: 20 }, FPV);
    expect(Number.isNaN(out['vMaxMs'])).toBe(true);
  });

  it('interpolates the eta curve with endpoint clamping', () => {
    const curve: [number, number][] = FPV.etaCurve;
    expect(interpolateEta(curve, 0.1)).toBe(0.42); // below first point
    expect(interpolateEta(curve, 2.0)).toBe(0.5); // above last point
    expect(interpolateEta(curve, 0.45)).toBeCloseTo(0.5, 6); // midpoint
  });
});
