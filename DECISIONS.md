# DECISIONS.md — deviations and judgment calls

Per CLAUDE.md rule 1: where SPEC.md is silent, the simplest option consistent
with its architecture rules is chosen and recorded here.

## Phase 1

- **D1 — Versions** (spec silent): Vite 6, Tailwind CSS 4 (via `@tailwindcss/vite`,
  CSS-first config), Vitest 3, ESLint 9 flat config, zod 3, TypeScript 5.7,
  React 18.3 (spec-mandated major).
- **D2 — `Component.params` type widened** to
  `Record<string, number | string | [number, number][]>`. SPEC §6's abridged
  interface says `Record<string, number|string>`, but the prop param contract
  in the same section requires `etaCurve: [advanceRatio, eta][]`. The widening
  is the minimal change that satisfies both; zod contracts pin exact shapes
  per class.
- **D3 — ESC param contract**: SPEC §6 lists contracts for motor, prop,
  battery, frame, and fc/vtx/payload but not esc. Chose `{ maxCurrentA }`
  (drive efficiency is already covered by ηDrive = 0.85 in SPEC §7).
- **D4 — Li-ion 6S2P pack `capacityAh` = 6.0**: SPEC's stated ~560 g at
  ~230 Wh/kg implies ≈129 Wh ≈ 6.0 Ah at 6S nominal (21.6 V). A literal 2P of
  21700 cells would weigh ~840 g; mass/specific-energy consistency wins
  because the effects models size from those two fields.
- **D5 — All repository methods are async** (`Promise`-returning) even though
  jsonStore is synchronous, so `restStore.ts` is signature-identical and the
  Postgres swap touches only `src/db/` (SPEC §5 acceptance).
- **D6 — `Study` interface fields** (spec abridged): `id, name, type,
  configurationId, variables[{path,min,max,steps?}], nCases?, status,
  createdAt`. Cases live under `StudyRepo` (createCase/listCases/getCase/
  updateCase), pareto sets under `StudyRepo.savePareto/getPareto`; results
  under `ResultRepo` with `findByHash` for the SPEC §8 dedup cache.
- **D7 — `restStore.ts` built in phase 1** (spec phases don't assign it):
  it is the cheapest point to lock the §5 boundary acceptance test, and tsc
  now guards it every build.
- **D8 — ESLint boundary rule** also restricts `restStore` and `db/seed/*`
  imports outside `src/db/`, not just `jsonStore` — same rationale ("all
  access goes through repository.ts"), enforced via `no-restricted-imports`.
- **D9 — Fonts system-stacked in phase 1**: SPEC §13 forbids runtime network;
  Saira SemiCondensed / Inter / IBM Plex Mono will be self-hosted in phase 6
  (polish), with system fallbacks defined now in `tokens.css`.
- **D10 — Seed `models.json` port lists are provisional**: the AnalysisModel
  registry rows for the seven fidelity-0 models carry reasonable input/output
  PortSpecs and validity envelopes; they will be finalized against
  `models/registry.ts` in phase 2.
- **D11 — DB singleton** lives in `repository.ts` (`getDb()`), defaulting to
  localStorage persistence (per SPEC §14 default: on, with a "Reset demo
  data" control — `Db.reset()` exists for that control).
- **D12 — localStorage persistence is snapshot-whole-store on every
  mutation** — simplest correct approach at demo scale; a corrupt snapshot
  falls back to a clean re-seed instead of crashing.
