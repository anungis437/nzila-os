# Phase 0B.3 — Runtime Callsite Proof

**Section:** 2
**Date:** 2026-07-23 (America/New_York)
**Branch:** `fix/union-eyes-phase0b-clean`
**HEAD:** `8c19cdc0c`

---

## 1. The Phase 0B foundational runtime bar (verbatim)

From `phase-0b2r-resolver-runtime-integration.md §1`:

> at least one test must execute: API/server action → resolver →
> PostgreSQL. Mocks alone are insufficient.

## 2. The production call site

File: `apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts`
Route: `POST /api/pilot/bootstrap/cupe`
HTTP handler: exported via the standard `union-eyes` action wrapper.

### 2.1 Provisioning invocation (idempotent tenant materialisation)

Lines 100–107 (extract):

```ts
await withSystemContext(async () => {
  await provisionPlatformParticipant({
    id: orgId,
    name: fixture.org.name,
    slug: fixture.org.slug,
    ownerUserId: userId ?? 'system:pilot-bootstrap',
  });
});
```

Effect: `orgs` row is upserted (ON CONFLICT DO NOTHING) and
`organizations.platform_tenant_id` is backfilled where NULL. The
same-UUID DB `CHECK` constraint (`platform_tenant_id = id`) enforces
the contract at the storage layer.

### 2.2 Resolver-enforced platform audit write

Lines 217–234 (extract):

```ts
// Phase 0B.2R §7 — mirror the bootstrap event onto the platform-owned
// audit_events chain via the resolver-enforced helper. This is a real
// production callsite of requirePlatformTenantId → PostgreSQL and is
// the counterpart to the integration test at
// apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts
await emitPlatformAuditEvent({
  organizationId: orgId,
  actorUserId: userId ?? 'system:pilot-bootstrap',
  actorRole: userId ? 'admin' : 'system',
  action: 'pilot.cupe_bootstrap_executed',
  targetType: 'organization',
  targetId: orgId,
  afterJson: {
    membersInserted,
    casesInserted,
    worksites: fixture.worksites.length,
    reset: body.reset,
  },
});
```

Inside `emitPlatformAuditEvent` (`apps/union-eyes/lib/audit/platform-audit-events.ts`):

1. `requirePlatformTenantId(organizationId)` runs — **fail-closed** if
   the mapping is missing (throws `PlatformTenantMappingRequired`).
2. The returned platform tenant UUID is bound via `${orgId}::uuid`
   (no textual coercion).
3. A linkage-only-v0 hash is computed (SHA-256 over canonical JSON).
4. `INSERT INTO public.audit_events (...)` is executed via `sql` on the
   postgres.js client.
5. Return payload: `{ id, orgId, hash }`.

## 3. The real-DB integration test

File: `apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts`

- Uses `describeIfDb = DB_URL ? describe : describe.skip` gated by
  `PHASE0B2R_INTEGRATION_DB_URL`.
- `HAPPY_ORG_ID = 00000007-0000-4007-8007-000000000007` — seeded via
  raw `INSERT` in `beforeAll`, cleaned up in `afterAll`.
- `FAIL_ORG_ID = 00000007-0000-4007-8007-000000000008` — never
  inserted, so `requirePlatformTenantId` throws.
- `actorUserId = test:phase0b2r-section-7:${runId}` for row isolation
  across concurrent runs.

### 3.1 Happy-path assertions

- Insert returns `{ id, orgId, hash }` with `orgId` equal to the seeded
  UUID.
- `psql` witness query
  (`SELECT id, org_id::text, hash FROM public.audit_events WHERE id = $1`)
  physically confirms the row is in `public.audit_events` with `org_id`
  = seeded UUID (not text-cast).

### 3.2 Fail-closed assertions

- Call with `FAIL_ORG_ID` throws `PlatformTenantMappingRequired` (error
  code `PLATFORM_TENANT_MAPPING_REQUIRED`).
- `psql` witness query proves **zero rows** were inserted with the
  fail actor.

### 3.3 Re-run on 2026-07-23 (Phase 0B.3 adjudication)

Command:

```pwsh
$env:PHASE0B2R_INTEGRATION_DB_URL = "postgres://nzila:nzila_dev@localhost:5433/nzila_automation"
pnpm exec vitest run apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts
```

Result: **2/2 passed** in 6.77s.

Transcript (last-lines):

```
 RUN  v4.1.2 C:/APPS/nzila-automation-phase0b-clean

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  14:08:17
   Duration  6.77s (transform 2.74s, setup 0ms, import 689ms, tests 5.79s, environment 0ms)
```

## 4. Composed-runtime proofs (independent evidence)

The same call site is additionally exercised in two composed-runtime
scripts:

| Script | Purpose | Result |
| ------ | ------- | ------ |
| `tooling/checks/phase0b2r-compose-with-runtime.ps1` | Clean composition proof (fresh ephemeral DB `phase0b2r_compose_20260723125331`) — 15 steps | Test 1 passed, aggregate 6/6, DROP DATABASE succeeded (§10 evidence) |
| `tooling/checks/phase0b2r-upgrade-with-runtime.ps1` | Existing-DB upgrade proof (Acme data preservation) — 16 steps | Acme checkpoints green, contract rejection enforced, test 1 passed, DROP DATABASE succeeded (§11 evidence) |

## 5. Conclusion

The literal Phase 0B foundational runtime bar — "at least one test must
execute API/server action → resolver → PostgreSQL" — is satisfied by
`POST /api/pilot/bootstrap/cupe` → `provisionPlatformParticipant` +
`emitPlatformAuditEvent` → `requirePlatformTenantId` → PostgreSQL,
proven by real-DB test 2/2 pass on 2026-07-23 and independently by the
composed-runtime and upgrade-runtime scripts.

## 6. Cross-references

- Route source: [`apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts`](../../../../apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts)
- Audit helper: [`apps/union-eyes/lib/audit/platform-audit-events.ts`](../../../../apps/union-eyes/lib/audit/platform-audit-events.ts)
- Resolver: [`apps/union-eyes/lib/organizations/platform-tenant.ts`](../../../../apps/union-eyes/lib/organizations/platform-tenant.ts)
- Real-DB test: [`apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts`](../../../../apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts)
- Phase 0B.2R §7 evidence: [../phase-0b2r/phase-0b2r-resolver-runtime-integration.md](../phase-0b2r/phase-0b2r-resolver-runtime-integration.md)
- §10 composed proof: [../phase-0b2r/phase-0b2r-clean-composition-with-runtime-proof.md](../phase-0b2r/phase-0b2r-clean-composition-with-runtime-proof.md)
- §11 upgrade proof: [../phase-0b2r/phase-0b2r-existing-db-upgrade-with-runtime-proof.md](../phase-0b2r/phase-0b2r-existing-db-upgrade-with-runtime-proof.md)
