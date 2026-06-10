/**
 * missionEnergy@1.0 — SPEC §7.
 * Profile = ordered segments {kind: 'hover'|'cruise'|'dash', durationS,
 * speedMs?}; energy = Σ P(segment)·t. Segment powers (already including
 * avionics draw, D16) arrive as inputs; the orchestrator computes them.
 */
import type { RegisteredModel } from './types';

export type SegmentKind = 'hover' | 'cruise' | 'dash';

export interface MissionSegment {
  kind: SegmentKind;
  durationS: number;
  speedMs?: number;
}

export interface MissionEnergyParams {
  segments: MissionSegment[];
}

export const missionEnergy: RegisteredModel<MissionEnergyParams> = {
  name: 'missionEnergy',
  version: '1.0',
  discipline: 'mission',
  fidelity: 0,
  validity: { enduranceMin: [0, 300] },
  fn: (inputs, params) => {
    const powerForKind: Record<SegmentKind, number> = {
      hover: inputs['pHoverW']!,
      cruise: inputs['pCruiseW']!,
      dash: inputs['pDashW'] ?? inputs['pCruiseW']!,
    };
    let eMissionWh = 0;
    let durationS = 0;
    for (const segment of params.segments) {
      eMissionWh += (powerForKind[segment.kind] * segment.durationS) / 3600;
      durationS += segment.durationS;
    }
    return { eMissionWh, missionDurationS: durationS };
  },
};
