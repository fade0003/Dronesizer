/**
 * Repository interfaces — the swap boundary (SPEC §5).
 * Everything outside src/db/ talks to the database exclusively through these
 * interfaces. All methods are async so a REST implementation (restStore.ts)
 * is signature-identical to the in-browser jsonStore.
 */
import type {
  AnalysisModel,
  Archetype,
  CaseRow,
  Component,
  ComponentClass,
  Configuration,
  ParetoSet,
  ResultRow,
  Study,
} from './schema';
import { JsonStore, type StorageLike } from './jsonStore';

export interface ComponentRepo {
  get(id: string): Promise<Component | undefined>;
  list(filter?: { cls?: ComponentClass }): Promise<Component[]>;
  create(component: Component): Promise<Component>;
  update(component: Component): Promise<Component>;
  remove(id: string): Promise<boolean>;
}

export interface ConfigRepo {
  get(id: string): Promise<Configuration | undefined>;
  list(filter?: {
    archetype?: Archetype;
    status?: Configuration['status'];
  }): Promise<Configuration[]>;
  create(config: Configuration): Promise<Configuration>;
  update(config: Configuration): Promise<Configuration>;
  remove(id: string): Promise<boolean>;
}

export interface StudyRepo {
  get(id: string): Promise<Study | undefined>;
  list(): Promise<Study[]>;
  create(study: Study): Promise<Study>;
  update(study: Study): Promise<Study>;
  remove(id: string): Promise<boolean>;
  createCase(caseRow: CaseRow): Promise<CaseRow>;
  updateCase(caseRow: CaseRow): Promise<CaseRow>;
  listCases(studyId: string): Promise<CaseRow[]>;
  getCase(id: string): Promise<CaseRow | undefined>;
  savePareto(set: ParetoSet): Promise<ParetoSet>;
  getPareto(studyId: string): Promise<ParetoSet | undefined>;
}

export interface ResultRepo {
  get(id: string): Promise<ResultRow | undefined>;
  listByCase(caseId: string): Promise<ResultRow[]>;
  create(result: ResultRow): Promise<ResultRow>;
  /**
   * Pedigree/dedup cache (SPEC §8): identical inputHash + identical
   * modelVersions ⇒ reuse the prior ResultRow.
   */
  findByHash(
    inputHash: string,
    modelVersions: Record<string, string>,
  ): Promise<ResultRow | undefined>;
}

export interface ModelRepo {
  list(): Promise<AnalysisModel[]>;
  get(name: string, version: string): Promise<AnalysisModel | undefined>;
}

export interface Db {
  components: ComponentRepo;
  configurations: ConfigRepo;
  studies: StudyRepo;
  results: ResultRepo;
  models: ModelRepo;
  /**
   * Group many writes into one persistence flush (e.g. streaming DOE case
   * rows). Semantically a no-op for backends with per-request persistence.
   */
  batch<T>(fn: () => Promise<T>): Promise<T>;
  /** Serialize the whole store for download (.json export). */
  exportJson(): Promise<string>;
  /** Replace store contents from a previously exported snapshot. */
  importJson(json: string): Promise<void>;
  /** "Reset demo data": drop everything and re-seed. */
  reset(): Promise<void>;
}

let singleton: Db | undefined;

/** App-wide database instance, persisted to localStorage when available. */
export function getDb(): Db {
  if (!singleton) {
    const storage =
      typeof localStorage === 'undefined' ? null : (localStorage as StorageLike);
    singleton = new JsonStore({ storage });
  }
  return singleton;
}

/** Fresh, isolated instance — used by tests. */
export function createDb(options?: { storage?: StorageLike | null }): Db {
  return new JsonStore({ storage: options?.storage ?? null });
}
