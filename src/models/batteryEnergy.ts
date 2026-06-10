/**
 * batteryEnergy@1.0 — SPEC §7.
 * Usable energy E = mBatt·specificEnergy·DoD·ηDis (DoD = 0.8, ηDis = 0.95);
 * mBatt_required = E_mission / (specificEnergy·DoD·ηDis).
 */
import type { RegisteredModel } from './types';

export interface BatteryEnergyParams {
  specificEnergyWhKg: number;
  /** Depth of discharge (default 0.8). */
  dod?: number;
  /** Discharge efficiency (default 0.95). */
  etaDis?: number;
}

export const batteryEnergy: RegisteredModel<BatteryEnergyParams> = {
  name: 'batteryEnergy',
  version: '1.0',
  discipline: 'energy',
  fidelity: 0,
  validity: { mBattKg: [0.01, 20] },
  fn: (inputs, params) => {
    const dod = params.dod ?? 0.8;
    const etaDis = params.etaDis ?? 0.95;
    const usableWhPerKg = params.specificEnergyWhKg * dod * etaDis;
    return {
      mBattKg: inputs['eMissionWh']! / usableWhPerKg,
      usableWhPerKg,
    };
  },
};
