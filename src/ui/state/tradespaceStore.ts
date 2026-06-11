/**
 * Trade-space domain store — SPEC §8: DOE in a Web Worker with per-case
 * progress, repository writes for every case, inputHash + modelVersions
 * dedup cache, Pareto front persisted as a paretoSet record.
 */
import { create } from 'zustand';
import StudyWorker from '../workers/studyWorker?worker&inline';
import { getDb } from '../../db/repository';
import { canonicalHash } from '../../db/hash';
import { latinHypercube, type VariableSpec } from '../../solver/doe';
import { paretoFront, type Direction } from '../../solver/pareto';
import { currentModelVersions } from '../../models/registry';
import type { StudyCase } from '../../solver/studyRunner';
import type { StudyResponse } from '../workers/studyWorker';
import type { Component, Configuration } from '../../db/schema';
import { MISSION_PROFILES } from '../missions';

export interface MetricAxis {
  key: string;
  label: string;
  better: Direction;
}

export const METRIC_AXES: MetricAxis[] = [
  { key: 'enduranceMin', label: 'Hover endurance (min)', better: 'max' },
  { key: 'enduranceCruiseMin', label: 'Cruise endurance (min)', better: 'max' },
  { key: 'vMaxMs', label: 'Max speed (m/s)', better: 'max' },
  { key: 'mtowKg', label: 'MTOW (kg)', better: 'min' },
  { key: 'mBattKg', label: 'Battery mass (kg)', better: 'min' },
  { key: 'battFrac', label: 'Battery fraction', better: 'min' },
  { key: 'pHoverW', label: 'Hover power (W)', better: 'min' },
  { key: 'pCruiseW', label: 'Cruise power (W)', better: 'min' },
  { key: 'pitchDeg', label: 'Pitch at vMax (deg)', better: 'min' },
  { key: 'unitCostUsd', label: 'Unit cost (USD)', better: 'min' },
];

export interface TradeVariable extends VariableSpec {
  label: string;
  enabled: boolean;
}

const DEFAULT_VARIABLES: TradeVariable[] = [
  { path: 'mission.hoverDurationS', label: 'Hover duration (s)', min: 60, max: 1800, enabled: true },
  { path: 'mission.cruiseDurationS', label: 'Cruise duration (s)', min: 0, max: 1200, enabled: true },
  { path: 'mission.cruiseSpeedMs', label: 'Cruise speed (m/s)', min: 8, max: 30, enabled: true },
  { path: 'payload.massKg', label: 'Payload mass (kg)', min: 0, max: 1.0, enabled: false },
];

interface TradespaceState {
  variables: TradeVariable[];
  nCases: number;
  seed: number;
  running: boolean;
  progress: { done: number; total: number; cacheHits: number };
  elapsedMs: number | null;
  cases: StudyCase[];
  caseIds: Map<number, string>; // case index → CaseRow id
  studyConfigName: string | null;
  xKey: string;
  yKey: string;
  selectedIndex: number | null;
  setVariable: (path: string, patch: Partial<TradeVariable>) => void;
  setNCases: (n: number) => void;
  setAxes: (xKey: string, yKey: string) => void;
  select: (index: number | null) => void;
  runStudy: (config: Configuration, components: Component[]) => Promise<void>;
  paretoIds: () => Set<number>;
}

export const useTradespaceStore = create<TradespaceState>((set, get) => ({
  variables: DEFAULT_VARIABLES,
  nCases: 200,
  seed: 1,
  running: false,
  progress: { done: 0, total: 0, cacheHits: 0 },
  elapsedMs: null,
  cases: [],
  caseIds: new Map(),
  studyConfigName: null,
  xKey: 'mtowKg',
  yKey: 'enduranceMin',
  selectedIndex: null,

  setVariable: (path, patch) =>
    set((s) => ({
      variables: s.variables.map((v) =>
        v.path === path ? { ...v, ...patch } : v,
      ),
    })),
  setNCases: (n) => set({ nCases: Math.min(1000, Math.max(50, Math.round(n))) }),
  setAxes: (xKey, yKey) => set({ xKey, yKey }),
  select: (index) => set({ selectedIndex: index }),

  runStudy: async (config, components) => {
    const { variables, nCases, seed } = get();
    const active = variables.filter((v) => v.enabled);
    if (active.length === 0 || get().running) return;

    set({
      running: true,
      cases: [],
      caseIds: new Map(),
      selectedIndex: null,
      elapsedMs: null,
      studyConfigName: config.name,
      progress: { done: 0, total: nCases, cacheHits: 0 },
    });

    const db = getDb();
    const modelVersions = currentModelVersions();
    const baseMission =
      MISSION_PROFILES.find((m) => m.id === 'camera-10')?.segments ?? [];
    const vectors = latinHypercube(active, nCases, seed);
    const startedAt = new Date().toISOString();
    const studyId = crypto.randomUUID();
    const started = performance.now();

    await db.studies.create({
      id: studyId,
      name: `doe: ${config.name} (${nCases} LHS)`,
      type: 'doe',
      configurationId: config.id,
      variables: active.map(({ path, min, max }) => ({ path, min, max })),
      nCases,
      status: 'running',
      createdAt: startedAt,
    });

    // Dedup pass (SPEC §8): identical hash + model versions reuse results.
    const hashes = await Promise.all(
      vectors.map((v) =>
        canonicalHash({ configurationId: config.id, inputVector: v }),
      ),
    );
    const misses: { index: number; vector: Record<string, number> }[] = [];
    const cached: StudyCase[] = [];
    for (let i = 0; i < vectors.length; i++) {
      const prior = await db.results.findByHash(hashes[i]!, modelVersions);
      if (prior) {
        const priorCase = await db.studies.getCase(prior.caseId);
        cached.push({
          index: i,
          inputVector: vectors[i]!,
          inputHash: hashes[i]!,
          status: priorCase?.status ?? 'converged',
          metrics: prior.metrics,
          iterTrace: prior.iterTrace,
          reasons: [],
          modelVersions: prior.modelVersions,
        });
      } else {
        misses.push({ index: i, vector: vectors[i]! });
      }
    }

    await db.batch(async () => {
      // Cached cases: write CaseRow only; the ResultRow is reused.
      for (const c of cached) {
        const caseId = crypto.randomUUID();
        get().caseIds.set(c.index, caseId);
        await db.studies.createCase({
          id: caseId,
          studyId,
          configurationId: config.id,
          inputVector: c.inputVector,
          inputHash: c.inputHash,
          status: c.status,
        });
      }
    });
    set((s) => ({
      cases: [...cached],
      progress: { ...s.progress, done: cached.length, cacheHits: cached.length },
    }));

    await new Promise<void>((resolve) => {
      if (misses.length === 0) {
        set({ elapsedMs: performance.now() - started });
        resolve();
        return;
      }
      const worker = new StudyWorker();
      const pending: Promise<void>[] = [];
      // The worker sees only cache misses; map its indices back to study indices.
      const indexMap = misses.map((m) => m.index);
      worker.onmessage = (event: MessageEvent<StudyResponse>) => {
        const message = event.data;
        if (message.type === 'case') {
          const c = { ...message.payload, index: indexMap[message.payload.index]! };
          set((s) => ({
            cases: [...s.cases, c],
            progress: { ...s.progress, done: s.progress.done + 1 },
          }));
          pending.push(
            db.batch(async () => {
              const caseId = crypto.randomUUID();
              get().caseIds.set(c.index, caseId);
              await db.studies.createCase({
                id: caseId,
                studyId,
                configurationId: config.id,
                inputVector: c.inputVector,
                inputHash: c.inputHash,
                status: c.status,
              });
              await db.results.create({
                id: crypto.randomUUID(),
                caseId,
                modelVersions: c.modelVersions,
                metrics: c.metrics,
                iterTrace: c.iterTrace,
                createdAt: new Date().toISOString(),
              });
            }),
          );
        } else {
          set({ elapsedMs: message.elapsedMs });
          void Promise.all(pending).then(() => {
            worker.terminate();
            resolve();
          });
        }
      };
      worker.postMessage({
        type: 'run',
        config,
        components,
        baseMission,
        vectors: misses.map((m) => m.vector),
      });
    });

    // Persist the Pareto front for the default axes (SPEC §8).
    const { xKey, yKey, cases, caseIds } = get();
    const xAxis = METRIC_AXES.find((a) => a.key === xKey)!;
    const yAxis = METRIC_AXES.find((a) => a.key === yKey)!;
    const front = paretoFront(
      cases
        .filter((c) => c.status === 'converged')
        .map((c) => ({
          id: String(c.index),
          x: c.metrics[xKey] ?? NaN,
          y: c.metrics[yKey] ?? NaN,
        })),
      xAxis.better,
      yAxis.better,
    );
    await db.studies.savePareto({
      id: crypto.randomUUID(),
      studyId,
      objectives: [xKey, yKey],
      caseIds: front
        .map((idx) => caseIds.get(Number(idx)))
        .filter((id): id is string => id !== undefined),
      createdAt: new Date().toISOString(),
    });
    await db.studies.update({
      id: studyId,
      name: `doe: ${config.name} (${nCases} LHS)`,
      type: 'doe',
      configurationId: config.id,
      variables: active.map(({ path, min, max }) => ({ path, min, max })),
      nCases,
      status: 'complete',
      createdAt: startedAt,
    });
    set({ running: false });
  },

  paretoIds: () => {
    const { cases, xKey, yKey } = get();
    const xAxis = METRIC_AXES.find((a) => a.key === xKey)!;
    const yAxis = METRIC_AXES.find((a) => a.key === yKey)!;
    const front = paretoFront(
      cases
        .filter((c) => c.status === 'converged')
        .map((c) => ({
          id: String(c.index),
          x: c.metrics[xKey] ?? NaN,
          y: c.metrics[yKey] ?? NaN,
        })),
      xAxis.better,
      yAxis.better,
    );
    return new Set(front.map(Number));
  },
}));
