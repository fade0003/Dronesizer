# Drone MDAO Trade-Space Demo — Build Specification

**Product**: Aether Trade Studio (working name)
**Owner**: Paul / Palingen Studios
**Target builder**: Claude Code, autonomous phased execution
**Version**: 1.0 — June 2026

---

## 1. Problem statement

Drone configuration decisions (motor/prop/battery/frame selection, hover vs. forward-flight sizing) are made today with spreadsheets that hide coupling between mass, power, and energy. This demo proves a browser-only MDAO (Multidisciplinary Design Analysis and Optimization) workflow: a real component catalog, coupled effects models, DOE/Pareto trade-space exploration, and a SysML v2 textual model as the system definition — all against a schema that later swaps 1:1 onto Postgres + OpenMDAO without frontend changes.

## 2. Goals

1. A user can assemble a drone from real catalog components, run a converged sizing analysis, and see MTOW, hover power, cruise power, endurance, max speed, and unit cost in < 30 seconds from page load.
2. A user can run a 200+ case DOE sweep and see an interactive Pareto front with drill-down from any point to its full configuration in ≤ 2 clicks.
3. A user can define a vehicle in SysML v2 textual notation (subset) and have it parse into the same configuration objects the GUI builder produces — and round-trip back to text.
4. The virtual DB layer exposes the exact schema from the production design (configurations, analysis_model registry, cases, results, pedigree fields) so that replacing it with a REST client against FastAPI/Postgres touches only one module.
5. The demo is a static site deployable to Cloudflare Pages (aligns with existing Palingen hosting direction) with zero server dependency.

## 3. Non-goals

- **No backend, no auth, no multi-user.** Single-browser demo. (Production phase 2.)
- **No OpenMDAO execution.** Effects models are reimplemented in TypeScript; the spec keeps signatures identical to the Python components so the swap is mechanical.
- **No conformant SysML v2 / KerML implementation.** A deliberate ~10-keyword subset (Section 9). Full standard conformance is a separate initiative.
- **No CFD, no propeller blade-element modeling.** Fidelity-0 effects models only; fidelity tags exist in the schema so higher-fidelity models register later.
- **No live pricing or vendor API integration.** Seed catalog values are representative (Section 6 caveat). A data-ingestion pipeline is a P2 future consideration.

## 4. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Fast static build, strong typing for the schema |
| State | Zustand | Minimal, store-per-domain matches repository pattern |
| Node graph | React Flow | Vehicle builder canvas, XDSM-familiar idiom |
| Charts | Plotly.js (via react-plotly.js) | Pareto scatter, parallel coordinates, convergence |
| Editor | CodeMirror 6 | SysML v2 textual editor with custom language mode |
| Parser | Peggy (PEG grammar) | Compact grammar file for the SysML subset |
| Styling | Tailwind CSS + CSS custom properties for tokens | Token-driven design system (Section 10) |
| Tests | Vitest | Golden-case regression on solver outputs |
| 3D preview (P1) | Three.js | Parametric vehicle silhouette |

## 5. Architecture

```
src/
  db/            ← VIRTUAL DATABASE (the swap boundary)
    schema.ts        TypeScript interfaces = production schema
    seed/            JSON seed files (catalog, models, demo configs)
    repository.ts    CRUD interface: ComponentRepo, ConfigRepo, StudyRepo, ResultRepo
    jsonStore.ts     In-memory impl + localStorage persistence + import/export .json
  models/        ← EFFECTS MODELS (mirror future OpenMDAO components)
    registry.ts      analysis_model registry; name@version → function
    massRollup.ts  hoverPower.ts  forwardFlight.ts  batteryEnergy.ts
    missionEnergy.ts  costRollup.ts  limits.ts
  solver/
    gaussSeidel.ts   Fixed-point with Aitken relaxation, returns iteration trace
    doe.ts           Latin hypercube + full factorial samplers
    pareto.ts        Non-dominance filter (O(n log n) for 2 objectives)
  sysml/
    grammar.pegjs    SysML v2 textual subset grammar
    toConfig.ts      AST → configuration objects
    fromConfig.ts    configuration → SysML text (round-trip)
  ui/
    views/           Catalog, Builder, Mission, Run, TradeSpace, N2, SysML
    components/      Readout, UnitField, ConvergenceSparkline, ...
    tokens.css       Design tokens (Section 10)
```

**Rule: nothing outside `db/` imports `jsonStore.ts` directly.** All access goes through `repository.ts` interfaces. Acceptance test: a stub `restStore.ts` implementing the same interface compiles with zero changes elsewhere.

## 6. Data model (virtual DB schema)

Mirror of the production Postgres design. All quantities SI internally; units converted at the UI boundary only. Key interfaces (abridged — implement fully):

```typescript
interface Component {
  id: string;                 // uuid
  cls: 'motor'|'esc'|'prop'|'battery'|'frame'|'fc'|'payload'|'vtx';
  mfr: string; model: string;
  massKg: number; unitCostUsd: number;
  params: Record<string, number|string>;   // class-specific, see param contracts below
  sourceNote: string;         // provenance: "mfr datasheet 2025-..." etc.
}

interface Configuration {
  id: string; name: string; parentId: string|null;
  status: 'draft'|'frozen';
  archetype: 'endurance_quad'|'fpv_highspeed'|'heavy_lift'|'vtol_fw';
  instances: { componentId: string; role: string; count: number }[];
  cuiMarking: null;           // present, unused — schema parity with production
}

interface AnalysisModel {
  name: string; version: string; discipline: string;
  fidelity: 0|1|2|3;
  inputs: PortSpec[]; outputs: PortSpec[];   // {name, units, bounds?}
  validity: Record<string, [number, number]>;
}

interface CaseRow {
  id: string; studyId: string; configurationId: string;
  inputVector: Record<string, number>; inputHash: string;   // sha-256 of canonical JSON
  status: 'converged'|'diverged'|'invalid'|'pending';
}

interface ResultRow {
  id: string; caseId: string; modelVersions: Record<string,string>;
  metrics: Record<string, number>;          // mtowKg, pHoverW, pCruiseW, enduranceMin,
                                            // vMaxMs, unitCostUsd, battFrac, pitchDeg
  iterTrace: number[];                      // convergence history for sparkline
  createdAt: string;
}
```

**Param contracts per component class** (the effects models read these — enforce with zod):

- `motor`: kv (rpm/V), rmOhm, i0A, maxPowerW, maxThrustKgf (with stated prop), statorDiamMm
- `prop`: diamIn, pitchIn, kT0 (static thrust coeff proxy), etaCruisePeak (0–1), etaCurve: [advanceRatio, eta][] (3–5 points)
- `battery`: cells, capacityAh, specificEnergyWhKg, maxC, intResistMohm
- `frame`: cdaM2 (flat-plate drag area, level), cdaTiltFactor (CdA multiplier per rad of pitch), maxPropIn, arms
- `fc` (flight controller), `vtx`, `payload`: massKg + power draw `pDrawW`

### Seed catalog — REPRESENTATIVE VALUES

> ⚠️ Seed values below are representative of published 2025-era datasheets, for demo realism only. Each entry's `sourceNote` must say `"representative — verify against mfr datasheet before procurement"`. Do not invent precision beyond 2–3 significant figures.

Seed at minimum (builder: encode as `seed/components.json`):

| Class | Entries |
|---|---|
| Motors | T-Motor MN3110 KV780 (99 g, ~$75); T-Motor MN501-S KV240 (184 g, ~$130); T-Motor U8 II KV100 (240 g, ~$230); iFlight XING2 2207 KV1855 (32 g, ~$27); EMAX ECO II 2306 KV1900 (31 g, ~$14) |
| Props | APC 12×4.5MR (13 g); T-Motor CF 18×6.1 (28 g); HQProp 5.1×4.6×3 (4 g); APC 10×4.5MR |
| Batteries | Tattu 6S 22000 mAh LiPo (~2.38 kg, ~205 Wh/kg, ~$250); Tattu R-Line 6S 1400 mAh (230 g, ~135 Wh/kg, 120C, ~$35); Li-ion 6S2P 21700 pack (~560 g, ~230 Wh/kg, low C, ~$95) |
| Frames | 650-class CF quad frame (480 g, CdA ≈ 0.045 m²); 7-inch FPV freestyle frame (150 g, CdA ≈ 0.012 m²); 5-inch race frame (95 g, CdA ≈ 0.008 m²) |
| Avionics | Pixhawk-class FC (60 g, ~$200, 5 W); FPV AIO stack (35 g, ~$85, 9 W); generic 4-in-1 ESC entries sized to motor classes |
| Payloads | 0 g none; 250 g camera gimbal (~$400); 1.0 kg sensor package (~$1,200) |

Three demo configurations ship pre-seeded, one per archetype: **endurance quad** (MN501-S + 18" + Li-ion), **FPV high-speed** (XING2 + 5" + R-Line), **heavy-lift** (U8 + large LiPo + 1 kg payload).

## 7. Effects models

All functions pure: `(inputs: Record<string,number>, params) → Record<string,number>`. Register each in `registry.ts` with name@semver, fidelity 0, and a validity envelope. Constants: ρ = 1.225 kg/m³, g = 9.81.

**massRollup@1.0**: `mtow = Σ(instance mass × count) + mBatt`. Battery mass is the cycle variable.

**hoverPower@1.0**: `T = mtow·g`; `pHover = T^1.5 / √(2ρA_disk) / FM / ηDrive` with FM = 0.65 default, ηDrive = 0.85 (motor×ESC). A_disk from prop diameter × rotor count.

**forwardFlight@1.0** — the forward-pitch high-speed model:
- Drag: `D = ½ρV²·CdA_eff`, where `CdA_eff = cdaM2·(1 + cdaTiltFactor·θ)` and pitch `θ = atan(D/(mtow·g))` — solve the θ↔D circularity with 5 fixed-point iterations (converges fast).
- Required thrust: `T = √((mtow·g)² + D²)`.
- Induced power (Glauert): solve `vi` from `T = 2ρA_disk·vi·√(V² + vi²)` by Newton's method (hover value as initial guess); `P_ind = κ·T·vi`, κ = 1.15.
- Profile + parasite: `P_par = D·V`; `P_prof = 0.15·pHover` (fixed fraction at fidelity 0).
- `pCruise = (P_ind + P_par + P_prof) / ηDrive / ηProp(J)` with ηProp interpolated from the prop's etaCurve at advance ratio `J = V/(n·D_prop)` using motor rpm estimate `n = kv·V_batt·0.85/60`.
- Outputs: pCruiseW, pitchDeg, and **vMaxMs** — bisect for the speed where pCruise equals min(battery C-limit power, Σ motor maxPowerW·0.8).

**batteryEnergy@1.0**: usable energy `E = mBatt·specificEnergy·DoD·ηDis` (DoD = 0.8, ηDis = 0.95); `mBatt_required = E_mission / (specificEnergy·DoD·ηDis)`.

**missionEnergy@1.0**: profile = ordered segments `{kind: 'hover'|'cruise'|'dash', durationS, speedMs?}`; energy = Σ P(segment)·t. Endurance metric = pure-hover or pure-cruise time at converged mass, both reported.

**costRollup@1.0**: `unitCost = Σ(unitCostUsd × count) × 1.25` (integration/harness factor) — report BOM and loaded.

**limits@1.0**: validity checks → case status `invalid` with reasons: thrust-to-weight < 1.6 (quads), disk loading > envelope, battery C-rate exceeded at hover, prop tip Mach > 0.6, motor power > rating.

**Coupling**: mBatt → mtow → (pHover, pCruise) → missionEnergy → mBatt. Solve with `gaussSeidel.ts` (Aitken, tol 1e-6 on mBatt, maxIter 60). Divergence (monotone growth 10 iterations) → status `diverged`, surfaced in UI as "design does not close" with the snowball explanation — never a crash.

**Golden test (P0)**: fixed 3.3 kg, A = 0.45 m², FM 0.65, 30 min hover, DoD·η = 0.68, e = 180 Wh/kg ⇒ converges to mtow = 6.0 ± 0.05 kg, mBatt = 2.70 ± 0.05 kg, pHover = 661 ± 10 W. This pins the demo to the validated hand calculation.

## 8. Studies, DOE, Pareto

- Study types: `point` (one case), `sweep` (1–2 vars, grid), `doe` (Latin hypercube, n configurable 50–1000), `paretoSweep` (epsilon-constraint over endurance).
- Runs execute in a Web Worker (never block UI); progress streamed per-case to a Zustand store; each case writes CaseRow + ResultRow through the repository.
- `pareto.ts`: 2-objective non-dominance filter; front stored as ordered case-id list in a `paretoSet` record.
- Cache: identical `inputHash` + identical modelVersions ⇒ reuse prior ResultRow (demonstrates the production pedigree/dedup pattern).

## 9. SysML v2 mini-modeler

Implement a deliberate subset of the SysML v2 **textual notation** (OMG — Object Management Group — standard). Supported grammar (and nothing more):

```
package <Name> {
  part def <TypeName> { attribute <name> : Real [= <value>] [unit <u>]; ... }
  part <name> : <TypeName> [ [<count>] ] { attribute redefinitions... }
  part <vehicleName> { part <child> : <Type>; ... }      // composition
  connect <a> to <b>;
  requirement def <RName> { attribute threshold : Real = <v> unit <u>;
                            subject <part>; constraint { <metric> <=|>= threshold } }
}
```

Example that must parse (ship as the SysML view's default buffer):

```
package EnduranceQuad {
  part def Motor    { attribute kv : Real = 240 unit rpm_per_V; attribute mass : Real = 0.184 unit kg; }
  part def Battery  { attribute specificEnergy : Real = 230 unit Wh_per_kg; }
  part vehicle {
    part motors : Motor [4];
    part pack : Battery;
    part frame : Frame650;
  }
  connect pack to motors;
  requirement def HoverEndurance {
    attribute threshold : Real = 30 unit min;
    subject vehicle;
    constraint { enduranceMin >= threshold }
  }
}
```

Behavior:
- `toConfig.ts` maps part defs/usages onto catalog components by attribute matching (kv ± 5%, mass ± 10%) with explicit `// @catalog:<componentId>` comment override; unmatched parts become ad-hoc components flagged in UI.
- `requirement def` rows populate the Requirements table and render as constraint lines on the trade-space plot (the requirement→metric map from the production schema, made visible).
- `fromConfig.ts` regenerates canonical text from any GUI-built configuration — **round-trip acceptance test**: GUI config → text → parse → deep-equal config.
- CodeMirror mode: keyword highlighting, inline parse errors with line/col, format-on-demand.
- An "About this notation" popover states plainly: *subset of SysML v2 textual notation for demonstration; not a conformant implementation.*

## 10. GUI design direction

**Aesthetic thesis**: *flight-test ground station, daylight-readable.* Not a dark "hacker dashboard," not cream-and-serif editorial. The interface should feel like instrumentation: quiet surfaces, precise numerals, one signal color used only for data that matters.

Tokens (`tokens.css`):
- `--paper: #F2F4F6` (cool gray field), `--panel: #FFFFFF`, `--ink: #16212B` (deep blue-black), `--line: #C7CFD6`
- Accent — `--signal: #E8590C` (rescue orange): Pareto front, active constraints, run button, nothing else
- Data — `--trace: #0B7285` (instrument teal): plots, sparklines, connections
- States: converged `#2B8A3E`, diverged `#C92A2A`, invalid `#E8590C` outline
- Type: display **Saira SemiCondensed 600** (headers/nav only); body **Inter 400/500**; all numerics **IBM Plex Mono** with tabular figures
- **Signature element**: every metric renders as a `Readout` component — mono value, small-caps unit, hairline underline, 200 ms count-up on change, click → provenance popover (model name@version, input hash, timestamp). The pedigree story, made tactile.
- Motion: count-ups and a single 300 ms crossfade on view change; respect `prefers-reduced-motion`; nothing else animates.

Views (left rail navigation, in this order): **Catalog** (filterable table, class chips, cost column) → **Builder** (React Flow canvas; palette left, drop components, auto-wire by role; live mass/cost ticker bottom bar) → **Mission** (segment list editor with per-segment power preview) → **Run** (big Run button, convergence sparkline, iteration table, divergence explainer card) → **Trade space** (Pareto scatter, axes selectable from any two metrics, lasso select, parallel-coordinates strip below, requirement lines overlaid; click point → config drawer with "open in Builder") → **N2** (connectivity matrix of the active model graph; below-diagonal cells tinted `--signal`) → **SysML** (split pane: editor left, parsed part tree + requirements right, "Apply to Builder" / "Generate from Builder" buttons).

Quality floor: responsive to 1024 px (desktop-first is acceptable for the demo), visible keyboard focus, WCAG AA contrast on all token pairs.

## 11. Requirements summary

**P0 (demo is not viable without):** schema + repository boundary; seed catalog (≥ 18 components, 3 archetype configs); hover + forward-flight + battery + mass + cost models with GS solver and golden test passing; Builder, Run, Trade-space views; DOE ≥ 200 cases in Web Worker; Pareto filter + drill-down; SysML parse → config for the shipped example; localStorage persistence + JSON export/import; deployed static build.

**P1:** SysML round-trip (fromConfig); N2 view; parallel coordinates; mission editor UI (P0 may hardcode 2 profiles); Three.js silhouette preview; requirement overlay lines; Aitken toggle + solver trace inspector.

**P2 (architectural insurance — design for, don't build):** REST repository against FastAPI/Postgres; OpenMDAO execution backend; catalog ingestion pipeline from manufacturer data; fidelity-1 prop model from UIUC propeller database curves; multi-objective NSGA-II in worker; conformant SysML v2 via the official pilot implementation.

**Key acceptance criteria** (full Given/When/Then list to be maintained in `TESTS.md` by the builder):
- [ ] Golden case converges to 6.0 ± 0.05 kg in ≤ 30 iterations
- [ ] FPV archetype reports vMax ≥ 35 m/s and pitch ≥ 30° at vMax; endurance quad reports ≥ 35 min hover
- [ ] An infeasible request (90 min endurance on LiPo R-Line pack) yields status `diverged` with explanatory card, no console errors
- [ ] DOE of 200 LHS cases completes ≤ 10 s on a mid-range laptop, UI interactive throughout
- [ ] Pareto point click → exact component list with costs in ≤ 2 clicks
- [ ] SysML example parses with 0 errors; deleting a semicolon yields inline error at correct line
- [ ] `restStore.ts` stub compiles against `repository.ts` with no changes outside `db/`
- [ ] Lighthouse performance ≥ 85 on the deployed site

## 12. Build phases for Claude Code

| Phase | Scope | Est. sessions |
|---|---|---|
| 1 | Scaffold (Vite/TS/Tailwind/tokens), schema.ts, jsonStore, seed data, repository tests | 1 |
| 2 | Effects models + solver + golden tests + limits | 1 |
| 3 | Builder + Catalog + Run views wired end-to-end | 1–2 |
| 4 | DOE worker, Pareto, Trade-space view | 1 |
| 5 | SysML grammar, parser, editor view, toConfig | 1–2 |
| 6 | Polish per Section 10, N2 view, accessibility pass, deploy | 1 |

Each phase ends green: `npm run test && npm run build` with zero TypeScript errors. Do not begin a phase with the prior phase red.

## 13. Deployment

- `npm run build` → `dist/` static bundle.
- Primary: **Cloudflare Pages** — `npx wrangler pages deploy dist` (requires `CLOUDFLARE_API_TOKEN` + account id in env; builder must ask the operator for credentials rather than embedding them). Alternative: GitHub Pages via the included `deploy.yml` workflow on push to `main`.
- No secrets in the repo. No external API calls at runtime — the site must work fully offline after load.

## 14. Open questions

- **Operator**: Cloudflare Pages project name and whether to wire CI deploy or manual `wrangler` only?
- **Operator**: should localStorage persistence be on by default, or session-only with explicit export? (Default: on, with a visible "Reset demo data" control.)
- **Builder (non-blocking)**: React Flow vs. hand-rolled SVG canvas if bundle size exceeds ~600 kB gzipped — prefer React Flow unless it breaks the Lighthouse target.
