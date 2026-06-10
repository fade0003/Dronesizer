/**
 * Hardcoded mission profiles — P0 scope per SPEC §11 (mission editor UI is
 * P1). Segment powers are computed by the sizing orchestrator.
 */
import type { MissionSegment } from '../models/sizing';

export interface MissionProfile {
  id: string;
  name: string;
  description: string;
  segments: MissionSegment[];
}

export const MISSION_PROFILES: MissionProfile[] = [
  {
    id: 'hover-40',
    name: 'Endurance hover — 40 min',
    description: 'Pure station-keeping; sizes the battery for 40 minutes of hover.',
    segments: [{ kind: 'hover', durationS: 2400 }],
  },
  {
    id: 'sprint',
    name: 'Sprint — 2 min hover + 3 min dash @ 30 m/s',
    description: 'Short high-speed run; exposes drag, pitch, and C-rate limits.',
    segments: [
      { kind: 'hover', durationS: 120 },
      { kind: 'dash', durationS: 180, speedMs: 30 },
    ],
  },
  {
    id: 'camera-10',
    name: 'Camera run — 1 min hover + 9 min cruise @ 16 m/s',
    description: 'A 10-minute filming mission: brief hover, then steady cruise.',
    segments: [
      { kind: 'hover', durationS: 60 },
      { kind: 'cruise', durationS: 540, speedMs: 16 },
    ],
  },
  {
    id: 'hover-90',
    name: 'Long endurance — 90 min hover',
    description: 'Deliberately demanding; shows divergence on packs that cannot close.',
    segments: [{ kind: 'hover', durationS: 5400 }],
  },
];
