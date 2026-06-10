/**
 * Run-domain store: point analysis of the active configuration. Writes the
 * CaseRow + ResultRow pedigree records through the repository (SPEC §8).
 */
import { create } from 'zustand';
import { getDb } from '../../db/repository';
import { canonicalHash } from '../../db/hash';
import { analyzeConfiguration, type SizingResult } from '../../models/sizing';
import type { Component, Configuration } from '../../db/schema';
import { MISSION_PROFILES, type MissionProfile } from '../missions';

export interface RunRecord {
  result: SizingResult;
  inputHash: string;
  ranAt: string;
  configName: string;
  missionName: string;
}

interface RunState {
  missionId: string;
  running: boolean;
  record: RunRecord | null;
  setMission: (id: string) => void;
  run: (
    config: Configuration,
    componentsById: Map<string, Component>,
  ) => Promise<void>;
}

function missionById(id: string): MissionProfile {
  return MISSION_PROFILES.find((m) => m.id === id) ?? MISSION_PROFILES[0]!;
}

export const useRunStore = create<RunState>((set, get) => ({
  missionId: MISSION_PROFILES[0]!.id,
  running: false,
  record: null,

  setMission: (id) => set({ missionId: id }),

  run: async (config, componentsById) => {
    set({ running: true });
    try {
      const mission = missionById(get().missionId);
      const result = analyzeConfiguration(config, componentsById, mission.segments);

      // Pedigree: flatten the inputs that define this case and hash them.
      const inputVector: Record<string, number> = {};
      mission.segments.forEach((seg, i) => {
        inputVector[`mission.${i}.durationS`] = seg.durationS;
        if (seg.speedMs !== undefined) {
          inputVector[`mission.${i}.speedMs`] = seg.speedMs;
        }
      });
      config.instances.forEach((inst) => {
        inputVector[`instance.${inst.role}.${inst.componentId}.count`] = inst.count;
      });
      const inputHash = await canonicalHash(inputVector);
      const ranAt = new Date().toISOString();

      // Write the pedigree rows through the repository.
      const db = getDb();
      const studyId = crypto.randomUUID();
      const caseId = crypto.randomUUID();
      await db.studies.create({
        id: studyId,
        name: `point: ${config.name} / ${mission.name}`,
        type: 'point',
        configurationId: config.id,
        variables: [],
        status: 'complete',
        createdAt: ranAt,
      });
      await db.studies.createCase({
        id: caseId,
        studyId,
        configurationId: config.id,
        inputVector,
        inputHash,
        status: result.status,
      });
      await db.results.create({
        id: crypto.randomUUID(),
        caseId,
        modelVersions: result.modelVersions,
        metrics: result.metrics,
        iterTrace: result.iterTrace,
        createdAt: ranAt,
      });

      set({
        record: {
          result,
          inputHash,
          ranAt,
          configName: config.name,
          missionName: mission.name,
        },
      });
    } finally {
      set({ running: false });
    }
  },
}));
