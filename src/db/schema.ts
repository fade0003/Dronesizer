/**
 * Virtual database schema — SPEC §6.
 * Mirror of the production Postgres design. All quantities SI internally;
 * unit conversion happens only at the UI boundary.
 */

export type ComponentClass =
  | 'motor'
  | 'esc'
  | 'prop'
  | 'battery'
  | 'frame'
  | 'fc'
  | 'payload'
  | 'vtx';

/**
 * Param values are scalar except prop `etaCurve`, which SPEC §6 defines as
 * [advanceRatio, eta][] — see DECISIONS.md (D2) for the widening of the
 * abridged Record<string, number|string> signature.
 */
export type ParamValue = number | string | [number, number][];

export interface Component {
  id: string; // uuid
  cls: ComponentClass;
  mfr: string;
  model: string;
  massKg: number;
  unitCostUsd: number;
  /** Class-specific; enforced with zod — see contracts.ts. */
  params: Record<string, ParamValue>;
  /** Provenance: "representative — verify against mfr datasheet before procurement" */
  sourceNote: string;
}

export type Archetype =
  | 'endurance_quad'
  | 'fpv_highspeed'
  | 'heavy_lift'
  | 'vtol_fw';

export interface ConfigurationInstance {
  componentId: string;
  role: string;
  count: number;
}

export interface Configuration {
  id: string;
  name: string;
  parentId: string | null;
  status: 'draft' | 'frozen';
  archetype: Archetype;
  instances: ConfigurationInstance[];
  /** Present, unused — schema parity with production. */
  cuiMarking: null;
}

export interface PortSpec {
  name: string;
  units: string;
  bounds?: [number, number];
}

export interface AnalysisModel {
  name: string;
  version: string;
  discipline: string;
  fidelity: 0 | 1 | 2 | 3;
  inputs: PortSpec[];
  outputs: PortSpec[];
  validity: Record<string, [number, number]>;
}

export type StudyType = 'point' | 'sweep' | 'doe' | 'paretoSweep';

export interface StudyVariable {
  /** Dotted path into the input vector, e.g. "mission.hoverDurationS". */
  path: string;
  min: number;
  max: number;
  /** Grid steps (sweep) — ignored for LHS. */
  steps?: number;
}

export interface Study {
  id: string;
  name: string;
  type: StudyType;
  configurationId: string;
  variables: StudyVariable[];
  /** Case count for DOE (50–1000 per SPEC §8). */
  nCases?: number;
  status: 'pending' | 'running' | 'complete' | 'cancelled';
  createdAt: string; // ISO 8601
}

export type CaseStatus = 'converged' | 'diverged' | 'invalid' | 'pending';

export interface CaseRow {
  id: string;
  studyId: string;
  configurationId: string;
  inputVector: Record<string, number>;
  /** sha-256 of canonical JSON of inputVector — the dedup/pedigree key. */
  inputHash: string;
  status: CaseStatus;
}

export interface ResultRow {
  id: string;
  caseId: string;
  /** modelName → version actually used; part of the cache identity. */
  modelVersions: Record<string, string>;
  /**
   * mtowKg, pHoverW, pCruiseW, enduranceMin, vMaxMs, unitCostUsd,
   * battFrac, pitchDeg
   */
  metrics: Record<string, number>;
  /** Convergence history for the sparkline. */
  iterTrace: number[];
  createdAt: string; // ISO 8601
}

export interface ParetoSet {
  id: string;
  studyId: string;
  /** The two objective metric names, in axis order. */
  objectives: [string, string];
  /** Ordered (along the front) case-id list. */
  caseIds: string[];
  createdAt: string; // ISO 8601
}
