/**
 * Zod contracts for the virtual DB schema — SPEC §6.
 * Param contracts per component class are enforced here; the effects models
 * (phase 2) read params through these shapes.
 */
import { z } from 'zod';
import type {
  AnalysisModel,
  Component,
  ComponentClass,
  Configuration,
} from './schema';

const positive = z.number().finite().positive();
const nonNegative = z.number().finite().nonnegative();
const etaPoint = z.tuple([nonNegative, z.number().min(0).max(1)]);

/** Param contracts per component class (SPEC §6). Extra keys are allowed. */
export const paramContracts: Record<ComponentClass, z.ZodTypeAny> = {
  motor: z
    .object({
      kv: positive, // rpm/V
      rmOhm: positive,
      i0A: nonNegative,
      maxPowerW: positive,
      maxThrustKgf: positive, // with stated prop
      statorDiamMm: positive,
    })
    .passthrough(),
  prop: z
    .object({
      diamIn: positive,
      pitchIn: positive,
      kT0: positive, // static thrust coeff proxy
      etaCruisePeak: z.number().gt(0).lte(1),
      etaCurve: z.array(etaPoint).min(3).max(5), // [advanceRatio, eta][]
    })
    .passthrough(),
  battery: z
    .object({
      cells: z.number().int().positive(),
      capacityAh: positive,
      specificEnergyWhKg: positive,
      maxC: positive,
      intResistMohm: positive,
    })
    .passthrough(),
  frame: z
    .object({
      cdaM2: positive, // flat-plate drag area, level
      cdaTiltFactor: nonNegative, // CdA multiplier per rad of pitch
      maxPropIn: positive,
      arms: z.number().int().min(3),
    })
    .passthrough(),
  // ESC contract is unspecified in SPEC §6 — see DECISIONS.md (D3).
  esc: z.object({ maxCurrentA: positive }).passthrough(),
  fc: z.object({ pDrawW: nonNegative }).passthrough(),
  vtx: z.object({ pDrawW: nonNegative }).passthrough(),
  payload: z.object({ pDrawW: nonNegative }).passthrough(),
};

const componentClassSchema = z.enum([
  'motor',
  'esc',
  'prop',
  'battery',
  'frame',
  'fc',
  'payload',
  'vtx',
]);

export const componentSchema = z
  .object({
    id: z.string().uuid(),
    cls: componentClassSchema,
    mfr: z.string().min(1),
    model: z.string().min(1),
    massKg: nonNegative,
    unitCostUsd: nonNegative,
    params: z.record(z.unknown()),
    sourceNote: z.string().min(1),
  })
  .superRefine((c, ctx) => {
    const result = paramContracts[c.cls].safeParse(c.params);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['params', ...issue.path],
          message: `[${c.cls} ${c.mfr} ${c.model}] ${issue.message}`,
        });
      }
    }
  });

export const configurationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  parentId: z.string().uuid().nullable(),
  status: z.enum(['draft', 'frozen']),
  archetype: z.enum(['endurance_quad', 'fpv_highspeed', 'heavy_lift', 'vtol_fw']),
  instances: z
    .array(
      z.object({
        componentId: z.string().uuid(),
        role: z.string().min(1),
        count: z.number().int().positive(),
      }),
    )
    .min(1),
  cuiMarking: z.null(),
});

const portSpecSchema = z.object({
  name: z.string().min(1),
  units: z.string().min(1),
  bounds: z.tuple([z.number(), z.number()]).optional(),
});

export const analysisModelSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
  discipline: z.string().min(1),
  fidelity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  inputs: z.array(portSpecSchema),
  outputs: z.array(portSpecSchema).min(1),
  validity: z.record(z.tuple([z.number(), z.number()])),
});

export function parseComponents(raw: unknown): Component[] {
  return z.array(componentSchema).parse(raw) as Component[];
}

export function parseConfigurations(raw: unknown): Configuration[] {
  return z.array(configurationSchema).parse(raw) as Configuration[];
}

export function parseAnalysisModels(raw: unknown): AnalysisModel[] {
  return z.array(analysisModelSchema).parse(raw) as AnalysisModel[];
}
