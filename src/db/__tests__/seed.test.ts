import { describe, expect, it } from 'vitest';
import { loadSeed } from '../seedLoader';

const REQUIRED_SOURCE_NOTE =
  'representative — verify against mfr datasheet before procurement';

describe('seed data (SPEC §6)', () => {
  it('loads and validates against the zod contracts', () => {
    expect(() => loadSeed()).not.toThrow();
  });

  it('contains at least 18 components', () => {
    const { components } = loadSeed();
    expect(components.length).toBeGreaterThanOrEqual(18);
  });

  it('covers every required component class', () => {
    const { components } = loadSeed();
    const classes = new Set(components.map((c) => c.cls));
    for (const cls of [
      'motor',
      'esc',
      'prop',
      'battery',
      'frame',
      'fc',
      'payload',
      'vtx',
    ]) {
      expect(classes).toContain(cls);
    }
  });

  it('marks every entry as representative (seed honesty)', () => {
    const { components } = loadSeed();
    for (const c of components) {
      expect(c.sourceNote, `${c.mfr} ${c.model}`).toBe(REQUIRED_SOURCE_NOTE);
    }
  });

  it('ships the three archetype demo configurations', () => {
    const { configurations } = loadSeed();
    expect(configurations).toHaveLength(3);
    expect(new Set(configurations.map((c) => c.archetype))).toEqual(
      new Set(['endurance_quad', 'fpv_highspeed', 'heavy_lift']),
    );
  });

  it('every configuration instance resolves to a seeded component', () => {
    const { components, configurations } = loadSeed();
    const ids = new Set(components.map((c) => c.id));
    for (const config of configurations) {
      expect(config.instances.length).toBeGreaterThan(0);
      for (const inst of config.instances) {
        expect(ids, `${config.name}/${inst.role}`).toContain(inst.componentId);
      }
    }
  });

  it('every configuration has the core roles for a closed sizing loop', () => {
    const { configurations } = loadSeed();
    for (const config of configurations) {
      const roles = new Set(config.instances.map((i) => i.role));
      for (const role of ['motor', 'prop', 'battery', 'frame']) {
        expect(roles, config.name).toContain(role);
      }
    }
  });

  it('seeds the seven fidelity-0 analysis models at version 1.0', () => {
    const { models } = loadSeed();
    expect(models.map((m) => m.name).sort()).toEqual(
      [
        'batteryEnergy',
        'costRollup',
        'forwardFlight',
        'hoverPower',
        'limits',
        'massRollup',
        'missionEnergy',
      ].sort(),
    );
    for (const m of models) {
      expect(m.fidelity).toBe(0);
      expect(m.version).toBe('1.0');
    }
  });

  it('prop etaCurves are valid interpolation tables', () => {
    const { components } = loadSeed();
    for (const prop of components.filter((c) => c.cls === 'prop')) {
      const curve = prop.params['etaCurve'] as [number, number][];
      expect(curve.length).toBeGreaterThanOrEqual(3);
      // advance ratio strictly increasing
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i]![0]).toBeGreaterThan(curve[i - 1]![0]);
      }
    }
  });
});
