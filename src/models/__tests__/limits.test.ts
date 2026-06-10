import { describe, expect, it } from 'vitest';
import { limits, limitReasons, type LimitsParams } from '../limits';

// A healthy endurance-quad-like operating point.
const PARAMS: LimitsParams = {
  maxThrustTotalKgf: 16.8, // 4 × 4.2 kgf
  diskAreaM2: 0.657,
  specificEnergyWhKg: 230,
  maxC: 4,
  motorCount: 4,
  motorMaxPowerW: 850,
  propDiamM: 18 * 0.0254,
  kT0: 0.12,
};

const HEALTHY = { mtowKg: 2.0, pHoverW: 125, mBattKg: 0.49 };

describe('limits@1.0 (SPEC §7)', () => {
  it('passes a healthy endurance-quad operating point', () => {
    const out = limits.fn(HEALTHY, PARAMS);
    expect(limitReasons(out, PARAMS)).toEqual([]);
    expect(out['twRatio']!).toBeGreaterThan(1.6);
    expect(out['tipMach']!).toBeLessThan(0.6);
  });

  it('flags thrust-to-weight below 1.6', () => {
    const out = limits.fn({ ...HEALTHY, mtowKg: 12 }, PARAMS);
    expect(limitReasons(out, PARAMS).join(' ')).toContain('thrust-to-weight');
  });

  it('flags battery C-rate exceeded at hover', () => {
    const out = limits.fn({ ...HEALTHY, pHoverW: 600, mBattKg: 0.1 }, PARAMS);
    expect(limitReasons(out, PARAMS).join(' ')).toContain('C-rate');
  });

  it('flags prop tip Mach above 0.6', () => {
    // Tiny prop forced to lift a heavy vehicle → huge hover rpm.
    const tiny: LimitsParams = {
      ...PARAMS,
      propDiamM: 3 * 0.0254,
      diskAreaM2: 0.02,
      maxThrustTotalKgf: 40,
    };
    const out = limits.fn({ ...HEALTHY, mtowKg: 8 }, tiny);
    expect(limitReasons(out, tiny).join(' ')).toContain('tip Mach');
  });

  it('flags motor power beyond rating', () => {
    const out = limits.fn({ ...HEALTHY, pHoverW: 4000 }, PARAMS);
    expect(limitReasons(out, PARAMS).join(' ')).toContain('motor power');
  });

  it('flags disk loading outside the envelope', () => {
    const dense: LimitsParams = {
      ...PARAMS,
      diskAreaM2: 0.04,
      maxThrustTotalKgf: 60,
    };
    const out = limits.fn({ ...HEALTHY, mtowKg: 2.0 }, dense);
    expect(limitReasons(out, dense).join(' ')).toContain('disk loading');
  });
});
