/**
 * hoverPower@1.0 — SPEC §7.
 * T = mtow·g; pHover = T^1.5 / √(2ρA_disk) / FM / ηDrive.
 * FM = 0.65 default, ηDrive = 0.85 (motor × ESC).
 */
import { G_MS2, RHO_KG_M3 } from './constants';
import type { RegisteredModel } from './types';

export interface HoverPowerParams {
  /** Total disk area: prop diameter × rotor count. */
  diskAreaM2: number;
  /** Figure of merit (default 0.65). */
  fm?: number;
  /** Motor × ESC drive efficiency (default 0.85). */
  etaDrive?: number;
  rhoKgM3?: number;
}

export const hoverPower: RegisteredModel<HoverPowerParams> = {
  name: 'hoverPower',
  version: '1.0',
  discipline: 'propulsion',
  fidelity: 0,
  validity: { diskLoadingKgM2: [0.5, 40] },
  fn: (inputs, params) => {
    const fm = params.fm ?? 0.65;
    const etaDrive = params.etaDrive ?? 0.85;
    const rho = params.rhoKgM3 ?? RHO_KG_M3;
    const mtowKg = inputs['mtowKg']!;
    const thrustN = mtowKg * G_MS2;
    const pIdealW = thrustN ** 1.5 / Math.sqrt(2 * rho * params.diskAreaM2);
    return {
      pHoverW: pIdealW / fm / etaDrive,
      thrustN,
      diskLoadingKgM2: mtowKg / params.diskAreaM2,
    };
  },
};
