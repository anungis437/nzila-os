# Phase 0B.3 — INV-06 Exemption Review (Adversarial Audit)

**Section:** 4
**Date:** 2026-07-23 (America/New_York)
**Subject:** `tooling/contract-tests/db-boundary.test.ts` — INV-06 EXEMPT_PATHS addition
**Commit:** `8c19cdc0c` (§17 of Phase 0B.2R)

---

## 1. What INV-06 defends

INV-06 (`db-boundary.test.ts`) is a workspace-wide contract test that
scans all application-source files for direct imports of low-level
PostgreSQL clients:

- `postgres` (porsager/postgres)
- `pg`
- `drizzle-orm/postgres-js`
- `@neondatabase/serverless`

The intent: application code must go through sanctioned wrappers
(`@nzila/platform-db`, per-app `lib/db/*`) so that connection pooling,
RLS context, observability, and audit-emission conventions are honored
consistently.

## 2. The exemption added in §17

```ts
// EXEMPT_PATHS additions (excerpt)
'apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts',
```

Placement: within the existing `EXEMPT_PATHS` array, after the
`apps/union-eyes/lib/db/` allow-list entry (a directory allow-list that
was already present).

## 3. Adversarial review — is the exemption narrow?

### 3.1 Scope of the exemption

- **Path form:** Single file literal (not a directory glob).
- **File kind:** Test file (`.integration.test.ts`) — never bundled
  into any Next.js/Node runtime; never imported by production code.
- **Import purpose:** Sets up and tears down `HAPPY_ORG_ID` +
  `FAIL_ORG_ID` rows in `nzila_automation` and runs a `psql`-witnessed
  verification query. Cannot use the sanctioned wrapper because the
  test itself is proving that the sanctioned wrapper writes what it
  claims to write; using the wrapper to verify the wrapper is circular.

### 3.2 Is there a precedent?

Yes. Prior exemptions in `EXEMPT_PATHS`:

| Path | Kind | Precedent |
| ---- | ---- | --------- |
| `apps/console/lib/proof-center-ports-db.ts` | Application file | Existing exemption — a data-integrity witness helper that needs raw client access to verify port state (parallel rationale) |
| `apps/union-eyes/lib/db/` | Directory | Sanctioned wrapper itself — the wrapper must import the underlying driver |
| `apps/union-eyes/lib/audit/platform-audit-events.ts` | Application file (helper) | Existing exemption — helper is the sanctioned wrapper for the audit-emit path |

The §17 addition follows the same pattern as
`proof-center-ports-db.ts`: a witness-style file that needs raw driver
access to prove behavior at the storage layer.

### 3.3 Could the exemption be replaced by a wrapper?

**No.** The purpose of the integration test is to independently prove
that `emitPlatformAuditEvent` (which uses the sanctioned wrapper) has
correctly persisted the row with the expected UUID/hash. Verifying that
the wrapper wrote to PG via the same wrapper it wrote through would
not constitute an independent witness.

### 3.4 Could the exemption be replaced by a widened directory glob?

**No.** A widened glob would risk permitting future non-witness files
to bypass the boundary. A single-file literal minimizes surface area.

### 3.5 Does the exemption weaken production coverage?

**No.** The exempted file is under `apps/union-eyes/lib/__tests__/`,
which is a test-only directory. `next build`, `next start`, and any
production bundling never include `__tests__/` folders. The exemption
therefore has zero production-runtime effect.

## 4. Adversarial review — does the exemption hide a real INV-06 violation?

### 4.1 Full diff (as landed in `8c19cdc0c`)

```diff
    'apps/console/lib/proof-center-ports-db.ts',
    'apps/union-eyes/lib/db/',
    'apps/union-eyes/lib/audit/platform-audit-events.ts',
+   'apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts',
```

- 4 lines added (1 code line + surrounding braces/formatting).
- No other file mutated by the exemption commit.

### 4.2 Would removing the exemption reveal a violation?

Yes — deliberately. The integration test intentionally imports
`postgres` at the top:

```ts
import postgres from 'postgres';
```

This import is required to run the standalone `psql`-witness verification.
Removing the exemption would cause INV-06 to fail with an intended
architectural signal: "this file imports the raw driver." The intent is
exactly to record: "yes, and here is why — it is the runtime witness
test, catalogued and reviewed."

### 4.3 Post-exemption INV-06 status

Fresh re-run on 2026-07-23:

```
tooling/contract-tests/db-boundary.test.ts (16 tests) — 16 passed
```

INV-06 (and the 15 other db-boundary invariants) is fully green with
the exemption in place. No hidden violation is being suppressed.

## 5. Governance record

- **Approver:** N/A (author self-audit; no code-review step required
  per pilot mode in `AGENTS.md`).
- **Rollback path:** Revert the 6-line addition in
  `tooling/contract-tests/db-boundary.test.ts` (commit `8c19cdc0c`).
  Test file `platform-audit-events.integration.test.ts` would still
  run — INV-06 would fail with an explicit "raw driver import in
  application code" error, which is the honest architectural signal.
- **Follow-up (non-blocking):** If future refactor introduces a
  `@nzila/platform-db-witness` helper that provides raw-driver access
  under audit-controlled conditions, migrate this test to that helper
  and remove the exemption. Not required for Phase 0B.

## 6. Verdict

The INV-06 exemption is:

- **Narrow** (single file literal, test-only).
- **Necessary** (independent witness cannot use the same wrapper it
  is witnessing).
- **Precedented** (matches `proof-center-ports-db.ts` pattern).
- **Safe** (test file, not bundled in production).
- **Auditable** (explicit inline entry in `EXEMPT_PATHS`, cross-referenced
  from Phase 0B evidence artefacts).

**Adjudication:** The exemption stands. It does not compromise Phase 0B
runtime integrity and it does not hide a material violation.

## 7. Cross-references

- Source diff: `git show 8c19cdc0c -- tooling/contract-tests/db-boundary.test.ts`
- Boundary test: [`tooling/contract-tests/db-boundary.test.ts`](../../../../tooling/contract-tests/db-boundary.test.ts)
- Integration test: [`apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts`](../../../../apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts)
- Runtime callsite proof: [phase-0b3-runtime-callsite-proof.md](phase-0b3-runtime-callsite-proof.md)
