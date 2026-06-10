/**
 * End-to-end sizing on the three seeded archetypes — covers the SPEC §11
 * archetype and infeasibility acceptance criteria at the model level
 * (UI wiring lands in phase 3).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../db/repository';
import { analyzeConfiguration, type MissionSegment } from '../sizing';
import type { Component, Configuration } from '../../db/schema';

let componentsById: Map<string, Component>;
let byArchetype: Map<string, Configuration>;

beforeAll(async () => {
  const db = createDb();
  const components = await db.components.list();
  componentsById = new Map(components.map((c) => [c.id, c]));
  const configurations = await db.configurations.list();
  byArchetype = new Map(configurations.map((c) => [c.archetype, c]));
});

const HOVER_40_MIN: MissionSegment[] = [{ kind: 'hover', durationS: 2400 }];
const FPV_SPRINT: MissionSegment[] = [
  { kind: 'hover', durationS: 120 },
  { kind: 'dash', durationS: 180, speedMs: 30 },
];
const HOVER_30_MIN: MissionSegment[] = [{ kind: 'hover', durationS: 1800 }];
const HOVER_90_MIN: MissionSegment[] = [{ kind: 'hover', durationS: 5400 }];

describe('archetype sizing (SPEC §11)', () => {
  it('endurance quad: converges with ≥ 35 min hover endurance', () => {
    const result = analyzeConfiguration(
      byArchetype.get('endurance_quad')!,
      componentsById,
      HOVER_40_MIN,
    );
    expect(result.status).toBe('converged');
    expect(result.metrics['enduranceMin']!).toBeGreaterThanOrEqual(35);
    expect(result.metrics['battFrac']!).toBeGreaterThan(0.1);
    expect(result.metrics['battFrac']!).toBeLessThan(0.5);
  });

  it('FPV high-speed: vMax ≥ 35 m/s and pitch ≥ 30° at vMax', () => {
    const result = analyzeConfiguration(
      byArchetype.get('fpv_highspeed')!,
      componentsById,
      FPV_SPRINT,
    );
    expect(result.status).toBe('converged');
    expect(result.metrics['vMaxMs']!).toBeGreaterThanOrEqual(35);
    expect(result.metrics['pitchDeg']!).toBeGreaterThanOrEqual(30);
  });

  it('heavy lift: converges carrying the 1 kg payload within limits', () => {
    const result = analyzeConfiguration(
      byArchetype.get('heavy_lift')!,
      componentsById,
      HOVER_30_MIN,
    );
    expect(result.status).toBe('converged');
    expect(result.reasons).toEqual([]);
    expect(result.metrics['mtowKg']!).toBeGreaterThan(3);
    expect(result.metrics['twRatio']!).toBeGreaterThanOrEqual(1.6);
  });

  it('infeasible: 90 min endurance on the R-Line pack diverges with an explanation', () => {
    const result = analyzeConfiguration(
      byArchetype.get('fpv_highspeed')!,
      componentsById,
      HOVER_90_MIN,
    );
    expect(result.status).toBe('diverged');
    expect(result.reasons[0]).toMatch(/does not close/);
    expect(result.iterTrace.length).toBeGreaterThan(2);
    // The snowball is visible in the trace: mtow grows well past its start
    // (the final entries may be Aitken candidates pulled back toward zero).
    const trace = result.iterTrace;
    expect(Math.max(...trace)).toBeGreaterThan(trace[0]! * 2);
  });

  it('reports the full SPEC §6 metric set with pedigree versions', () => {
    const result = analyzeConfiguration(
      byArchetype.get('endurance_quad')!,
      componentsById,
      HOVER_40_MIN,
    );
    for (const key of [
      'mtowKg',
      'pHoverW',
      'pCruiseW',
      'enduranceMin',
      'vMaxMs',
      'unitCostUsd',
      'battFrac',
      'pitchDeg',
    ]) {
      expect(result.metrics[key], key).toBeTypeOf('number');
      expect(Number.isFinite(result.metrics[key]!), key).toBe(true);
    }
    expect(Object.keys(result.modelVersions)).toHaveLength(7);
    expect(result.iterTrace.length).toBeGreaterThan(2);
  });

  it('flags a configuration missing a battery as invalid, not a crash', () => {
    const config = byArchetype.get('endurance_quad')!;
    const noBattery: Configuration = {
      ...config,
      instances: config.instances.filter((i) => i.role !== 'battery'),
    };
    const result = analyzeConfiguration(noBattery, componentsById, HOVER_30_MIN);
    expect(result.status).toBe('invalid');
    expect(result.reasons.join(' ')).toContain('missing role: battery');
  });
});
