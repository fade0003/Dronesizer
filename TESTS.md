# TESTS.md — acceptance criteria (SPEC §11)

Given/When/Then list maintained per CLAUDE.md rule 8. Checked = passing in
`npm run test` / verified in the phase gate.

## Key acceptance criteria (SPEC §11)

- [x] **Golden case** — Given the golden inputs (fixed 3.3 kg, A = 0.45 m²,
  FM 0.65, 30 min hover, DoD·η = 0.68, e = 180 Wh/kg), When the solver runs,
  Then it converges to mtow = 6.0 ± 0.05 kg in ≤ 30 iterations.
  *(phase 2 — passing: golden.test.ts)*
- [x] **FPV / endurance archetypes** — Given the seeded FPV archetype, When
  analyzed, Then vMax ≥ 35 m/s and pitch ≥ 30° at vMax; Given the endurance
  quad, Then hover endurance ≥ 35 min.
  *(phase 2 — passing at model level: sizing.test.ts; UI readouts phase 3)*
- [x] **Infeasible request** — Given a 90 min endurance demand on the R-Line
  LiPo pack, When the solver runs, Then status is `diverged` with the
  explanatory card and no console errors. *(phase 3 — verified in the
  browser: "Long endurance — 90 min" on the FPV archetype renders the
  "This design does not close" card; console clean)*
- [x] **DOE performance** — Given a 200-case LHS DOE, When run in the Web
  Worker, Then it completes in ≤ 10 s with the UI interactive throughout.
  *(phase 4 — verified in browser: 200 cases stream in well under 1 s of
  solver time; studyRunner.test.ts pins the 10 s bound)*
- [x] **Pareto drill-down** — Given a Pareto front, When a point is clicked,
  Then the exact component list with costs appears in ≤ 2 clicks. *(phase 4
  — verified in browser: click point → drawer with input vector, metrics,
  per-component costs, "Open in Builder")*
- [x] **SysML parse** — Given the shipped example, When parsed, Then 0
  errors; When a semicolon is deleted, Then an inline error at the correct
  line. *(phase 5 — parse.test.ts pins line 2; browser-verified: lint range
  + gutter marker render at line 2 col 64 in the editor)*
- [x] **Repository boundary** — Given `restStore.ts` implementing the `Db`
  interface, When `npm run build` type-checks, Then it compiles with no
  changes outside `src/db/`. Additionally, Given any module outside
  `src/db/`, When it imports `jsonStore`, Then `npm run lint` fails
  (no-restricted-imports). *(phase 1 — passing)*
- [ ] **Lighthouse** — Given the deployed site, When audited, Then
  performance ≥ 85. *(phase 6)*

## Phase 1 — schema, seed, repository (passing)

- [x] Given the seed JSON, When loaded, Then every entry validates against
  its zod param contract and ≥ 18 components exist across all 8 classes.
- [x] Given the seed catalog, When inspected, Then every `sourceNote` reads
  "representative — verify against mfr datasheet before procurement".
- [x] Given the seed, When loaded, Then exactly 3 demo configurations exist
  (endurance_quad, fpv_highspeed, heavy_lift) and every instance
  `componentId` resolves to a seeded component.
- [x] Given the seed, When loaded, Then the seven fidelity-0 analysis models
  are registered at version 1.0.
- [x] Given a `Db` from `createDb()`, When components/configurations/studies/
  cases/results/pareto sets are created, read, updated, and removed, Then
  CRUD behaves as specified and unknown-row updates reject.
- [x] Given a result with `inputHash` H and modelVersions V, When
  `findByHash(H, V)` is called, Then the row is reused; When versions
  differ, Then it is a cache miss (pedigree/dedup pattern).
- [x] Given a storage backend, When the store mutates, Then the snapshot
  persists and a new instance rehydrates from it; a corrupt snapshot falls
  back to a clean seed.
- [x] Given `exportJson()`, When imported into a fresh store, Then the
  round-trip is byte-identical.
- [x] Given `reset()`, When called, Then user data is dropped, the seed is
  restored, and the reset persists across reload.

## Phase 2 — effects models, solver, limits (passing)

- [x] Given the golden iteration map, When solved with Aitken off, Then it
  still converges within 60 evaluations — and Aitken uses strictly fewer.
- [x] Given a contraction (cos x) and a snowball map, When solved, Then the
  solver converges / flags `diverged` respectively; non-finite and runaway
  iterates also flag `diverged`.
- [x] Given increasing speed, When forwardFlight evaluates, Then pitch and
  cruise power increase monotonically; at V < 0.1 m/s it degenerates to
  hover power; the eta curve interpolates with endpoint clamping.
- [x] Given a power ceiling, When vMax is bisected, Then power at vMax sits
  on the ceiling, and an unreachable ceiling caps vMax at 80 m/s.
- [x] Given the registry, When listed, Then the seven fidelity-0 models at
  1.0 match the db seed rows exactly (name@version sets equal).
- [x] Given the heavy-lift archetype with the 1 kg payload, When sized for
  30 min hover, Then it converges with all limits clear and T/W ≥ 1.6.
- [x] Given operating points violating each limit (T/W, disk loading,
  hover C-rate, tip Mach, motor rating), When checked, Then each produces
  its specific human-readable reason.
- [x] Given a configuration missing its battery role, When analyzed, Then
  status is `invalid` with a "missing role" reason — never a crash.

## Phase 3 — Catalog, Builder, Run wired end-to-end (verified in browser)

- [x] Given the Catalog view, When a class chip or filter is applied, Then
  the table narrows accordingly and every row shows mass and cost; Add
  inserts the component into the active configuration.
- [x] Given the Builder view, When a configuration is active, Then its
  instances render as React Flow nodes auto-wired by role (battery → esc →
  motor → prop chains), with a live dry-mass/BOM/loaded ticker.
- [x] Given the Run view, When Run executes the Endurance Quad on the 40-min
  hover profile, Then status `converged` shows with Readouts (count-up,
  provenance popover), convergence sparkline, and iteration table; a
  Study/Case/Result pedigree row set is written through the repository.
- [x] Given the 90-min profile on the FPV archetype, When run, Then the
  diverged explainer card renders with no console errors.
- [x] Given canonical input hashing, When key order differs, Then hashes
  match; different values produce different hashes (hash.test.ts).

## Phase 4 — DOE worker, Pareto, Trade space (passing / browser-verified)

- [x] Given n-case LHS sampling, When generated, Then every variable's
  range is stratified with each stratum hit exactly once, bounds hold, and
  the same seed reproduces the same vectors.
- [x] Given full factorial sampling, When generated, Then the steps^k grid
  includes both range ends.
- [x] Given known point sets, When the non-dominance filter runs in any
  min/max direction pair, Then the correct front survives, ordered along
  the first objective; 10k points filter in O(n log n) time.
- [x] Given a DOE vector, When applied, Then mission segments and payload
  mass override the base mission without mutating it, and a longer hover
  sizes a larger battery.
- [x] Given 200 LHS cases, When run through the study runner, Then all
  complete in < 10 s with statuses in {converged, diverged, invalid}.
- [x] Given `Db.batch()`, When many writes stream, Then storage flushes
  once and the flush persists every row.
- [x] Given an identical re-run (same config, seed, ranges), When the study
  executes, Then all 200 cases report "from cache", no new ResultRows are
  written, and copied statuses match the originals (verified in browser:
  603 unique hashes across 5 studies, zero status conflicts per hash).
- [x] Given a completed study, When inspected, Then a paretoSet record is
  persisted with the front's case ids for the selected objectives.

## Phase 5 — SysML v2 mini-modeler (passing / browser-verified)

- [x] Given the SPEC §9 example, When parsed, Then the AST carries the part
  defs (kv 240, mass 0.184), the vehicle composition (motors [4], pack,
  frame), the connect, and the HoverEndurance requirement.
- [x] Given attribute matching (kv ±5 %, mass ±10 %), When the example maps
  to the catalog, Then motors → MN501-S KV240 ×4, pack → Li-ion 6S2P, and
  Frame650 becomes a flagged ad-hoc frame.
- [x] Given a `// @catalog:<id>` override, When mapped, Then it wins over
  attribute matching; usage attribute redefinitions participate in
  matching.
- [x] Given requirement defs, When parsed, Then rows populate the
  Requirements table bound to metric names (enduranceMin ≥ 30 min).
- [x] Given any seeded configuration, When run through fromConfig → parse →
  toConfig, Then the instance set deep-equals the original and a second
  trip reproduces byte-identical text (canonical form).
- [x] Given the editor (browser-verified), When the example loads, Then
  keyword highlighting, the part tree, requirements, and mapping panels
  render; "Apply to Builder" creates the configuration (ad-hoc parts
  persisted in the same batch) and opens it; "Generate from Builder"
  emits canonical text that parses with zero ad-hoc fallout.
