/**
 * limits@1.0 — SPEC §7. Validity checks → case status `invalid` with
 * reasons: thrust-to-weight < 1.6 (quads), disk loading > envelope, battery
 * C-rate exceeded at hover, prop tip Mach > 0.6, motor power > rating.
 *
 * The model fn returns the numeric margins; limitReasons() maps violations
 * to human-readable strings for the UI / case status.
 */
import { G_MS2, RHO_KG_M3, SOUND_SPEED_MS } from './constants';
import type { EffectsOutputs, RegisteredModel } from './types';

export interface LimitsParams {
  /** Σ motor maxThrustKgf × count. */
  maxThrustTotalKgf: number;
  diskAreaM2: number;
  specificEnergyWhKg: number;
  maxC: number;
  motorCount: number;
  /** Per-motor rating. */
  motorMaxPowerW: number;
  propDiamM: number;
  /** Static thrust coefficient proxy: T = kT0·ρ·n²·D⁴ (hover rpm, D15). */
  kT0: number;
  twMin?: number; // default 1.6
  diskLoadingMaxKgM2?: number; // default 40
  tipMachMax?: number; // default 0.6
  rhoKgM3?: number;
}

export const limits: RegisteredModel<LimitsParams> = {
  name: 'limits',
  version: '1.0',
  discipline: 'constraints',
  fidelity: 0,
  validity: { thrustToWeight: [1.6, 10], tipMach: [0, 0.6] },
  fn: (inputs, params) => {
    const rho = params.rhoKgM3 ?? RHO_KG_M3;
    const mtowKg = inputs['mtowKg']!;
    const pHoverW = inputs['pHoverW']!;
    const mBattKg = inputs['mBattKg']!;

    const twRatio = params.maxThrustTotalKgf / mtowKg;
    const diskLoadingKgM2 = mtowKg / params.diskAreaM2;

    // Hover C-rate: pHover / battery energy content (1/h units).
    const cRateHover = pHoverW / (mBattKg * params.specificEnergyWhKg);

    // Hover rpm from the static thrust proxy: T_rotor = kT0·ρ·n²·D⁴.
    const thrustPerRotorN = (mtowKg * G_MS2) / params.motorCount;
    const nHover = Math.sqrt(
      thrustPerRotorN / (params.kT0 * rho * params.propDiamM ** 4),
    );
    const tipMach = (Math.PI * nHover * params.propDiamM) / SOUND_SPEED_MS;

    const motorPowerFrac = pHoverW / params.motorCount / params.motorMaxPowerW;

    return { twRatio, diskLoadingKgM2, cRateHover, tipMach, motorPowerFrac };
  },
};

/** Map limit outputs to violation reasons (empty array = all clear). */
export function limitReasons(
  outputs: EffectsOutputs,
  params: LimitsParams,
): string[] {
  const twMin = params.twMin ?? 1.6;
  const diskLoadingMax = params.diskLoadingMaxKgM2 ?? 40;
  const tipMachMax = params.tipMachMax ?? 0.6;
  const reasons: string[] = [];
  if (outputs['twRatio']! < twMin) {
    reasons.push(
      `thrust-to-weight ${outputs['twRatio']!.toFixed(2)} < ${twMin} minimum`,
    );
  }
  if (outputs['diskLoadingKgM2']! > diskLoadingMax) {
    reasons.push(
      `disk loading ${outputs['diskLoadingKgM2']!.toFixed(1)} kg/m² exceeds envelope (${diskLoadingMax})`,
    );
  }
  if (outputs['cRateHover']! > params.maxC) {
    reasons.push(
      `battery C-rate at hover ${outputs['cRateHover']!.toFixed(1)}C exceeds ${params.maxC}C rating`,
    );
  }
  if (outputs['tipMach']! > tipMachMax) {
    reasons.push(
      `prop tip Mach ${outputs['tipMach']!.toFixed(2)} > ${tipMachMax}`,
    );
  }
  if (outputs['motorPowerFrac']! > 1) {
    reasons.push(
      `motor power ${(outputs['motorPowerFrac']! * 100).toFixed(0)}% of rating`,
    );
  }
  return reasons;
}
