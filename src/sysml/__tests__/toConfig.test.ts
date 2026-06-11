import { beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../db/repository';
import { parseSysml } from '../parse';
import { toConfig } from '../toConfig';
import { SYSML_EXAMPLE } from '../example';
import type { Component } from '../../db/schema';

let catalog: Component[];

beforeAll(async () => {
  catalog = await createDb().components.list();
});

describe('SysML → configuration mapping (SPEC §9)', () => {
  it('maps the example onto catalog components by attribute matching', () => {
    const parsed = parseSysml(SYSML_EXAMPLE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { configuration, adHocComponents, warnings, requirements } =
      toConfig(parsed.package, catalog);

    // Motor: kv 240 ±5% + mass 0.184 ±10% → T-Motor MN501-S KV240.
    const motor = configuration.instances.find((i) => i.role === 'motor');
    expect(motor?.componentId).toBe('00000000-0000-4000-8000-000000000002');
    expect(motor?.count).toBe(4);

    // Battery: specificEnergy 230 ±10% uniquely → Li-ion 6S2P pack.
    const battery = configuration.instances.find((i) => i.role === 'battery');
    expect(battery?.componentId).toBe('00000000-0000-4000-8000-000000000023');

    // Frame650 has no def/attributes → ad-hoc, flagged.
    expect(adHocComponents).toHaveLength(1);
    expect(adHocComponents[0]!.cls).toBe('frame');
    expect(warnings.join(' ')).toContain('no catalog match');

    // Requirement rows populate the table (metric binding).
    expect(requirements).toEqual([
      {
        name: 'HoverEndurance',
        metric: 'enduranceMin',
        op: '>=',
        value: 30,
        unit: 'min',
        subject: 'vehicle',
      },
    ]);
  });

  it('honors @catalog overrides over attribute matching', () => {
    const parsed = parseSysml(`package P {
      part vehicle {
        part m : Motor [4]; // @catalog:00000000-0000-4000-8000-000000000004
      }
    }`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { configuration, warnings } = toConfig(parsed.package, catalog);
    expect(configuration.instances[0]!.componentId).toBe(
      '00000000-0000-4000-8000-000000000004',
    );
    expect(warnings).toEqual([]);
  });

  it('usage attribute redefinitions participate in matching', () => {
    // Def says kv 240 but the usage redefines kv 1855 → matches the XING2.
    const parsed = parseSysml(`package P {
      part def Motor { attribute kv : Real = 240; }
      part vehicle {
        part m : Motor [4] { attribute kv : Real = 1855; attribute mass : Real = 0.032; }
      }
    }`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { configuration } = toConfig(parsed.package, catalog);
    expect(configuration.instances[0]!.componentId).toBe(
      '00000000-0000-4000-8000-000000000004',
    );
  });

  it('names the configuration from the package and vehicle', () => {
    const parsed = parseSysml(SYSML_EXAMPLE);
    if (!parsed.ok) return;
    const { configuration } = toConfig(parsed.package, catalog);
    expect(configuration.name).toBe('EnduranceQuad.vehicle');
    expect(configuration.status).toBe('draft');
    expect(configuration.cuiMarking).toBeNull();
  });
});
