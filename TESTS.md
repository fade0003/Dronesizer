# TESTS.md — acceptance criteria (SPEC §11)

Given/When/Then list maintained per CLAUDE.md rule 8. Checked = passing in
`npm run test` / verified in the phase gate.

## Key acceptance criteria (SPEC §11)

- [ ] **Golden case** — Given the golden inputs (fixed 3.3 kg, A = 0.45 m²,
  FM 0.65, 30 min hover, DoD·η = 0.68, e = 180 Wh/kg), When the solver runs,
  Then it converges to mtow = 6.0 ± 0.05 kg in ≤ 30 iterations. *(phase 2)*
- [ ] **FPV / endurance archetypes** — Given the seeded FPV archetype, When
  analyzed, Then vMax ≥ 35 m/s and pitch ≥ 30° at vMax; Given the endurance
  quad, Then hover endurance ≥ 35 min. *(phase 2–3)*
- [ ] **Infeasible request** — Given a 90 min endurance demand on the R-Line
  LiPo pack, When the solver runs, Then status is `diverged` with the
  explanatory card and no console errors. *(phase 2–3)*
- [ ] **DOE performance** — Given a 200-case LHS DOE, When run in the Web
  Worker, Then it completes in ≤ 10 s with the UI interactive throughout.
  *(phase 4)*
- [ ] **Pareto drill-down** — Given a Pareto front, When a point is clicked,
  Then the exact component list with costs appears in ≤ 2 clicks. *(phase 4)*
- [ ] **SysML parse** — Given the shipped example, When parsed, Then 0
  errors; When a semicolon is deleted, Then an inline error at the correct
  line. *(phase 5)*
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
