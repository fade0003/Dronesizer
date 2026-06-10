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

## Phase 2

- **D13 — Golden case runs with ηDrive = 1.0 and DoD·η = 0.68 passed
  explicitly**: SPEC §7's stated 661 W only closes as
  (6.0·9.81)^1.5/√(2·1.225·0.45)/0.65 — figure of merit only. The hoverPower
  production default remains ηDrive = 0.85; the golden test pins the hand
  calculation with its own parameters, exactly as §7 lists them.
- **D14 — `models/sizing.ts` orchestrator added** (not in the SPEC §5 file
  list): something must compose the §7 coupling loop and assemble metrics
  for CaseRow/ResultRow. It is pure w.r.t. the database (components arrive
  resolved through the repository), so the boundary is intact.
- **D15 — Two rpm estimates, used where each is honest**: advance ratio J
  uses the SPEC-mandated n = kv·V_batt·0.85/60 (near-full-throttle forward
  flight); the tip-Mach limit uses hover rpm from the static thrust proxy
  (T = kT0·ρ·n²·D⁴) — otherwise every high-kv FPV build would flag
  tip Mach > 0.6 while hovering at a fraction of full rpm.
- **D16 — Avionics draw (fc/vtx/payload `pDrawW`) is added to every mission
  segment power** and to the endurance denominators; that is what the field
  exists for.
- **D17 — Battery unit cost stays the catalog value** even though the solver
  resizes battery mass (fidelity 0; a $/Wh model is a P2 refinement).
- **D18 — `pitchDeg` metric is the pitch at vMax** (matches §11's "pitch ≥
  30° at vMax"); `pCruiseW` is at the mission cruise speed (default 15 m/s
  when the mission has no cruise/dash segment, dash default 27 m/s).
- **D19 — maxIter (60 g-evals) without convergence reports `diverged`**: the
  spec defines only converged/diverged/invalid case states, and a sizing
  loop that hasn't closed in 60 iterations is in practice a snowball.
- **D20 — forwardFlight below 0.1 m/s returns hover power** with zero pitch
  and drag (the Glauert/advance-ratio machinery degenerates at V = 0).
- **D21 — vMax search is bracketed at 80 m/s** (SPEC validity envelope for
  speedMs); a vehicle whose power curve never meets the limit reports 80.
- **D22 — Solver counts iterations as g-evaluations** (maxIter 60, golden
  ≤ 30); Aitken-accelerated candidates are clamped to [0, 10⁴] kg and the
  divergence monitor counts consecutive residual-growth evaluations.
