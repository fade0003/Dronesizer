# CLAUDE.md — Aether Trade Studio

You are building the drone MDAO trade-space demo defined in **SPEC.md**. Read it fully before writing any code.

## Operating rules

1. **SPEC.md is the contract.** Where it is explicit, follow it exactly (schema field names, token values, golden-test numbers, acceptance criteria). Where it is silent, choose the simplest option consistent with its architecture rules and note the decision in `DECISIONS.md`.
2. **Phased execution** per SPEC §12. Complete phases in order. A phase is done only when `npm run test` and `npm run build` both pass with zero TypeScript errors. Never start a phase on a red tree.
3. **The repository boundary is sacred** (SPEC §5). Nothing outside `src/db/` may import `jsonStore.ts`. Verify with an ESLint no-restricted-imports rule in phase 1.
4. **Golden test first** (SPEC §7). In phase 2, write the 6.0 kg convergence test before implementing the solver, then make it pass.
5. **Units**: SI everywhere internally. Any conversion lives only in `ui/components/UnitField.tsx` and `Readout.tsx`.
6. **Seed data honesty**: every catalog entry keeps its `sourceNote` marking values as representative. Do not fabricate additional precision or add vendors not listed in SPEC §6 without flagging it.
7. **No network at runtime.** No fetches, no CDN-loaded data. Fonts may be self-hosted or system-stacked.
8. **Maintain `TESTS.md`** with the Given/When/Then acceptance list from SPEC §11, checking items off as they pass.
9. **Ask the operator** (don't guess) for: Cloudflare credentials/project name at phase 6, and any change that would violate a P0 requirement.

## Commands

- `npm run dev` — local dev server
- `npm run test` — Vitest suite (must include golden case)
- `npm run build` — type-check + production bundle
- `npx wrangler pages deploy dist` — deploy (operator-provided credentials only)

## Definition of done

All P0 acceptance criteria in SPEC §11 checked, deployed URL returned to the operator, `DECISIONS.md` summarizing every deviation or judgment call.
