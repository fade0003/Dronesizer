/**
 * In-memory implementation of the Db interface with optional localStorage
 * persistence and JSON import/export — SPEC §5.
 *
 * BOUNDARY: this module may only be imported from within src/db/
 * (enforced by no-restricted-imports in eslint.config.js).
 */
import type {
  AnalysisModel,
  CaseRow,
  Component,
  Configuration,
  ParetoSet,
  ResultRow,
  Study,
} from './schema';
import type {
  ComponentRepo,
  ConfigRepo,
  Db,
  ModelRepo,
  ResultRepo,
  StudyRepo,
} from './repository';
import { loadSeed } from './seedLoader';

/** Minimal Storage surface so tests can inject a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Bump the suffix when the seed catalog changes shape/content so existing
// browsers re-seed instead of carrying a stale snapshot (D23).
const STORAGE_KEY = 'aether-trade-studio.db.v2';

interface Snapshot {
  components: Component[];
  configurations: Configuration[];
  studies: Study[];
  cases: CaseRow[];
  results: ResultRow[];
  paretoSets: ParetoSet[];
  models: AnalysisModel[];
}

function modelKey(name: string, version: string): string {
  return `${name}@${version}`;
}

function sameVersions(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

export class JsonStore implements Db {
  private componentsTable = new Map<string, Component>();
  private configurationsTable = new Map<string, Configuration>();
  private studiesTable = new Map<string, Study>();
  private casesTable = new Map<string, CaseRow>();
  private resultsTable = new Map<string, ResultRow>();
  private paretoTable = new Map<string, ParetoSet>();
  private modelsTable = new Map<string, AnalysisModel>();

  private readonly storage: StorageLike | null;

  constructor(options?: { storage?: StorageLike | null }) {
    this.storage = options?.storage ?? null;
    const stored = this.storage?.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.hydrate(JSON.parse(stored) as Snapshot);
        return;
      } catch {
        // Corrupt snapshot — fall through to a clean seed.
      }
    }
    this.seed();
  }

  // --- lifecycle -----------------------------------------------------------

  private seed(): void {
    const { components, configurations, models } = loadSeed();
    this.componentsTable = new Map(components.map((c) => [c.id, c]));
    this.configurationsTable = new Map(configurations.map((c) => [c.id, c]));
    this.modelsTable = new Map(
      models.map((m) => [modelKey(m.name, m.version), m]),
    );
    this.studiesTable.clear();
    this.casesTable.clear();
    this.resultsTable.clear();
    this.paretoTable.clear();
    this.persist();
  }

  private hydrate(snapshot: Snapshot): void {
    this.componentsTable = new Map(snapshot.components.map((c) => [c.id, c]));
    this.configurationsTable = new Map(
      snapshot.configurations.map((c) => [c.id, c]),
    );
    this.studiesTable = new Map(snapshot.studies.map((s) => [s.id, s]));
    this.casesTable = new Map(snapshot.cases.map((c) => [c.id, c]));
    this.resultsTable = new Map(snapshot.results.map((r) => [r.id, r]));
    this.paretoTable = new Map(snapshot.paretoSets.map((p) => [p.id, p]));
    this.modelsTable = new Map(
      snapshot.models.map((m) => [modelKey(m.name, m.version), m]),
    );
  }

  private snapshot(): Snapshot {
    return {
      components: [...this.componentsTable.values()],
      configurations: [...this.configurationsTable.values()],
      studies: [...this.studiesTable.values()],
      cases: [...this.casesTable.values()],
      results: [...this.resultsTable.values()],
      paretoSets: [...this.paretoTable.values()],
      models: [...this.modelsTable.values()],
    };
  }

  private persistSuspended = false;

  private persist(): void {
    if (this.persistSuspended) return;
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()));
  }

  async batch<T>(fn: () => Promise<T>): Promise<T> {
    this.persistSuspended = true;
    try {
      return await fn();
    } finally {
      this.persistSuspended = false;
      this.persist();
    }
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(this.snapshot(), null, 2);
  }

  async importJson(json: string): Promise<void> {
    this.hydrate(JSON.parse(json) as Snapshot);
    this.persist();
  }

  async reset(): Promise<void> {
    this.storage?.removeItem(STORAGE_KEY);
    this.seed();
  }

  // --- repositories --------------------------------------------------------

  readonly components: ComponentRepo = {
    get: async (id) => this.componentsTable.get(id),
    list: async (filter) => {
      const all = [...this.componentsTable.values()];
      return filter?.cls ? all.filter((c) => c.cls === filter.cls) : all;
    },
    create: async (component) => {
      this.componentsTable.set(component.id, component);
      this.persist();
      return component;
    },
    update: async (component) => {
      if (!this.componentsTable.has(component.id)) {
        throw new Error(`Component not found: ${component.id}`);
      }
      this.componentsTable.set(component.id, component);
      this.persist();
      return component;
    },
    remove: async (id) => {
      const removed = this.componentsTable.delete(id);
      if (removed) this.persist();
      return removed;
    },
  };

  readonly configurations: ConfigRepo = {
    get: async (id) => this.configurationsTable.get(id),
    list: async (filter) => {
      let all = [...this.configurationsTable.values()];
      if (filter?.archetype) {
        all = all.filter((c) => c.archetype === filter.archetype);
      }
      if (filter?.status) {
        all = all.filter((c) => c.status === filter.status);
      }
      return all;
    },
    create: async (config) => {
      this.configurationsTable.set(config.id, config);
      this.persist();
      return config;
    },
    update: async (config) => {
      if (!this.configurationsTable.has(config.id)) {
        throw new Error(`Configuration not found: ${config.id}`);
      }
      this.configurationsTable.set(config.id, config);
      this.persist();
      return config;
    },
    remove: async (id) => {
      const removed = this.configurationsTable.delete(id);
      if (removed) this.persist();
      return removed;
    },
  };

  readonly studies: StudyRepo = {
    get: async (id) => this.studiesTable.get(id),
    list: async () => [...this.studiesTable.values()],
    create: async (study) => {
      this.studiesTable.set(study.id, study);
      this.persist();
      return study;
    },
    update: async (study) => {
      if (!this.studiesTable.has(study.id)) {
        throw new Error(`Study not found: ${study.id}`);
      }
      this.studiesTable.set(study.id, study);
      this.persist();
      return study;
    },
    remove: async (id) => {
      const removed = this.studiesTable.delete(id);
      if (removed) this.persist();
      return removed;
    },
    createCase: async (caseRow) => {
      this.casesTable.set(caseRow.id, caseRow);
      this.persist();
      return caseRow;
    },
    updateCase: async (caseRow) => {
      if (!this.casesTable.has(caseRow.id)) {
        throw new Error(`Case not found: ${caseRow.id}`);
      }
      this.casesTable.set(caseRow.id, caseRow);
      this.persist();
      return caseRow;
    },
    listCases: async (studyId) =>
      [...this.casesTable.values()].filter((c) => c.studyId === studyId),
    getCase: async (id) => this.casesTable.get(id),
    savePareto: async (set) => {
      this.paretoTable.set(set.id, set);
      this.persist();
      return set;
    },
    getPareto: async (studyId) =>
      [...this.paretoTable.values()].find((p) => p.studyId === studyId),
  };

  readonly results: ResultRepo = {
    get: async (id) => this.resultsTable.get(id),
    listByCase: async (caseId) =>
      [...this.resultsTable.values()].filter((r) => r.caseId === caseId),
    create: async (result) => {
      this.resultsTable.set(result.id, result);
      this.persist();
      return result;
    },
    findByHash: async (inputHash, modelVersions) => {
      for (const result of this.resultsTable.values()) {
        const caseRow = this.casesTable.get(result.caseId);
        if (
          caseRow?.inputHash === inputHash &&
          sameVersions(result.modelVersions, modelVersions)
        ) {
          return result;
        }
      }
      return undefined;
    },
  };

  readonly models: ModelRepo = {
    list: async () => [...this.modelsTable.values()],
    get: async (name, version) => this.modelsTable.get(modelKey(name, version)),
  };
}
