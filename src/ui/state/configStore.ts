/**
 * Configuration-domain store. All persistence flows through the repository
 * (SPEC §5) — this store is a UI cache plus mutation actions.
 */
import { create } from 'zustand';
import { getDb } from '../../db/repository';
import type { Component, Configuration } from '../../db/schema';

function newId(): string {
  return crypto.randomUUID();
}

interface ConfigState {
  loaded: boolean;
  components: Component[];
  componentsById: Map<string, Component>;
  configurations: Configuration[];
  activeId: string | null;
  init: () => Promise<void>;
  setActive: (id: string) => void;
  createConfiguration: (name: string) => Promise<void>;
  addInstance: (componentId: string, count?: number) => Promise<void>;
  setInstanceCount: (componentId: string, role: string, count: number) => Promise<void>;
  removeInstance: (componentId: string, role: string) => Promise<void>;
  resetDemoData: () => Promise<void>;
}

async function persistActive(
  get: () => ConfigState,
  mutate: (config: Configuration) => Configuration,
): Promise<Configuration[]> {
  const { activeId, configurations } = get();
  const active = configurations.find((c) => c.id === activeId);
  if (!active) return configurations;
  const updated = mutate(active);
  await getDb().configurations.update(updated);
  return configurations.map((c) => (c.id === updated.id ? updated : c));
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  loaded: false,
  components: [],
  componentsById: new Map(),
  configurations: [],
  activeId: null,

  init: async () => {
    if (get().loaded) return;
    const db = getDb();
    const [components, configurations] = await Promise.all([
      db.components.list(),
      db.configurations.list(),
    ]);
    set({
      loaded: true,
      components,
      componentsById: new Map(components.map((c) => [c.id, c])),
      configurations,
      activeId: configurations[0]?.id ?? null,
    });
  },

  setActive: (id) => set({ activeId: id }),

  createConfiguration: async (name) => {
    const config: Configuration = {
      id: newId(),
      name,
      parentId: null,
      status: 'draft',
      archetype: 'fpv_highspeed',
      instances: [],
      cuiMarking: null,
    };
    await getDb().configurations.create(config);
    set((s) => ({
      configurations: [...s.configurations, config],
      activeId: config.id,
    }));
  },

  addInstance: async (componentId, count) => {
    const component = get().componentsById.get(componentId);
    if (!component) return;
    const defaultCount =
      count ?? (component.cls === 'motor' || component.cls === 'prop' ? 4 : 1);
    const configurations = await persistActive(get, (config) => {
      const existing = config.instances.find(
        (i) => i.componentId === componentId && i.role === component.cls,
      );
      if (existing) {
        return {
          ...config,
          instances: config.instances.map((i) =>
            i === existing ? { ...i, count: i.count + defaultCount } : i,
          ),
        };
      }
      return {
        ...config,
        instances: [
          ...config.instances,
          { componentId, role: component.cls, count: defaultCount },
        ],
      };
    });
    set({ configurations });
  },

  setInstanceCount: async (componentId, role, count) => {
    const configurations = await persistActive(get, (config) => ({
      ...config,
      instances: config.instances.map((i) =>
        i.componentId === componentId && i.role === role
          ? { ...i, count: Math.max(1, count) }
          : i,
      ),
    }));
    set({ configurations });
  },

  removeInstance: async (componentId, role) => {
    const configurations = await persistActive(get, (config) => ({
      ...config,
      instances: config.instances.filter(
        (i) => !(i.componentId === componentId && i.role === role),
      ),
    }));
    set({ configurations });
  },

  resetDemoData: async () => {
    await getDb().reset();
    const db = getDb();
    const [components, configurations] = await Promise.all([
      db.components.list(),
      db.configurations.list(),
    ]);
    set({
      components,
      componentsById: new Map(components.map((c) => [c.id, c])),
      configurations,
      activeId: configurations[0]?.id ?? null,
    });
  },
}));
