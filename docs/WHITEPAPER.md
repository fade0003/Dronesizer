# Extensible MDAO Framework with MBSE Integration

## White Paper Proposal — Effects-Model Integration, SysML-Connected System Definition, and a Pedigree-Bearing Trade-Space Database

**Submitted by:** Palingen Studios
**Contact:** palingenstudios@gmail.com
**Date:** June 2026
**Distribution:** Draft — business sensitive; distribution limited to the intended recipient.

---

## 1. Executive Summary

Engineering trade decisions for complex platforms are still made in disconnected
spreadsheets and single-discipline tools that hide the coupling between mass,
power, energy, cost, and mission effectiveness. System definitions maintained in
MBSE environments rarely drive the analyses that justify them, and analysis
results rarely flow back with enough provenance to be trusted, audited, or
reused.

Palingen Studios proposes a phased effort to develop an **extensible
multidisciplinary design analysis and optimization (MDAO) framework** for the
Government that closes this gap. The initial scope is deliberately narrow and
low-risk:

1. **Effects models, integrated into an existing Government simulation
   framework** — physics-based, fidelity-tagged, versioned models with pure
   functional contracts, registered in a model registry rather than hard-wired
   into any one tool.
2. **SysML v2 connectivity** — system definitions expressed in the OMG SysML v2
   textual notation parse into the same configuration objects the analysis
   consumes, and regenerate from them (round-trip), so the system model and the
   analyzed configuration cannot silently drift apart.
3. **Database schema development** — a production-grade schema for components,
   configurations, the analysis-model registry, cases, and results, with
   pedigree fields (input hashing, model versioning, timestamps) and
   information-marking fields built in from day one.

Later phases expand the same architecture — without rework — to **modular
OpenMDAO execution** and **adapter-based connections to Government and
commercial analysis tools**, raising fidelity discipline-by-discipline while
every interface, schema, and pedigree mechanism established in the base effort
remains unchanged.

The approach is grounded in a **working end-to-end prototype** built by
Palingen Studios that demonstrates every architectural element of the base
scope: a versioned effects-model registry, a coupled sizing solver with
convergence pedigree, design-of-experiments trade-space exploration with
Pareto analysis, a SysML v2 textual subset that round-trips to analysis
configurations, and a repository-bounded database layer designed for 1:1
replacement by a production relational database. The prototype is intentionally
domain-representative rather than domain-specific: the architecture carries no
assumptions about vehicle class, sensor suite, or mission set.

---

## 2. Problem Statement

Three structural problems recur across Government design and analysis
organizations, independent of platform domain:

**P1 — Coupled effects are evaluated in uncoupled tools.** Sizing variables
interact: adding energy storage adds mass, which raises required power, which
demands more energy. Spreadsheet workflows linearize or ignore these loops.
The result is configurations that look feasible cell-by-cell and fail when the
coupling is closed — discovered late, at integration or test.

**P2 — The system model and the analysis are different artifacts.** MBSE
investments produce authoritative system definitions, but analysts re-enter
that information by hand into analysis tools. Requirements live in one place,
the metrics that satisfy them in another, with no machine-checkable link. Drift
is undetectable until review.

**P3 — Results carry no pedigree.** A number in a briefing chart cannot be
traced to the model version, input vector, and assumptions that produced it.
Re-runs are not reproducible; duplicate analyses are re-paid for because prior
results cannot be trusted or even found.

These problems are architectural, not tooling gaps. Buying another analysis
tool adds a stovepipe; the proposed effort instead establishes the **connective
tissue** — registries, schemas, and standard interfaces — that lets existing
tools participate in a coupled, traceable, extensible workflow.

---

## 3. Demonstrated Foundation

Palingen Studios has built and tested an unclassified prototype that
demonstrates the proposed architecture end-to-end on a representative
configuration-sizing problem. Relevant demonstrated elements:

| Element | Demonstrated capability |
|---|---|
| **Effects-model registry** | Seven fidelity-0 physics models registered as `name@version` with discipline tags, declared input/output ports with units, and validity envelopes. Models are pure functions — `(inputs, parameters) → outputs` — with signatures chosen to mirror OpenMDAO components so the future swap is mechanical. |
| **Coupled solver** | Fixed-point solution of the mass–power–energy coupling loop with Aitken Δ² acceleration, full iteration traces retained as pedigree, and graceful divergence reporting ("the design does not close, and here is why") rather than failure. Solution is pinned to a validated hand calculation by a golden regression test. |
| **Constraint screening** | A limits model converts validity violations into human-readable reasons and an `invalid` case status, so infeasible regions of a trade space are mapped rather than crashed on. |
| **Trade-space exploration** | Design-of-experiments sampling with Pareto non-dominance filtering and drill-down from any point to its full configuration (prototype scope). |
| **SysML v2 connectivity** | A deliberate subset of the OMG SysML v2 textual notation parses into the same configuration objects the analysis consumes; requirements map onto analysis metrics; configurations regenerate canonical text (round-trip property verified by test). |
| **Pedigree-bearing schema** | Components, configurations, analysis-model registry, cases, and results — with SHA-256 input hashing, per-result model-version maps enabling cache/dedup, provenance notes on every catalog value, and an information-marking field present in the schema from the first commit. |
| **Swap-boundary architecture** | All data access flows through repository interfaces; a REST-client implementation of the identical interface compiles with zero changes outside the data layer, proving the storage backend (or a Government system of record) can replace the prototype store without touching analysis or UI code. |

The prototype is verified by a regression suite (51 automated tests at this
writing) including the golden convergence case, archetype-level acceptance
checks, divergence behavior, and the schema round-trip properties. **No element
of the prototype assumes a vehicle type, sensor suite, or mission domain** —
those enter only as catalog data and model parameters, which is precisely what
makes the architecture extensible to the Government's domains of interest.

---

## 4. Proposed Technical Approach — Base Effort

### 4.1 Architectural principles

The base effort is governed by five principles, each already exercised in the
prototype:

1. **Models are registered, never hard-wired.** Every effects model enters
   through a registry keyed by `name@semantic-version`, carrying a discipline
   tag, a fidelity tag (0–3), typed input/output ports with units, and a
   declared validity envelope. New models — including future high-fidelity
   replacements — register alongside old ones; studies record exactly which
   versions produced which results.

2. **One schema, many backends.** All persistence flows through repository
   interfaces. The schema is designed once, to production standards; the
   storage technology behind it (file store, relational database, or a
   Government system of record) is replaceable without touching analysis code.

3. **The system model is the source of truth.** SysML v2 definitions parse
   into analysis configurations; analysis configurations regenerate SysML v2
   text. Requirements in the system model bind to named analysis metrics, so
   requirement satisfaction is computed, not asserted.

4. **Every number carries its pedigree.** Input vectors are canonically hashed;
   results record the full model-version map, iteration history, and
   timestamps. Identical inputs under identical model versions reuse prior
   results — an audit trail and a cost-avoidance mechanism in one.

5. **Units and markings are first-class.** SI units internally with conversion
   only at presentation boundaries; information-marking fields exist in every
   schema entity so that operation in marked environments requires
   configuration, not redesign.

### 4.2 Task 1 — Effects models in the existing simulation framework

Working with the Government's designated simulation framework, Palingen
Studios will:

- Define the **effects-model contract** for that framework: pure functional
  signatures, declared ports with units and bounds, fidelity and discipline
  tags, and validity envelopes — matching the registry pattern demonstrated in
  the prototype.
- Implement an initial set of **fidelity-0/1 effects models** for the
  disciplines the Government designates (e.g., mass properties, power and
  energy, performance, cost), each registered and individually versioned.
- Integrate the **coupled solution capability** (fixed-point with acceleration,
  convergence traces, graceful divergence reporting) so cross-discipline
  loops close inside the existing framework rather than in offline
  spreadsheets.
- Deliver a **constraint/limits layer** that converts validity violations into
  actionable reasons attached to case status.

The deliberate constraint — effects models *in an existing framework*, not a
new framework — minimizes accreditation burden, leverages sunk Government
investment, and lets the registry/pedigree architecture prove its value before
any execution-environment decisions are made.

### 4.3 Task 2 — SysML v2 connectivity

- Implement parsing of Government-relevant **SysML v2 textual notation**
  constructs (part definitions and usages, attribute redefinition,
  composition, connections, and requirement definitions with thresholds and
  constraints) into the same configuration objects the effects models consume.
- Implement **generation** of canonical SysML v2 text from analysis
  configurations, with the round-trip property (definition → configuration →
  definition) verified by automated test.
- Bind **requirement definitions to analysis metrics**, so each analyzed case
  reports requirement margins computed from the same pedigreed results.
- Coordinate the subset scope with the Government's MBSE environment and
  conventions; the architecture accommodates later migration toward fuller
  SysML v2 conformance (including the OMG pilot implementation) without
  changing the configuration objects downstream tools consume.

### 4.4 Task 3 — Database schema development

- Develop the **production schema**: component catalog (with per-class
  parameter contracts and provenance/source annotations), configurations (with
  lineage via parent references and draft/frozen status), the analysis-model
  registry, studies, cases (with canonical input hashing), results (with
  model-version maps and iteration traces), and Pareto/trade-study artifacts.
- Include **pedigree and dedup mechanics** as schema features, not
  application conventions: input hash + model-version identity defines result
  reuse.
- Include **information-marking fields** on all relevant entities, with
  population and enforcement rules established jointly with the Government.
- Deliver the schema with a **repository interface specification** and a
  reference implementation, plus a compile-verified alternate-backend stub
  demonstrating that the Government can re-platform storage without touching
  analysis integrations.

### 4.5 Base-effort deliverables

| # | Deliverable |
|---|---|
| D1 | Effects-model contract specification and registry, integrated in the designated simulation framework |
| D2 | Initial registered effects-model set with validity envelopes and automated regression tests, including golden-case pins to validated reference calculations |
| D3 | Coupled solver integration with convergence pedigree and divergence reporting |
| D4 | SysML v2 textual-subset parser/generator with requirement-to-metric binding and round-trip test evidence |
| D5 | Database schema (DDL + interface specification), reference repository implementation, alternate-backend compilation proof |
| D6 | Test report, decisions log, and transition plan for the option scope |

---

## 5. Extensibility Roadmap — Option Scope

The base architecture is designed so each expansion below is an *addition*,
not a rework. None changes the schema, the model contract, or the SysML
binding established in the base effort.

**Option A — Modular OpenMDAO execution.** Because base-effort effects models
carry OpenMDAO-compatible signatures, this option wraps registered models as
OpenMDAO components and groups, enabling gradient-based optimization, MAUD/
analytic derivatives where models support them, and formal MDO architectures —
while the registry, pedigree, and database remain the system of record.
Execution location (workstation, HPC, or approved cloud) is a deployment
decision, not an architecture change.

**Option B — Analysis tool adapters.** A thin adapter contract (same
ports-units-fidelity-validity pattern) admits external Government and
commercial analysis tools as registered models: higher-fidelity replacements
register at fidelity 2–3 beside the fidelity-0/1 models they refine. Studies
can then mix fidelities deliberately — broad trade sweeps at low fidelity,
candidate verification at high fidelity — with the pedigree record showing
exactly which fidelity produced each number.

**Option C — Trade-space exploration at scale.** Larger designs of
experiments, parallel case execution against the Option A backend,
multi-objective optimization, and result-reuse across studies via the dedup
mechanism already present in the schema.

**Option D — Enterprise integration.** Multi-user operation, authentication
and role separation, marking enforcement appropriate to the hosting
environment, and integration with the Government's MBSE repository so SysML
connectivity operates against the authoritative model rather than text
buffers.

---

## 6. Notional Program Plan

| Phase | Scope | Duration (notional) | Exit criterion |
|---|---|---|---|
| Base 1 | Schema + repository + model contract in the designated framework | Months 1–3 | Schema review passed; first registered models executing with pedigree |
| Base 2 | Coupled solver + initial model set + limits | Months 3–6 | Golden regression suite green; coupled loop closes in-framework |
| Base 3 | SysML v2 parse/generate + requirement binding | Months 6–9 | Round-trip and requirement-margin tests green on Government-relevant definitions |
| Base 4 | Hardening, documentation, transition plan | Months 9–12 | D1–D6 delivered |
| Options A–D | As exercised | Sequenced per Government priority | Per-option acceptance tests |

Cadence, milestones, and a rough order of magnitude estimate will be tailored
to the Government's contracting vehicle and the designated simulation
framework; Palingen Studios is prepared to support white-paper-to-proposal
maturation under whatever mechanism the Government prefers.

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Integration friction with the existing simulation framework | Effects-model contract is deliberately minimal (pure functions, typed ports); a thin adapter isolates framework specifics; prototype already demonstrates the contract working against two execution contexts |
| SysML v2 standard evolution | Base scope targets a stable, deliberately small textual subset; conformance growth is isolated in the parser/generator, never in the configuration objects downstream consumers use |
| Model validation burden | Golden-case regression pattern (every model pinned to a validated reference calculation) demonstrated in the prototype; validity envelopes make extrapolation visible rather than silent |
| Schema lock-in fears | Repository boundary with compile-verified alternate backend is a base-effort deliverable, proving re-platformability before any production commitment |
| Scope growth toward a "do-everything framework" | Phasing is contractual: the base effort touches only effects models, SysML connectivity, and the schema; execution backends and tool adapters are separately exercised options |

---

## 8. Standards and Practices

- **OMG SysML v2 / KerML** textual notation for system definition
  connectivity, with the implemented subset documented and clearly marked as
  non-conformant-by-design until conformance is separately scoped.
- **Semantic versioning** for every registered model; results are
  reproducible only because versions are immutable.
- **SI units** internally; conversions only at presentation boundaries.
- **Automated regression testing** as the definition of done for every phase,
  with golden cases pinning physics to validated reference calculations.
- **Information-marking readiness** at the schema level from the first
  deliverable.
- **No runtime dependence on external services** in delivered components;
  deployment environments are the Government's choice.

---

## 9. About Palingen Studios

Palingen Studios builds interactive, real-time engineering and visualization
software on lightweight, verifiable web and simulation stacks. The
demonstrated prototype underlying this proposal — including its registry,
solver, SysML round-trip, and pedigree-bearing schema — was developed in-house
and is available for live demonstration on request.

**Point of contact:** palingenstudios@gmail.com

---

*This white paper contains no export-controlled technical data and identifies
no specific platform, vehicle class, or sensor system. Quantitative examples
in the demonstration prototype use openly published, representative component
data.*
