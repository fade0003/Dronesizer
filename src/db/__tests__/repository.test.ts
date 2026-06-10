import { describe, expect, it } from 'vitest';
import { createDb } from '../repository';
import type { CaseRow, Configuration, ResultRow, Study } from '../schema';

const CONFIG_ID = '20000000-0000-4000-8000-000000000001';

function draftConfig(): Configuration {
  return {
    id: CONFIG_ID,
    name: 'Test Quad',
    parentId: null,
    status: 'draft',
    archetype: 'endurance_quad',
    instances: [
      {
        componentId: '00000000-0000-4000-8000-000000000002',
        role: 'motor',
        count: 4,
      },
    ],
    cuiMarking: null,
  };
}

function study(id: string): Study {
  return {
    id,
    name: 'doe-200',
    type: 'doe',
    configurationId: CONFIG_ID,
    variables: [{ path: 'mission.hoverDurationS', min: 300, max: 3600 }],
    nCases: 200,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

function caseRow(id: string, studyId: string, inputHash: string): CaseRow {
  return {
    id,
    studyId,
    configurationId: CONFIG_ID,
    inputVector: { 'mission.hoverDurationS': 1800 },
    inputHash,
    status: 'pending',
  };
}

function resultRow(
  id: string,
  caseId: string,
  modelVersions: Record<string, string>,
): ResultRow {
  return {
    id,
    caseId,
    modelVersions,
    metrics: { mtowKg: 6.0, pHoverW: 661 },
    iterTrace: [3.3, 5.1, 5.8, 6.0],
    createdAt: new Date().toISOString(),
  };
}

describe('repository CRUD through the Db interface', () => {
  it('seeds components and configurations on first load', async () => {
    const db = createDb();
    expect((await db.components.list()).length).toBeGreaterThanOrEqual(18);
    expect(await db.configurations.list()).toHaveLength(3);
    expect((await db.models.list()).length).toBe(7);
  });

  it('filters components by class', async () => {
    const db = createDb();
    const motors = await db.components.list({ cls: 'motor' });
    expect(motors.length).toBeGreaterThanOrEqual(5);
    expect(motors.every((m) => m.cls === 'motor')).toBe(true);
  });

  it('looks up analysis models by name@version', async () => {
    const db = createDb();
    const model = await db.models.get('hoverPower', '1.0');
    expect(model?.discipline).toBe('propulsion');
    expect(await db.models.get('hoverPower', '9.9')).toBeUndefined();
  });

  it('creates, updates, freezes, and removes a configuration', async () => {
    const db = createDb();
    await db.configurations.create(draftConfig());
    const created = await db.configurations.get(CONFIG_ID);
    expect(created?.status).toBe('draft');

    await db.configurations.update({ ...draftConfig(), status: 'frozen' });
    expect((await db.configurations.get(CONFIG_ID))?.status).toBe('frozen');

    const frozen = await db.configurations.list({ status: 'frozen' });
    expect(frozen.map((c) => c.id)).toContain(CONFIG_ID);

    expect(await db.configurations.remove(CONFIG_ID)).toBe(true);
    expect(await db.configurations.get(CONFIG_ID)).toBeUndefined();
  });

  it('rejects updates to unknown rows', async () => {
    const db = createDb();
    await expect(db.configurations.update(draftConfig())).rejects.toThrow(
      /not found/i,
    );
  });

  it('stores studies, cases, results, and pareto sets', async () => {
    const db = createDb();
    const s = study('30000000-0000-4000-8000-000000000001');
    await db.studies.create(s);

    const c = caseRow('40000000-0000-4000-8000-000000000001', s.id, 'hash-a');
    await db.studies.createCase(c);
    await db.studies.updateCase({ ...c, status: 'converged' });
    expect((await db.studies.listCases(s.id))[0]?.status).toBe('converged');

    const r = resultRow('50000000-0000-4000-8000-000000000001', c.id, {
      hoverPower: '1.0',
    });
    await db.results.create(r);
    expect((await db.results.listByCase(c.id))[0]?.metrics['mtowKg']).toBe(6.0);

    await db.studies.savePareto({
      id: '60000000-0000-4000-8000-000000000001',
      studyId: s.id,
      objectives: ['enduranceMin', 'unitCostUsd'],
      caseIds: [c.id],
      createdAt: new Date().toISOString(),
    });
    expect((await db.studies.getPareto(s.id))?.caseIds).toEqual([c.id]);
  });

  it('dedup cache: findByHash matches inputHash + identical modelVersions', async () => {
    const db = createDb();
    const s = study('30000000-0000-4000-8000-000000000002');
    await db.studies.create(s);
    const c = caseRow('40000000-0000-4000-8000-000000000002', s.id, 'hash-b');
    await db.studies.createCase(c);
    const r = resultRow('50000000-0000-4000-8000-000000000002', c.id, {
      hoverPower: '1.0',
      massRollup: '1.0',
    });
    await db.results.create(r);

    const hit = await db.results.findByHash('hash-b', {
      hoverPower: '1.0',
      massRollup: '1.0',
    });
    expect(hit?.id).toBe(r.id);

    // Different model version ⇒ cache miss (pedigree pattern, SPEC §8).
    expect(
      await db.results.findByHash('hash-b', {
        hoverPower: '1.1',
        massRollup: '1.0',
      }),
    ).toBeUndefined();
    expect(await db.results.findByHash('hash-x', r.modelVersions)).toBeUndefined();
  });
});
