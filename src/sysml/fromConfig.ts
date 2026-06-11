/**
 * configuration → canonical SysML v2 text — SPEC §9 round-trip.
 * Every emitted part usage carries a `// @catalog:<componentId>` override,
 * so parsing the generated text reproduces the exact instance set.
 */
import type { Component, Configuration } from '../db/schema';

function sanitize(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `P_${cleaned}`;
}

/** Key params worth round-tripping into part def attributes, per class. */
const DEF_ATTRIBUTES: Record<string, [attr: string, param: string, unit: string][]> = {
  motor: [['kv', 'kv', 'rpm_per_V']],
  battery: [['specificEnergy', 'specificEnergyWhKg', 'Wh_per_kg'], ['cells', 'cells', 'count']],
  prop: [['diam', 'diamIn', 'in'], ['pitch', 'pitchIn', 'in']],
  frame: [['cda', 'cdaM2', 'm2']],
};

export function fromConfig(
  config: Configuration,
  componentsById: Map<string, Component>,
): string {
  const lines: string[] = [];
  const pkgName = sanitize(config.name);
  lines.push(`package ${pkgName} {`);

  // One part def per distinct component, named from its model.
  const defNames = new Map<string, string>(); // componentId → def name
  const used = new Set<string>();
  for (const inst of config.instances) {
    if (defNames.has(inst.componentId)) continue;
    const component = componentsById.get(inst.componentId);
    if (!component) continue;
    let defName = sanitize(`${component.model}`);
    while (used.has(defName)) defName = `${defName}_`;
    used.add(defName);
    defNames.set(inst.componentId, defName);

    const attrs: string[] = [];
    for (const [attr, param, unit] of DEF_ATTRIBUTES[component.cls] ?? []) {
      const value = component.params[param];
      if (typeof value === 'number') {
        attrs.push(`attribute ${attr} : Real = ${value} unit ${unit};`);
      }
    }
    attrs.push(`attribute mass : Real = ${component.massKg} unit kg;`);
    lines.push(`  part def ${defName} { ${attrs.join(' ')} }`);
  }

  // The vehicle composition, one usage per instance with catalog override.
  lines.push(`  part vehicle {`);
  const usageNames = new Set<string>();
  for (const inst of config.instances) {
    const component = componentsById.get(inst.componentId);
    if (!component) continue;
    let usage = sanitize(inst.role);
    while (usageNames.has(usage)) usage = `${usage}_`;
    usageNames.add(usage);
    const count = inst.count > 1 ? ` [${inst.count}]` : '';
    lines.push(
      `    part ${usage} : ${defNames.get(inst.componentId)}${count}; // @catalog:${inst.componentId}`,
    );
  }
  lines.push(`  }`);

  // Canonical power connection, if both ends exist.
  const roles = new Set(config.instances.map((i) => i.role));
  if (roles.has('battery') && roles.has('motor')) {
    lines.push(`  connect battery to motor;`);
  }

  lines.push(`}`);
  return lines.join('\n') + '\n';
}
