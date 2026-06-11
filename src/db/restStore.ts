/**
 * REST implementation stub of the Db interface — SPEC §5 acceptance test:
 * this class compiles against repository.ts with zero changes outside db/.
 * Bodies are placeholders for the production FastAPI/Postgres backend (P2);
 * the demo never instantiates it at runtime (no network — SPEC §13).
 */
import type {
  ComponentRepo,
  ConfigRepo,
  Db,
  ModelRepo,
  ResultRepo,
  StudyRepo,
} from './repository';

function notImplemented(): never {
  throw new Error(
    'RestStore is a compile-time stub — production REST backend is SPEC P2.',
  );
}

export class RestStore implements Db {
  constructor(readonly baseUrl: string) {}

  readonly components: ComponentRepo = {
    get: async () => notImplemented(),
    list: async () => notImplemented(),
    create: async () => notImplemented(),
    update: async () => notImplemented(),
    remove: async () => notImplemented(),
  };

  readonly configurations: ConfigRepo = {
    get: async () => notImplemented(),
    list: async () => notImplemented(),
    create: async () => notImplemented(),
    update: async () => notImplemented(),
    remove: async () => notImplemented(),
  };

  readonly studies: StudyRepo = {
    get: async () => notImplemented(),
    list: async () => notImplemented(),
    create: async () => notImplemented(),
    update: async () => notImplemented(),
    remove: async () => notImplemented(),
    createCase: async () => notImplemented(),
    updateCase: async () => notImplemented(),
    listCases: async () => notImplemented(),
    getCase: async () => notImplemented(),
    savePareto: async () => notImplemented(),
    getPareto: async () => notImplemented(),
  };

  readonly results: ResultRepo = {
    get: async () => notImplemented(),
    listByCase: async () => notImplemented(),
    create: async () => notImplemented(),
    findByHash: async () => notImplemented(),
  };

  readonly models: ModelRepo = {
    list: async () => notImplemented(),
    get: async () => notImplemented(),
  };

  async batch<T>(fn: () => Promise<T>): Promise<T> {
    // REST persists per request; batching is a client-side no-op.
    return fn();
  }

  async exportJson(): Promise<string> {
    return notImplemented();
  }

  async importJson(): Promise<void> {
    return notImplemented();
  }

  async reset(): Promise<void> {
    return notImplemented();
  }
}
