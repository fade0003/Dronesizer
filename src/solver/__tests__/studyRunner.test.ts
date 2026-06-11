import { beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../db/repository';
import { latinHypercube } from '../doe';
import { applyVector, runStudyCase } from '../studyRunner';
import type { Component, Configuration } from '../../db/schema';
import type { MissionSegment } from '../../models/sizing';

let components: Component[];
let endurance: Configuration;

const BASE_MISSION: MissionSegment[] = [
  { kind: 'hover', durationS: 60 },
  { kind: 'cruise', durationS: 540, speedMs: 16 },
];

const VARS = [
  { path: 'mission.hoverDurationS', min: 60, max: 1800 },
  { path: 'mission.cruiseDurationS', min: 0, max: 1200 },
  { path: 'mission.cruiseSpeedMs', min: 8, max: 30 },
];

beforeAll(async () => {
  const db = createDb();
  components = await db.components.list();
  const configs = await db.configurations.list();
  endurance = configs.find((c) => c.archetype === 'endurance_quad')!;
});

describe('study runner (SPEC §8)', () => {
  it('applyVector overrides mission segments and payload mass', () => {
    const { mission } = applyVector(endurance, components, BASE_MISSION, {
      'mission.hoverDurationS': 900,
      'mission.cruiseSpeedMs': 22,
    });
    expect(mission.find((s) => s.kind === 'hover')?.durationS).toBe(900);
    expect(mission.find((s) => s.kind === 'cruise')?.speedMs).toBe(22);
    // Base mission untouched (no mutation).
    expect(BASE_MISSION[0]!.durationS).toBe(60);

    const { components: swapped } = applyVector(
      endurance,
      components,
      BASE_MISSION,
      { 'payload.massKg': 0.4 },
    );
    const payloadIds = new Set(
      endurance.instances.filter((i) => i.role === 'payload').map((i) => i.componentId),
    );
    for (const c of swapped) {
      if (payloadIds.has(c.id)) expect(c.massKg).toBe(0.4);
    }
  });

  it('longer hover demands more battery (vector actually applies)', async () => {
    // Note: below ~700 s the sized Li-ion pack is so small its 4C limit
    // trips at hover power (status invalid) — physically correct, so the
    // comparison uses two feasible durations.
    const short = await runStudyCase(0, endurance, components, BASE_MISSION, {
      'mission.hoverDurationS': 900,
      'mission.cruiseDurationS': 0,
    });
    const long = await runStudyCase(1, endurance, components, BASE_MISSION, {
      'mission.hoverDurationS': 1800,
      'mission.cruiseDurationS': 0,
    });
    expect(short.status).toBe('converged');
    expect(long.status).toBe('converged');
    expect(long.metrics['mBattKg']!).toBeGreaterThan(short.metrics['mBattKg']!);
  });

  it('identical inputs hash identically; different inputs differ', async () => {
    const v = { 'mission.hoverDurationS': 600 };
    const a = await runStudyCase(0, endurance, components, BASE_MISSION, v);
    const b = await runStudyCase(1, endurance, components, BASE_MISSION, { ...v });
    expect(a.inputHash).toBe(b.inputHash);
    const c = await runStudyCase(2, endurance, components, BASE_MISSION, {
      'mission.hoverDurationS': 601,
    });
    expect(c.inputHash).not.toBe(a.inputHash);
  });

  it('runs a 200-case LHS DOE in well under 10 seconds (SPEC §11)', async () => {
    const vectors = latinHypercube(VARS, 200, 1);
    const start = performance.now();
    const results = await Promise.all(
      vectors.map((v, i) => runStudyCase(i, endurance, components, BASE_MISSION, v)),
    );
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10000);
    expect(results).toHaveLength(200);
    const statuses = new Set(results.map((r) => r.status));
    // The envelope includes both feasible and infeasible corners.
    expect(statuses.has('converged')).toBe(true);
    for (const r of results) {
      expect(['converged', 'diverged', 'invalid']).toContain(r.status);
    }
  }, 15000);
});
