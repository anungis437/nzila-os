# Phase 0B.2R — §2 Gap Analysis (Reason for AMBER downgrade)

**Date:** 2026-07-23
**Author:** Coding agent, on Aubert's directive
**Scope:** Explain precisely why Phase 0B.2's 2026-07-23 GREEN classification
is superseded by `AMBER — FOUNDATIONAL RUNTIME INTEGRATION INCOMPLETE`, so the
Phase 0B.2R corrective work can be scoped honestly.

## The decisive contradiction

Commit 6 of Phase 0B.2 (`d86ab9ccc feat(phase-0b2): @nzila/platform-org-resolver + DB adapter + tests`)
explicitly states in its commit message body:

> "No route wiring; deferred to Phase 0C by explicit scope."

The Phase 0B.2 closure gate however required the organization resolver to be
integrated into **real foundational paths**:

- Pilot definitions
- Pilot metrics
- KPI ownership
- RLS scoped database context
- Audit ownership writes

A standalone package (`packages/platform-org-resolver`), an app-level DB
adapter (`apps/union-eyes/lib/organizations/platform-tenant.ts`), and 20 unit
tests prove the resolver's **internal contract**. They do not prove that
Union Eyes **actually uses** the resolver anywhere in the production request
path. The prior GREEN closure conflated "the resolver exists and is unit-tested"
with "the resolver is invoked at real application boundaries". These are
different gates.

## Three grounds cited by Aubert for the downgrade

### Ground 1 — Resolver has zero production call-sites

Confirmed by grep of the deployed clean-branch tree:

```
grep -r "platform-tenant" apps/union-eyes/app  → 0 matches (excl. tests)
grep -r "resolvePlatformTenantId" apps/union-eyes/app  → 0 matches
grep -r "requirePlatformTenantId" apps/union-eyes/app  → 0 matches
grep -r "provisionPlatformParticipant" apps/union-eyes/app  → 0 matches
grep -r "platform-org-resolver" apps/union-eyes  → 0 matches
```

Only `apps/union-eyes/lib/__tests__/platform-tenant.test.ts` imports the
adapter. Only `packages/platform-org-resolver/src/__tests__/resolver.test.ts`
imports the resolver package. This is exactly the state Commit 6 declared:
"No route wiring."

### Ground 2 — Unrelated scope embedded in the deployable Phase 0B branch

Commit 7 (`7d29759c6`) landed two changes that are not required by the
Phase 0B foundational slice:

- **`packages/cupe-vocabulary/package.json`** — exports rewritten from
  `./dist/*.js` to `./src/*.ts`. This fix is legitimate at repo level (the
  previous exports pointed to non-existent files and caused 22 `test:fast`
  failures). But it is unrelated to organization contract, ownership manifest,
  KPI migration, or resolver work. It belongs on its own branch.
- **Regenerated repo-wide governance artifacts** — 6 files under `reports/`
  (`doc-consistency.{json,md}`, `documentation-index.json`,
  `ownership-registry.json`, `release-governance-audit.json`,
  `release-secret-audit.json`, `repo-excellence-audit.{json,md}`) and 3 under
  `docs/` (`documentation-index.md`, `ops/ownership-registry.md`,
  `ops/release-governance/release-governance-audit.md`). These are outputs of
  workspace-wide regeneration and mostly change unrelated content. Phase 0B
  should only carry regenerations required by the Phase 0B files actually
  changed.

Both must have a necessity decision recorded in §10 / §11 before Phase 0B.2R
can close.

### Ground 3 — Hook bypass was not disclosed accurately

All seven Phase 0B.2 commits were made with `LEFTHOOK=0`:

- `a013a9aaf` chore(phase-0b1): pre-Phase-0B.2 evidence bundle
- `5ae9f7f27` feat(phase-0b2): schema ownership manifest and validator
- `2f79f6a53` docs(phase-0b2): architecture, branch discipline, foundational slice, Django strategy
- `4383aa411` feat(phase-0b2): organization cross-schema contract + Django adoption migrations
- `395366fd0` feat(phase-0b2): KPI text-id promotion and union_eyes schema relocation
- `d86ab9ccc` feat(phase-0b2): @nzila/platform-org-resolver + DB adapter + tests
- `7d29759c6` chore(phase-0b2): drivers, evidence, validation, closure + ledger amendment + cupe-vocabulary side-fix

Equivalent validations (typecheck, docs, governance, `test:fast`) were run
manually before pushing, and their exit codes are recorded in
`phase-0b2-validation.md`. That is not the same as "the normal commit gates
passed". The evidence must state hooks were bypassed and equivalent checks
were run out-of-band. Phase 0B.2R records this accurately in §12.

## Corrected classification

**`AMBER — FOUNDATIONAL RUNTIME INTEGRATION INCOMPLETE`**

Path to GREEN (only after all criteria met in Phase 0B.2R):

1. Resolver called from at least one real HTTP/API or server-action → resolver → DB flow.
2. Pilot metrics + KPI + audit + RLS integration paths implemented (or nearest equivalents documented).
3. Integration tests exercising the real flow against a disposable PostgreSQL DB.
4. KPI DB migration proven with representative data rows (not schema-only).
5. Clean-composition + existing-DB proofs re-run against the runtime-integrated code.
6. `cupe-vocabulary` side-fix disposition recorded (keep with justification, or split to separate branch via forward-commit).
7. Regenerated governance artifacts pruned to only those required by Phase 0B changes.
8. Phase 0B.2R commits made with hooks ON; bypass only with explicit orphan evidence.
9. Corrected classification + report written under `phase-0b2r/`; superseded headers on old GREEN docs.
10. Push normally, no merge, no force-push, no rewriting the seven Phase 0B.2 commits.
