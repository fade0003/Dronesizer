/**
 * forwardFlight@1.0 — SPEC §7. The forward-pitch high-speed model.
 *
 * - Drag/pitch circularity: CdA_eff = cdaM2·(1 + cdaTiltFactor·θ),
 *   θ = atan(D/(mtow·g)) — 5 fixed-point iterations.
 * - Required thrust T = √((mtow·g)² + D²).
 * - Induced power (Glauert): solve vi from T = 2ρA·vi·√(V² + vi²) by
 *   Newton's method (hover value as initial guess); P_ind = κ·T·vi, κ = 1.15.
 * - P_par = D·V; P_prof = 0.15·pHover (fixed fraction at fidelity 0).
 * - pCruise = (P_ind + P_par + P_prof) / ηDrive / ηProp(J), with
 *   J = V/(n·D_prop) and n = kv·V_batt·0.85/60 (rev/s).
 * - vMax: bisect for pCruise(V) = pLimit (supplied by the orchestrator as
 *   min(battery C-limit power, Σ motor maxPowerW·0.8)).
 */
import { G_MS2, RHO_KG_M3 } from './constants';
import type { RegisteredModel } from './types';

export interface ForwardFlightParams {
  cdaM2: number;
  /** CdA multiplier per rad of pitch. */
  cdaTiltFactor: number;
  /** Total disk area (all rotors). */
  diskAreaM2: number;
  /** Prop diameter in metres. */
  propDiamM: number;
  /** [advanceRatio, eta][] from the prop catalog entry. */
  etaCurve: [number, number][];
  kvRpmPerV: number;
  vBattV: number;
  etaDrive?: number; // default 0.85
  kappa?: number; // induced power factor, default 1.15
  profileFrac?: number; // P_prof = frac·pHover, default 0.15
  rhoKgM3?: number;
  /** Power ceiling for the vMax bisection; omit to skip vMax. */
  pLimitW?: number;
  /** Speed cap for the bisection bracket (default 80 m/s). */
  vMaxCapMs?: number;
}

export function interpolateEta(
  curve: [number, number][],
  advanceRatio: number,
): number {
  const first = curve[0]!;
  const last = curve[curve.length - 1]!;
  if (advanceRatio <= first[0]) return first[1];
  if (advanceRatio >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const [j1, e1] = curve[i - 1]!;
    const [j2, e2] = curve[i]!;
    if (advanceRatio <= j2) {
      const t = (advanceRatio - j1) / (j2 - j1);
      return e1 + t * (e2 - e1);
    }
  }
  return last[1];
}

interface CruisePoint {
  pCruiseW: number;
  pitchRad: number;
  dragN: number;
}

function cruisePoint(
  mtowKg: number,
  speedMs: number,
  pHoverW: number,
  p: ForwardFlightParams,
): CruisePoint {
  const rho = p.rhoKgM3 ?? RHO_KG_M3;
  const etaDrive = p.etaDrive ?? 0.85;
  const kappa = p.kappa ?? 1.15;
  const profileFrac = p.profileFrac ?? 0.15;
  const weightN = mtowKg * G_MS2;

  if (speedMs < 0.1) {
    // Degenerate to hover (D20).
    return { pCruiseW: pHoverW, pitchRad: 0, dragN: 0 };
  }

  // θ ↔ D circularity: 5 fixed-point iterations (SPEC: converges fast).
  let pitchRad = 0;
  let dragN = 0;
  for (let i = 0; i < 5; i++) {
    const cdaEff = p.cdaM2 * (1 + p.cdaTiltFactor * pitchRad);
    dragN = 0.5 * rho * speedMs * speedMs * cdaEff;
    pitchRad = Math.atan(dragN / weightN);
  }

  const thrustN = Math.hypot(weightN, dragN);

  // Glauert induced velocity: T = 2ρA·vi·√(V² + vi²), Newton from hover vi.
  const twoRhoA = 2 * rho * p.diskAreaM2;
  let vi = Math.sqrt(thrustN / twoRhoA);
  for (let i = 0; i < 25; i++) {
    const root = Math.sqrt(speedMs * speedMs + vi * vi);
    const f = twoRhoA * vi * root - thrustN;
    const fPrime = twoRhoA * (root + (vi * vi) / root);
    const next = vi - f / fPrime;
    if (!Number.isFinite(next) || next <= 0) break;
    if (Math.abs(next - vi) < 1e-9) {
      vi = next;
      break;
    }
    vi = next;
  }

  const pInducedW = kappa * thrustN * vi;
  const pParasiteW = dragN * speedMs;
  const pProfileW = profileFrac * pHoverW;

  // Advance ratio from the motor rpm estimate n = kv·V_batt·0.85/60 (rev/s).
  const n = (p.kvRpmPerV * p.vBattV * 0.85) / 60;
  const advanceRatio = speedMs / (n * p.propDiamM);
  const etaProp = Math.max(interpolateEta(p.etaCurve, advanceRatio), 0.05);

  return {
    pCruiseW: (pInducedW + pParasiteW + pProfileW) / etaDrive / etaProp,
    pitchRad,
    dragN,
  };
}

function bisectVMax(
  mtowKg: number,
  pHoverW: number,
  pLimitW: number,
  p: ForwardFlightParams,
): number {
  const cap = p.vMaxCapMs ?? 80;
  const power = (v: number) => cruisePoint(mtowKg, v, pHoverW, p).pCruiseW;
  if (power(cap) <= pLimitW) return cap;
  let lo = 0.5;
  let hi = cap;
  if (power(lo) >= pLimitW) return 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (power(mid) > pLimitW) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return (lo + hi) / 2;
}

export const forwardFlight: RegisteredModel<ForwardFlightParams> = {
  name: 'forwardFlight',
  version: '1.0',
  discipline: 'aerodynamics',
  fidelity: 0,
  validity: { speedMs: [0, 80], pitchDeg: [0, 85] },
  fn: (inputs, params) => {
    const mtowKg = inputs['mtowKg']!;
    const speedMs = inputs['speedMs']!;
    const pHoverW = inputs['pHoverW']!;
    const point = cruisePoint(mtowKg, speedMs, pHoverW, params);
    const vMaxMs =
      params.pLimitW !== undefined && Number.isFinite(params.pLimitW)
        ? bisectVMax(mtowKg, pHoverW, params.pLimitW, params)
        : Number.NaN;
    return {
      pCruiseW: point.pCruiseW,
      pitchDeg: (point.pitchRad * 180) / Math.PI,
      dragN: point.dragN,
      vMaxMs,
    };
  },
};
