/**
 * analysis_model registry — SPEC §5/§7. name@version → registered model.
 * The db seed (models.json) carries the schema-level rows; this registry
 * holds the executable TypeScript implementations. A registry.test.ts
 * cross-checks the two stay in sync.
 */
import type { RegisteredModel } from './types';
import { massRollup } from './massRollup';
import { hoverPower } from './hoverPower';
import { forwardFlight } from './forwardFlight';
import { batteryEnergy } from './batteryEnergy';
import { missionEnergy } from './missionEnergy';
import { costRollup } from './costRollup';
import { limits } from './limits';

// Params are heterogeneous across models, so registry entries are stored
// with the param type erased (callers needing typed params import the
// model module directly, as sizing.ts does).
type AnyModel = RegisteredModel<never>;

const registry = new Map<string, AnyModel>();

export function modelKey(name: string, version: string): string {
  return `${name}@${version}`;
}

export function registerModel(model: AnyModel): void {
  registry.set(modelKey(model.name, model.version), model);
}

export function getModel(
  name: string,
  version: string,
): AnyModel | undefined {
  return registry.get(modelKey(name, version));
}

export function listRegisteredModels(): AnyModel[] {
  return [...registry.values()];
}

/** name → version map recorded on every ResultRow (pedigree, SPEC §8). */
export function currentModelVersions(): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const model of registry.values()) {
    versions[model.name] = model.version;
  }
  return versions;
}

[
  massRollup,
  hoverPower,
  forwardFlight,
  batteryEnergy,
  missionEnergy,
  costRollup,
  limits,
].forEach(registerModel);
