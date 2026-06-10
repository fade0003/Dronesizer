import { describe, expect, it } from 'vitest';
import {
  currentModelVersions,
  getModel,
  listRegisteredModels,
} from '../registry';
import { createDb } from '../../db/repository';

describe('analysis model registry (SPEC §5/§7)', () => {
  it('registers the seven fidelity-0 models at 1.0', () => {
    const models = listRegisteredModels();
    expect(models).toHaveLength(7);
    for (const model of models) {
      expect(model.fidelity).toBe(0);
      expect(model.version).toBe('1.0');
    }
  });

  it('resolves name@version lookups', () => {
    expect(getModel('hoverPower', '1.0')?.discipline).toBe('propulsion');
    expect(getModel('hoverPower', '2.0')).toBeUndefined();
    expect(getModel('nope', '1.0')).toBeUndefined();
  });

  it('stays in sync with the db seed registry rows', async () => {
    const db = createDb();
    const seeded = await db.models.list();
    const seededKeys = seeded.map((m) => `${m.name}@${m.version}`).sort();
    const registeredKeys = listRegisteredModels()
      .map((m) => `${m.name}@${m.version}`)
      .sort();
    expect(registeredKeys).toEqual(seededKeys);
  });

  it('produces the pedigree version map for ResultRows', () => {
    const versions = currentModelVersions();
    expect(Object.keys(versions)).toHaveLength(7);
    expect(versions['massRollup']).toBe('1.0');
    expect(versions['limits']).toBe('1.0');
  });
});
