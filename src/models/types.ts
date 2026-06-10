/**
 * Effects-model typing — SPEC §7. All model functions are pure:
 * (inputs, params) → outputs, mirroring the future OpenMDAO components so
 * the Python swap is mechanical.
 */

export type EffectsInputs = Record<string, number>;
export type EffectsOutputs = Record<string, number>;

export interface RegisteredModel<P = Record<string, unknown>> {
  name: string;
  version: string;
  discipline: string;
  fidelity: 0 | 1 | 2 | 3;
  /** Validity envelope: metric → [min, max]. */
  validity: Record<string, [number, number]>;
  fn: (inputs: EffectsInputs, params: P) => EffectsOutputs;
}
