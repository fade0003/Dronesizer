/**
 * Validated seed loader. All seed JSON passes the zod contracts and a
 * referential-integrity check before it enters a store.
 */
import componentsJson from './seed/components.json';
import configurationsJson from './seed/configurations.json';
import modelsJson from './seed/models.json';
import {
  parseAnalysisModels,
  parseComponents,
  parseConfigurations,
} from './contracts';
import type { AnalysisModel, Component, Configuration } from './schema';

export interface SeedData {
  components: Component[];
  configurations: Configuration[];
  models: AnalysisModel[];
}

export function loadSeed(): SeedData {
  const components = parseComponents(componentsJson);
  const configurations = parseConfigurations(configurationsJson);
  const models = parseAnalysisModels(modelsJson);

  const componentIds = new Set(components.map((c) => c.id));
  for (const config of configurations) {
    for (const instance of config.instances) {
      if (!componentIds.has(instance.componentId)) {
        throw new Error(
          `Seed integrity: configuration "${config.name}" references unknown component ${instance.componentId}`,
        );
      }
    }
  }
  return { components, configurations, models };
}
