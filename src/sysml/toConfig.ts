/**
 * AST → configuration objects — SPEC §9.
 * Part defs/usages map onto catalog components by attribute matching
 * (kv ± 5%, mass ± 10%, others ± 10%), with `// @catalog:<componentId>`
 * overrides; unmatched parts become ad-hoc components flagged for the UI.
 * Requirement defs map onto analysis metrics for the Requirements table.
 */
import type { Component, ComponentClass, Configuration } from '../db/schema';
import type {
  SysmlAttribute,
  SysmlPackage,
  SysmlPartUsage,
} from './ast';

/** Attribute name → where it lives on a catalog component, with tolerance. */
const ATTRIBUTE_MATCHERS: Record<
  string,
  { get: (c: Component) => number | undefined; tolerance: number }
> = {
  kv: { get: (c) => c.params['kv'] as number | undefined, tolerance: 0.05 },
  mass: { get: (c) => c.massKg, tolerance: 0.1 },
  specificEnergy: {
    get: (c) => c.params['specificEnergyWhKg'] as number | undefined,
    tolerance: 0.1,
  },
  cells: { get: (c) => c.params['cells'] as number | undefined, tolerance: 0 },
  capacity: {
    get: (c) => c.params['capacityAh'] as number | undefined,
    tolerance: 0.1,
  },
  diam: { get: (c) => c.params['diamIn'] as number | undefined, tolerance: 0.1 },
  pitch: { get: (c) => c.params['pitchIn'] as number | undefined, tolerance: 0.1 },
  cda: { get: (c) => c.params['cdaM2'] as number | undefined, tolerance: 0.1 },
  maxPower: {
    get: (c) => c.params['maxPowerW'] as number | undefined,
    tolerance: 0.1,
  },
};

/** Crude class inference from a type name, for ad-hoc parts. */
const CLASS_HINTS: [RegExp, ComponentClass][] = [
  [/motor/i, 'motor'],
  [/prop/i, 'prop'],
  [/batt|pack|cell/i, 'battery'],
  [/frame/i, 'frame'],
  [/esc/i, 'esc'],
  [/fc|controller|pilot/i, 'fc'],
  [/vtx|video/i, 'vtx'],
];

export interface RequirementRow {
  name: string;
  metric: string;
  op: '<=' | '>=';
  value: number;
  unit: string;
  subject: string;
}

export interface ToConfigResult {
  configuration: Configuration;
  requirements: RequirementRow[];
  /** Ad-hoc components synthesized for unmatched parts (not persisted). */
  adHocComponents: Component[];
  warnings: string[];
}

interface LeafPart {
  usage: SysmlPartUsage;
  attributes: SysmlAttribute[];
}

function collectLeaves(
  pkg: SysmlPackage,
): { leaves: LeafPart[]; vehicleName: string | null } {
  const defByName = new Map(pkg.partDefs.map((d) => [d.name, d]));
  const leaves: LeafPart[] = [];
  let vehicleName: string | null = null;

  const visit = (usage: SysmlPartUsage): void => {
    if (usage.children.length > 0) {
      // Composition node (the vehicle).
      vehicleName = vehicleName ?? usage.name;
      usage.children.forEach(visit);
      return;
    }
    // Merge def attributes with usage redefinitions (usage wins).
    const def = usage.type ? defByName.get(usage.type) : undefined;
    const merged = new Map<string, SysmlAttribute>();
    for (const a of def?.attributes ?? []) merged.set(a.name, a);
    for (const a of usage.attributes) merged.set(a.name, a);
    leaves.push({ usage, attributes: [...merged.values()] });
  };

  pkg.parts.forEach(visit);
  return { leaves, vehicleName };
}

function matchCatalog(
  leaf: LeafPart,
  catalog: Component[],
  warnings: string[],
): Component | null {
  const numeric = leaf.attributes.filter((a) => a.value !== undefined);
  const usable = numeric.filter((a) => ATTRIBUTE_MATCHERS[a.name]);
  for (const a of numeric) {
    if (!ATTRIBUTE_MATCHERS[a.name]) {
      warnings.push(
        `${leaf.usage.name}: attribute "${a.name}" has no catalog mapping — ignored for matching`,
      );
    }
  }
  if (usable.length === 0) return null;

  let best: { component: Component; error: number } | null = null;
  for (const component of catalog) {
    let totalError = 0;
    let allPass = true;
    for (const attr of usable) {
      const matcher = ATTRIBUTE_MATCHERS[attr.name]!;
      const actual = matcher.get(component);
      if (actual === undefined) {
        allPass = false;
        break;
      }
      const relError =
        actual === 0
          ? Math.abs(attr.value!) > 1e-12
            ? Infinity
            : 0
          : Math.abs(attr.value! - actual) / Math.abs(actual);
      if (relError > matcher.tolerance + 1e-9) {
        allPass = false;
        break;
      }
      totalError += relError;
    }
    if (allPass && (best === null || totalError < best.error)) {
      best = { component, error: totalError };
    }
  }
  return best?.component ?? null;
}

function makeAdHoc(leaf: LeafPart): Component {
  const typeName = leaf.usage.type ?? leaf.usage.name;
  const cls =
    CLASS_HINTS.find(([re]) => re.test(typeName))?.[1] ?? 'payload';
  const mass = leaf.attributes.find((a) => a.name === 'mass')?.value ?? 0;
  const params: Record<string, number> = {};
  for (const a of leaf.attributes) {
    if (a.value !== undefined && a.name !== 'mass') params[a.name] = a.value;
  }
  if (['fc', 'vtx', 'payload'].includes(cls) && params['pDrawW'] === undefined) {
    params['pDrawW'] = 0;
  }
  return {
    id: crypto.randomUUID(),
    cls,
    mfr: 'ad-hoc',
    model: typeName,
    massKg: mass,
    unitCostUsd: 0,
    params,
    sourceNote: 'ad-hoc from SysML — not a catalog part',
  };
}

export function toConfig(
  pkg: SysmlPackage,
  catalog: Component[],
): ToConfigResult {
  const warnings: string[] = [];
  const adHocComponents: Component[] = [];
  const { leaves, vehicleName } = collectLeaves(pkg);

  const instances: Configuration['instances'] = [];
  for (const leaf of leaves) {
    let component: Component | null = null;
    if (leaf.usage.catalogId) {
      component = catalog.find((c) => c.id === leaf.usage.catalogId) ?? null;
      if (!component) {
        warnings.push(
          `${leaf.usage.name}: @catalog:${leaf.usage.catalogId} does not exist — falling back to attribute matching`,
        );
      }
    }
    component = component ?? matchCatalog(leaf, catalog, warnings);
    if (!component) {
      component = makeAdHoc(leaf);
      adHocComponents.push(component);
      warnings.push(
        `${leaf.usage.name}: no catalog match — ad-hoc ${component.cls} "${component.model}" created`,
      );
    }
    instances.push({
      componentId: component.id,
      role: component.cls,
      count: leaf.usage.count ?? 1,
    });
  }

  const requirements: RequirementRow[] = pkg.requirements.map((r) => ({
    name: r.name,
    metric: r.constraint.metric,
    op: r.constraint.op,
    value: r.threshold.value,
    unit: r.threshold.unit,
    subject: r.subject,
  }));

  const configuration: Configuration = {
    id: crypto.randomUUID(),
    name: vehicleName ? `${pkg.name}.${vehicleName}` : pkg.name,
    parentId: null,
    status: 'draft',
    // Archetype is not expressible in the subset; default recorded in D36.
    archetype: 'endurance_quad',
    instances,
    cuiMarking: null,
  };

  return { configuration, requirements, adHocComponents, warnings };
}
