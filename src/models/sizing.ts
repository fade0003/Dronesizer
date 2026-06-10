/**
 * Sizing orchestrator (D14) — composes the SPEC §7 coupling loop:
 *   mBatt → mtow → (pHover, pCruise) → missionEnergy → mBatt
 * solved with solver/gaussSeidel (Aitken, tol 1e-6 on mBatt, maxIter 60).
 *
 * Pure with respect to the database: callers resolve catalog components via
 * the repository and pass them in.
 */
import type { Component, Configuration } from '../db/schema';
import { fixedPoint } from '../solver/gaussSeidel';
import { CELL_NOMINAL_V, IN_TO_M } from './constants';
import { massRollup } from './massRollup';
import { hoverPower } from './hoverPower';
import { forwardFlight, type ForwardFlightParams } from './forwardFlight';
import { batteryEnergy } from './batteryEnergy';
import { missionEnergy, type MissionSegment } from './missionEnergy';
import { costRollup } from './costRollup';
import { limits, limitReasons, type LimitsParams } from './limits';
import { currentModelVersions } from './registry';

export type { MissionSegment } from './missionEnergy';

export interface SizingResult {
  status: 'converged' | 'diverged' | 'invalid';
  /**
   * mtowKg, pHoverW, pCruiseW, enduranceMin (pure hover at converged mass),
   * enduranceCruiseMin, vMaxMs, pitchDeg (at vMax), unitCostUsd, bomCostUsd,
   * battFrac, mBattKg — empty when diverged/invalid-input.
   */
  metrics: Record<string, number>;
  /** mtow history per solver iterate, for the convergence sparkline. */
  iterTrace: number[];
  /** Violation messages (invalid) or the divergence explanation. */
  reasons: string[];
  modelVersions: Record<string, string>;
}

const DEFAULT_CRUISE_MS = 15;
const DEFAULT_DASH_MS = 27;

interface ResolvedParts {
  motor: Component;
  prop: Component;
  battery: Component;
  frame: Component;
  motorCount: number;
  fixedMassKg: number;
  bomCostUsd: number;
  avionicsDrawW: number;
}

function num(component: Component, key: string): number {
  return component.params[key] as number;
}

function resolveParts(
  config: Configuration,
  componentsById: Map<string, Component>,
): { parts?: ResolvedParts; missing: string[] } {
  const byRole = new Map<string, { component: Component; count: number }>();
  let fixedMassKg = 0;
  let bomCostUsd = 0;
  let avionicsDrawW = 0;
  const missing: string[] = [];

  for (const instance of config.instances) {
    const component = componentsById.get(instance.componentId);
    if (!component) {
      missing.push(`unknown component ${instance.componentId}`);
      continue;
    }
    if (!byRole.has(instance.role)) {
      byRole.set(instance.role, { component, count: instance.count });
    }
    bomCostUsd += component.unitCostUsd * instance.count;
    if (component.cls === 'battery') {
      // Battery mass is the cycle variable — excluded from fixed mass.
      continue;
    }
    fixedMassKg += component.massKg * instance.count;
    if (['fc', 'vtx', 'payload'].includes(component.cls)) {
      avionicsDrawW += num(component, 'pDrawW') * instance.count;
    }
  }

  for (const role of ['motor', 'prop', 'battery', 'frame']) {
    if (!byRole.has(role)) missing.push(`missing role: ${role}`);
  }
  if (missing.length > 0) return { missing };

  return {
    missing: [],
    parts: {
      motor: byRole.get('motor')!.component,
      prop: byRole.get('prop')!.component,
      battery: byRole.get('battery')!.component,
      frame: byRole.get('frame')!.component,
      motorCount: byRole.get('motor')!.count,
      fixedMassKg,
      bomCostUsd,
      avionicsDrawW,
    },
  };
}

export function analyzeConfiguration(
  config: Configuration,
  componentsById: Map<string, Component>,
  mission: MissionSegment[],
  options?: { x0?: number },
): SizingResult {
  const modelVersions = currentModelVersions();
  const { parts, missing } = resolveParts(config, componentsById);
  if (!parts) {
    return {
      status: 'invalid',
      metrics: {},
      iterTrace: [],
      reasons: missing,
      modelVersions,
    };
  }

  const propDiamM = num(parts.prop, 'diamIn') * IN_TO_M;
  const diskAreaM2 =
    parts.motorCount * (Math.PI / 4) * propDiamM * propDiamM;
  const vBattV = num(parts.battery, 'cells') * CELL_NOMINAL_V;
  const specificEnergyWhKg = num(parts.battery, 'specificEnergyWhKg');

  const cruiseSpeedMs =
    mission.find((s) => s.kind === 'cruise')?.speedMs ?? DEFAULT_CRUISE_MS;
  const dashSpeedMs =
    mission.find((s) => s.kind === 'dash')?.speedMs ?? DEFAULT_DASH_MS;

  const ffParams: ForwardFlightParams = {
    cdaM2: num(parts.frame, 'cdaM2'),
    cdaTiltFactor: num(parts.frame, 'cdaTiltFactor'),
    diskAreaM2,
    propDiamM,
    etaCurve: parts.prop.params['etaCurve'] as [number, number][],
    kvRpmPerV: num(parts.motor, 'kv'),
    vBattV,
  };

  const hoverParams = { diskAreaM2 };
  const energyParams = { specificEnergyWhKg };
  const missionParams = { segments: mission };
  const needsCruise = mission.some((s) => s.kind === 'cruise');
  const needsDash = mission.some((s) => s.kind === 'dash');

  const powersAt = (mBattKg: number) => {
    const mtowKg = massRollup.fn({ mBattKg }, { fixedMassKg: parts.fixedMassKg })['mtowKg']!;
    const pHoverW = hoverPower.fn({ mtowKg }, hoverParams)['pHoverW']!;
    const pCruiseW = needsCruise
      ? forwardFlight.fn({ mtowKg, speedMs: cruiseSpeedMs, pHoverW }, ffParams)['pCruiseW']!
      : 0;
    const pDashW = needsDash
      ? forwardFlight.fn({ mtowKg, speedMs: dashSpeedMs, pHoverW }, ffParams)['pCruiseW']!
      : pCruiseW;
    return { mtowKg, pHoverW, pCruiseW, pDashW };
  };

  const iteration = (mBattKg: number): number => {
    const { pHoverW, pCruiseW, pDashW } = powersAt(mBattKg);
    const eMissionWh = missionEnergy.fn(
      {
        pHoverW: pHoverW + parts.avionicsDrawW,
        pCruiseW: pCruiseW + parts.avionicsDrawW,
        pDashW: pDashW + parts.avionicsDrawW,
      },
      missionParams,
    )['eMissionWh']!;
    return batteryEnergy.fn({ eMissionWh }, energyParams)['mBattKg']!;
  };

  const solved = fixedPoint(iteration, options?.x0 ?? 0.5, {
    tol: 1e-6,
    maxIter: 60,
  });
  const iterTrace = solved.trace.map((mBatt) => parts.fixedMassKg + mBatt);

  if (solved.status === 'diverged') {
    return {
      status: 'diverged',
      metrics: {},
      iterTrace,
      reasons: [
        'design does not close: each battery increment demands more power ' +
          'than the added energy provides (the battery snowball)',
      ],
      modelVersions,
    };
  }

  // Converged — assemble metrics at the final battery mass.
  const mBattKg = solved.x;
  const { mtowKg, pHoverW, pCruiseW } = powersAt(mBattKg);
  const usableWhPerKg = batteryEnergy.fn({ eMissionWh: 0 }, energyParams)['usableWhPerKg']!;
  const usableWh = mBattKg * usableWhPerKg;

  const pLimitW = Math.min(
    mBattKg * specificEnergyWhKg * num(parts.battery, 'maxC'),
    parts.motorCount * num(parts.motor, 'maxPowerW') * 0.8,
  );
  const ffFinal = forwardFlight.fn(
    { mtowKg, speedMs: cruiseSpeedMs, pHoverW },
    { ...ffParams, pLimitW },
  );
  const vMaxMs = ffFinal['vMaxMs']!;
  const pitchDeg = forwardFlight.fn(
    { mtowKg, speedMs: vMaxMs, pHoverW },
    ffParams,
  )['pitchDeg']!;

  const cruiseMetricW = needsCruise || needsDash
    ? pCruiseW
    : forwardFlight.fn({ mtowKg, speedMs: cruiseSpeedMs, pHoverW }, ffParams)['pCruiseW']!;

  const cost = costRollup.fn({}, { bomCostUsd: parts.bomCostUsd });

  const metrics: Record<string, number> = {
    mtowKg,
    mBattKg,
    battFrac: mBattKg / mtowKg,
    pHoverW,
    pCruiseW: cruiseMetricW,
    enduranceMin: (usableWh / (pHoverW + parts.avionicsDrawW)) * 60,
    enduranceCruiseMin:
      (usableWh / (cruiseMetricW + parts.avionicsDrawW)) * 60,
    vMaxMs,
    pitchDeg,
    unitCostUsd: cost['unitCostUsd']!,
    bomCostUsd: cost['bomCostUsd']!,
  };

  const limitsParams: LimitsParams = {
    maxThrustTotalKgf: num(parts.motor, 'maxThrustKgf') * parts.motorCount,
    diskAreaM2,
    specificEnergyWhKg,
    maxC: num(parts.battery, 'maxC'),
    motorCount: parts.motorCount,
    motorMaxPowerW: num(parts.motor, 'maxPowerW'),
    propDiamM,
    kT0: num(parts.prop, 'kT0'),
  };
  const limitOutputs = limits.fn({ mtowKg, pHoverW, mBattKg }, limitsParams);
  const reasons = limitReasons(limitOutputs, limitsParams);
  for (const [key, value] of Object.entries(limitOutputs)) {
    metrics[key] = value;
  }

  return {
    status: reasons.length > 0 ? 'invalid' : 'converged',
    metrics,
    iterTrace,
    reasons,
    modelVersions,
  };
}
