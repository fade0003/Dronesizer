/**
 * costRollup@1.0 — SPEC §7.
 * unitCost = Σ(unitCostUsd × count) × 1.25 (integration/harness factor) —
 * reports BOM and loaded cost.
 */
import type { RegisteredModel } from './types';

export interface CostRollupParams {
  /** Σ(unitCostUsd × count) over all instances. */
  bomCostUsd: number;
  /** Integration/harness factor (default 1.25). */
  integrationFactor?: number;
}

export const costRollup: RegisteredModel<CostRollupParams> = {
  name: 'costRollup',
  version: '1.0',
  discipline: 'cost',
  fidelity: 0,
  validity: {},
  fn: (_inputs, params) => ({
    bomCostUsd: params.bomCostUsd,
    unitCostUsd: params.bomCostUsd * (params.integrationFactor ?? 1.25),
  }),
};
