/**
 * massRollup@1.0 — SPEC §7.
 * mtow = Σ(instance mass × count) + mBatt. Battery mass is the cycle
 * variable; the fixed portion is precomputed by the sizing orchestrator.
 */
import type { RegisteredModel } from './types';

export interface MassRollupParams {
  /** Σ(instance mass × count) excluding the battery. */
  fixedMassKg: number;
}

export const massRollup: RegisteredModel<MassRollupParams> = {
  name: 'massRollup',
  version: '1.0',
  discipline: 'mass',
  fidelity: 0,
  validity: { mtowKg: [0.05, 50] },
  fn: (inputs, params) => ({
    mtowKg: params.fixedMassKg + inputs['mBattKg']!,
  }),
};
