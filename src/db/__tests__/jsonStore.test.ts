import { describe, expect, it } from 'vitest';
import { createDb } from '../repository';
import type { StorageLike } from '../jsonStore';
import type { Configuration } from '../schema';

class FakeStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  get size(): number {
    return this.map.size;
  }
}

const EXTRA_CONFIG: Configuration = {
  id: '20000000-0000-4000-8000-000000000099',
  name: 'Persisted Quad',
  parentId: null,
  status: 'draft',
  archetype: 'fpv_highspeed',
  instances: [
    {
      componentId: '00000000-0000-4000-8000-000000000004',
      role: 'motor',
      count: 4,
    },
  ],
  cuiMarking: null,
};

describe('jsonStore persistence and import/export', () => {
  it('persists mutations and rehydrates a new instance from storage', async () => {
    const storage = new FakeStorage();
    const db1 = createDb({ storage });
    await db1.configurations.create(EXTRA_CONFIG);
    expect(storage.size).toBe(1);

    const db2 = createDb({ storage });
    expect((await db2.configurations.get(EXTRA_CONFIG.id))?.name).toBe(
      'Persisted Quad',
    );
    expect(await db2.configurations.list()).toHaveLength(4);
  });

  it('survives a corrupt snapshot by falling back to seed', async () => {
    const storage = new FakeStorage();
    storage.setItem('aether-trade-studio.db.v1', '{not json');
    const db = createDb({ storage });
    expect(await db.configurations.list()).toHaveLength(3);
  });

  it('round-trips through exportJson/importJson', async () => {
    const source = createDb();
    await source.configurations.create(EXTRA_CONFIG);
    const exported = await source.exportJson();

    const target = createDb();
    await target.importJson(exported);

    expect(await target.exportJson()).toBe(exported);
    expect((await target.configurations.get(EXTRA_CONFIG.id))?.archetype).toBe(
      'fpv_highspeed',
    );
    expect((await target.components.list()).length).toBeGreaterThanOrEqual(18);
  });

  it('batch() suspends persistence until the batch completes', async () => {
    const storage = new FakeStorage();
    const db = createDb({ storage });
    let writes = 0;
    const originalSet = storage.setItem.bind(storage);
    storage.setItem = (k, v) => {
      writes++;
      originalSet(k, v);
    };
    await db.batch(async () => {
      await db.configurations.create(EXTRA_CONFIG);
      await db.configurations.create({
        ...EXTRA_CONFIG,
        id: '20000000-0000-4000-8000-000000000098',
        name: 'Second',
      });
    });
    expect(writes).toBe(1); // one flush for the whole batch
    expect(await db.configurations.list()).toHaveLength(5);
    // And the flush actually persisted both rows.
    const reloaded = createDb({ storage });
    expect(await reloaded.configurations.list()).toHaveLength(5);
  });

  it('reset() drops user data and restores the seed', async () => {
    const storage = new FakeStorage();
    const db = createDb({ storage });
    await db.configurations.create(EXTRA_CONFIG);
    expect(await db.configurations.list()).toHaveLength(4);

    await db.reset();
    expect(await db.configurations.list()).toHaveLength(3);
    expect(await db.configurations.get(EXTRA_CONFIG.id)).toBeUndefined();

    // Reset is itself persisted so a reload stays clean.
    const reloaded = createDb({ storage });
    expect(await reloaded.configurations.list()).toHaveLength(3);
  });
});
