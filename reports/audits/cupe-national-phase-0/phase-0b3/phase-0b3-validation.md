# Phase 0B.3 — Validation Evidence

**Section:** 11
**Date:** 2026-07-23 (America/New_York)
**HEAD:** `8c19cdc0c`

---

## 1. Decisive real-DB integration test

**File:** `apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts`
**Gate:** `PHASE0B2R_INTEGRATION_DB_URL=postgres://nzila:nzila_dev@localhost:5433/nzila_automation`
**Fresh run (2026-07-23):**

```
RUN  v4.1.2 C:/APPS/nzila-automation-phase0b-clean
Test Files  1 passed (1)
     Tests  2 passed (2)
 Duration  6.77s
```

Assertions covered:

- Happy path — `provisionPlatformParticipant` + `emitPlatformAuditEvent`
  cause a real INSERT into `public.audit_events` under
  `HAPPY_ORG_ID = 00000007-0000-4007-8007-000000000007`.
  Independent `psql` witness confirms the row is physically present
  with `org_id` matching the UUID.
- Fail-closed — With `FAIL_ORG_ID = 00000007-0000-4007-8007-000000000008`
  (never provisioned), `emitPlatformAuditEvent` throws
  `PlatformTenantMappingRequired` (code `PLATFORM_TENANT_MAPPING_REQUIRED`)
  and zero audit rows are written.

## 2. Decisive fresh suite (46/46)

Four Phase 0B.2R decisive files:

- `packages/platform-org-resolver/src/__tests__/*`
- `apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts`
- `apps/union-eyes/app/api/__tests__/pilot-bootstrap-cupe.route.test.ts`
- `tooling/checks/schema-ownership-validate.test.ts`

Fresh result (2026-07-23):

```
Test Files  4 passed (4)
     Tests 46 passed (46)
 Duration 22.59s
```

## 3. `tooling-checks` project fresh run

```
RUN  v4.1.2 C:/APPS/nzila-automation-phase0b-clean
Test Files  1 passed (1)
     Tests 18 passed (18)
  Duration  406ms
```

## 4. Full contract-tests fresh run

```
RUN  v4.1.2 C:/APPS/nzila-automation-phase0b-clean
Test Files 272 passed (272)
     Tests 9426 passed (9426)
  Duration 207.15s
```

Includes `tooling/contract-tests/db-boundary.test.ts` (INV-06) with
the §17 exemption for
`apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts`.
INV-06 remains **green**.

## 5. Typecheck fresh run

```
Tasks: 236 successful, 236 total
Time:  1m12.508s
```

## 6. Lint fresh run

```
2425 problems (0 errors, 2425 warnings)
Tasks: 171 successful, 171 total
Time:  2m39.222s
```

Warnings are pre-existing (`@typescript-eslint/no-explicit-any` in
legacy Union Eyes code, etc.). Zero errors.

## 7. `validate:docs` fresh run

```
Files scanned: 2216
Findings:      2753
  Errors:   0
  Warnings: 1224
  Info:     1529
✅ No critical documentation errors
```

## 8. `governance:audit` fresh run

- All 8 governance layers execute.
- Release Governance Score: 9/10 (pre-existing target).
- `governance:check-db-imports`: `0 errors, 324 warnings` (pre-existing).
- `financial-service:health`: PASS.
- No errors surfaced by any layer.

## 9. Manifest verification

```
total: 125
foundational: 13
blockers: 0
foundational not human-reviewed: 0
```

## 10. Vitest config scope check

Root `vitest.config.ts` — 2 additions:

- `packages/platform-org-resolver` (new Phase 0B.2 package)
- `tooling/checks` (existing directory, previously untested at project
  level)

New file `tooling/checks/vitest.config.ts` (10 lines):

- `include: ["**/*.test.ts"]`
- `passWithNoTests: true`

Both in-scope for Phase 0B.2 (create the infrastructure needed to
test the new packages).

## 11. Cross-references

- Runtime callsite proof: [phase-0b3-runtime-callsite-proof.md](phase-0b3-runtime-callsite-proof.md)
- INV-06 exemption review: [phase-0b3-inv06-exemption-review.md](phase-0b3-inv06-exemption-review.md)
- Route test review: [phase-0b3-route-test-review.md](phase-0b3-route-test-review.md)
- Ownership closure: [phase-0b3-ownership-closure.md](phase-0b3-ownership-closure.md)
- Clean branch review: [phase-0b3-clean-branch-review.md](phase-0b3-clean-branch-review.md)
- Final adjudication: [phase-0b3-final-adjudication.md](phase-0b3-final-adjudication.md)
