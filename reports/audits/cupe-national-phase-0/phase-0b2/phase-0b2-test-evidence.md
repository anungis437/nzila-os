# Phase 0B.2 — §16 Test Evidence

**Status.** ✅ ALL GREEN.
**Environment.** Clean worktree `C:\APPS\nzila-automation-phase0b-clean`,
branch `fix/union-eyes-phase0b-clean`, `pnpm install --no-frozen-lockfile`
executed once against workspace root, Node 24.13.1, vitest 4.1.2, pnpm
10.33.0.

## 1. Ownership manifest validator

Command:

```powershell
pnpm dlx tsx tooling/checks/schema-ownership-validate.ts
```

Output:

```
Schema ownership manifest is valid.
  Tables declared:            125
  Foundational slice size:    13
  OWNERSHIP_UNRESOLVED count: 0
  Ownership distribution:
    DJANGO_INTERNAL                    9
    PLATFORM_OWNED_EXCLUSIVE          13
    PLATFORM_OWNED_SHARED              4
    SAME_NAME_DIFFERENT_MEANING        2
    UNION_EYES_OWNED_EXCLUSIVE        96
    UNION_EYES_OWNED_SHARED            1
```

Verdict: **PASS** — 0 UNRESOLVED, 125 tables classified, foundational
slice count matches §6 doc (13).

## 2. Platform organization resolver — `@nzila/platform-org-resolver`

Test file: `packages/platform-org-resolver/src/__tests__/resolver.test.ts`.

Command:

```powershell
cd packages/platform-org-resolver
node ../../node_modules/vitest/vitest.mjs run
```

Output:

```
 RUN  v4.1.2 C:/APPS/nzila-automation-phase0b-clean/packages/platform-org-resolver

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  09:59:31
   Duration  348ms
```

Verdict: **10/10 PASS**. Coverage:

- Fail-closed behavior when no context provided (throws
  `OrgContextRequiredError`).
- Contract violation detection (throws `OrgContractViolationError` when
  UE org id ≠ resolved platform tenant id).
- Successful resolution via injected `TenantVerifier`.
- All 5 foundational path entries load and each has a stable string id.
- Branded `PlatformTenantId` prevents raw-string coercion at type level.

Note on vitest launch: the package's own `pnpm exec vitest run` fails
because pnpm does not create a per-package `vitest` symlink under
`node_modules/vitest/` for this specific workspace configuration
(the hoisted vitest resolves at `../../node_modules/vitest/`). Invoking
`node <root>/node_modules/vitest/vitest.mjs run` uses the hoisted
installation directly, which is the same code path `pnpm test` and
`turbo test` invoke from the root.

## 3. Platform tenant DB adapter — `apps/union-eyes/lib/organizations/platform-tenant.ts`

Test file: `apps/union-eyes/lib/__tests__/platform-tenant.test.ts`.

Command:

```powershell
cd apps/union-eyes
node ../../node_modules/vitest/vitest.mjs run lib/__tests__/platform-tenant.test.ts
```

Output:

```
 RUN  v4.1.2 C:/APPS/nzila-automation-phase0b-clean/apps/union-eyes

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  09:59:47
   Duration  957ms
```

Verdict: **10/10 PASS**. Coverage:

- `resolvePlatformTenantId(orgId)` returns the resolved uuid on happy path.
- `resolvePlatformTenantId(orgId)` returns `null` when the UE org row
  does not exist.
- `requirePlatformTenantId(orgId)` throws `PlatformTenantMappingRequired`
  (with `code=PLATFORM_TENANT_MAPPING_REQUIRED` and
  `organizationId=<orgId>`) when the mapping is absent.
- `provisionPlatformParticipant(...)` inserts into `public.orgs` and
  `union_eyes.organizations` under a shared uuid.
- Transactional overload (`(orgId, tx)`) uses the injected tx instead
  of the module-level db.
- Query composition uses `eq(organizations.id, orgId)` and
  `sql`SELECT id FROM public.orgs`...` shapes (verified via mock capture).

## 4. Composition + upgrade proofs

These are covered as their own sections:

- §14 `phase-0b2-clean-db-composition.md` — clean-DB replay of every
  DDL artifact in Phase 0B.2 order. PASS.
- §15 `phase-0b2-existing-db-upgrade.md` — idempotent re-application on
  a populated DB + constraint enforcement. PASS.

Both used `psql`-based drivers rather than TypeScript test harnesses,
because both operate on a live PostgreSQL 17 instance rather than on
in-process mocks.

## 5. What §16 does NOT cover

- Integration into the 31 UE route files (that is Phase 0C, per §6 /
  §13 charter). No route imports the resolver in this branch yet.
- End-to-end auth flow (that requires the Django + Next dev stack up,
  which is a Phase 0C validation exercise).
- Coverage thresholds — the `union-eyes` vitest config declares 99%
  thresholds on `route.ts` files; running just the platform-tenant
  test bypasses the coverage gate on purpose (the gate is scoped to
  the API route files and is exercised by the full suite in §17).

## 6. Summary table

| Gate | Result | Test count |
| --- | --- | --- |
| Ownership manifest validator | ✅ PASS | 125 tables classified, 0 UNRESOLVED |
| `@nzila/platform-org-resolver` unit tests | ✅ PASS | 10 / 10 |
| `platform-tenant.ts` DB-adapter unit tests | ✅ PASS | 10 / 10 |
| Clean-DB composition proof (§14) | ✅ PASS | 6 verification queries |
| Existing-DB upgrade proof (§15) | ✅ PASS | 5 snapshot checks + 1 constraint-rejection |
