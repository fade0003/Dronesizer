/**
 * Round-trip acceptance (SPEC §9): GUI config → text → parse → deep-equal
 * config (instance set identity via @catalog overrides).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../db/repository';
import { fromConfig } from '../fromConfig';
import { parseSysml } from '../parse';
import { toConfig } from '../toConfig';
import type { Component, Configuration } from '../../db/schema';

let catalog: Component[];
let componentsById: Map<string, Component>;
let configurations: Configuration[];

beforeAll(async () => {
  const db = createDb();
  catalog = await db.components.list();
  componentsById = new Map(catalog.map((c) => [c.id, c]));
  configurations = await db.configurations.list();
});

const sortKey = (i: { componentId: string; role: string }) =>
  `${i.role}:${i.componentId}`;

describe('SysML round-trip (SPEC §9)', () => {
  it('every seeded configuration survives config → text → parse → config', () => {
    for (const config of configurations) {
      const text = fromConfig(config, componentsById);
      const parsed = parseSysml(text);
      expect(parsed.ok, `${config.name}: ${text}`).toBe(true);
      if (!parsed.ok) continue;
      const { configuration: rebuilt, adHocComponents } = toConfig(
        parsed.package,
        catalog,
      );
      expect(adHocComponents, config.name).toHaveLength(0);
      const expected = [...config.instances].sort((a, b) =>
        sortKey(a).localeCompare(sortKey(b)),
      );
      const actual = [...rebuilt.instances].sort((a, b) =>
        sortKey(a).localeCompare(sortKey(b)),
      );
      expect(actual, config.name).toEqual(expected);
    }
  });

  it('generated text is canonical (idempotent through a second trip)', () => {
    const config = configurations[0]!;
    const text1 = fromConfig(config, componentsById);
    const parsed = parseSysml(text1);
    if (!parsed.ok) return;
    const { configuration: rebuilt } = toConfig(parsed.package, catalog);
    const text2 = fromConfig(
      { ...rebuilt, name: config.name },
      componentsById,
    );
    expect(text2).toBe(text1);
  });
});
