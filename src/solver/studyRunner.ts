/**
 * Study case execution — pure (no repository access), shared between the
 * Web Worker and tests. Applies a DOE input vector onto the active
 * configuration's mission/payload, runs the sizing analysis, and hashes the
 * inputs for the pedigree/dedup cache (SPEC §8).
 */
import type { CaseStatus, Component, Configuration } from '../db/schema';
import { canonicalHash } from '../db/hash';
import {
  analyzeConfiguration,
  type MissionSegment,
} from '../models/sizing';

/** Variable paths understood by applyVector. */
export const STUDY_VARIABLES = [
  { path: 'mission.hoverDurationS', label: 'Hover duration', unit: 's' },
  { path: 'mission.cruiseDurationS', label: 'Cruise duration', unit: 's' },
  { path: 'mission.cruiseSpeedMs', label: 'Cruise speed', unit: 'm/s' },
  { path: 'payload.massKg', label: 'Payload mass', unit: 'kg' },
] as const;

export interface StudyCase {
  index: number;
  inputVector: Record<string, number>;
  inputHash: string;
  status: CaseStatus;
  metrics: Record<string, number>;
  iterTrace: number[];
  reasons: string[];
  modelVersions: Record<string, string>;
}

export function applyVector(
  config: Configuration,
  components: Component[],
  baseMission: MissionSegment[],
  vector: Record<string, number>,
): { components: Component[]; mission: MissionSegment[] } {
  const mission: MissionSegment[] = baseMission.map((s) => ({ ...s }));

  const ensureSegment = (kind: 'hover' | 'cruise'): MissionSegment => {
    let seg = mission.find((s) => s.kind === kind);
    if (!seg) {
      seg = { kind, durationS: 0, ...(kind === 'cruise' ? { speedMs: 15 } : {}) };
      mission.push(seg);
    }
    return seg;
  };

  if (vector['mission.hoverDurationS'] !== undefined) {
    ensureSegment('hover').durationS = vector['mission.hoverDurationS'];
  }
  if (vector['mission.cruiseDurationS'] !== undefined) {
    ensureSegment('cruise').durationS = vector['mission.cruiseDurationS'];
  }
  if (vector['mission.cruiseSpeedMs'] !== undefined) {
    ensureSegment('cruise').speedMs = vector['mission.cruiseSpeedMs'];
  }

  let outComponents = components;
  if (vector['payload.massKg'] !== undefined) {
    const payloadIds = new Set(
      config.instances
        .filter((i) => i.role === 'payload')
        .map((i) => i.componentId),
    );
    outComponents = components.map((c) =>
      payloadIds.has(c.id) ? { ...c, massKg: vector['payload.massKg']! } : c,
    );
  }
  return { components: outComponents, mission };
}

export async function runStudyCase(
  index: number,
  config: Configuration,
  components: Component[],
  baseMission: MissionSegment[],
  inputVector: Record<string, number>,
): Promise<StudyCase> {
  const { components: applied, mission } = applyVector(
    config,
    components,
    baseMission,
    inputVector,
  );
  const byId = new Map(applied.map((c) => [c.id, c]));
  const result = analyzeConfiguration(config, byId, mission);
  const inputHash = await canonicalHash({
    configurationId: config.id,
    inputVector,
  });
  return {
    index,
    inputVector,
    inputHash,
    status: result.status,
    metrics: result.metrics,
    iterTrace: result.iterTrace,
    reasons: result.reasons,
    modelVersions: result.modelVersions,
  };
}
