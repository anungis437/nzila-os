# Phase 0B.2R §7 — Runtime resolver production integration + real-DB proof

> **Status:** COMPLETE (foundational blocker cleared)
> **Governance track:** AMBER-remains-until-§15
> **Section owner:** platform-integration
> **Commit:** _pending — commit 6/6_

## 1. Purpose

Phase 0B.2 §5 flagged a foundational blocker: the platform-tenant
resolver (`apps/union-eyes/lib/organizations/platform-tenant.ts`) existed
and had unit tests, but **no runtime production callsite exercised the
resolver against real PostgreSQL**. All existing tests were mocked, so
the fail-closed contract at the runtime boundary was unverified.

Aubert's Phase 0B.2R mandate is verbatim:

> "at least one test must execute:
> API/server action → resolver → PostgreSQL.
> Mocks alone are insufficient."

and:

> "Do not accidentally convert organization identifiers to prefixed text IDs."

This section closes both requirements by (a) wiring the resolver into a
real production route, and (b) adding an integration test that executes
the full chain against a live PostgreSQL instance.

## 2. Verification method

**Live PostgreSQL instance:** native Windows PostgreSQL 17.8 on
`localhost:5433`, database `nzila_automation`, user `nzila`. This is the
main dev DB and shares its DDL with the production platform lineage
(`packages/db/drizzle/*.sql` migrations).

**Environment gate:** the integration test is skipped unless
`PHASE0B2R_INTEGRATION_DB_URL` is set. Run locally with:

```powershell
$env:PHASE0B2R_INTEGRATION_DB_URL = "postgres://nzila:nzila_dev@localhost:5433/nzila_automation"
$env:DATABASE_URL = $env:PHASE0B2R_INTEGRATION_DB_URL
pnpm exec vitest run apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts
```

**Result:** 2/2 tests passed against real PostgreSQL, 6.15 s (see §5).

## 3. Production integration — helper + route

### 3.1 Helper (`apps/union-eyes/lib/audit/platform-audit-events.ts`)

A new sanctioned entry point for writing to `public.audit_events`
(PLATFORM_OWNED_EXCLUSIVE per Phase 0B.2R §5). The helper enforces the
resolver contract at the write boundary:

```ts
export async function emitPlatformAuditEvent(
  input: EmitPlatformAuditEventInput,
  tx: Executor = db,
): Promise<EmittedPlatformAuditEvent> {
  // (1) Fail-closed on missing platform tenant mapping
  const orgId = await requirePlatformTenantId(input.organizationId, tx)

  // (2) Compute linkage-only-v0 hash
  const hash = computeLinkageHash({ ... })

  // (3) Insert into public.audit_events with resolved UUID org_id
  const result = await tx.execute(sql`
    INSERT INTO public.audit_events ( ... )
    VALUES ( ${orgId}::uuid, ... )
    RETURNING id
  `)
  ...
}
```

Key contract points:

* `requirePlatformTenantId` is invoked before any INSERT — a missing
  `platform_tenant_id` throws `PlatformTenantMappingRequired`
  (code `PLATFORM_TENANT_MAPPING_REQUIRED`) and the INSERT is never
  attempted.
* The resolved `orgId` is bound as `::uuid` — no textual coercion, no
  prefixed-id substitution.
* The hash payload is canonicalised and SHA-256 hashed (linkage-only-v0
  scheme, matching the `audit_events.hash_version` DB default).

### 3.2 Production callsite — `apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts`

Wired into the CUPE pilot bootstrap endpoint at the successful-bootstrap
observability point:

**(a) Provisioning at bootstrap** — idempotent platform participant
registration for the new pilot org (creates the `orgs` row with the
same UUID as `organizations.id` and sets `platform_tenant_id`):

```ts
await withSystemContext(async () =>
  provisionPlatformParticipant({
    organizationId: orgId!,
    legalName: fixture.org.name,
    jurisdiction: 'CA',
  }),
);
```

**(b) Platform-audit emit** — mirrors the bootstrap event onto
`public.audit_events` via the resolver-enforced helper:

```ts
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

This is the first non-test callsite of `requirePlatformTenantId` in the
production code path.

## 4. Real-DB integration test

**File:** `apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts`

**Chain exercised:**

```
test (server-side helper caller)
  → emitPlatformAuditEvent               (server action)
    → requirePlatformTenantId            (resolver)
      → SELECT platform_tenant_id
          FROM public.organizations      (PostgreSQL)
    → INSERT INTO public.audit_events    (PostgreSQL)
      RETURNING id
```

Two test cases:

* **Happy path:** provisions the platform participant (real
  `provisionPlatformParticipant` call → real `orgs` INSERT + real
  `organizations.platform_tenant_id` UPDATE), then invokes
  `emitPlatformAuditEvent`, then re-SELECTs from
  `public.audit_events` to prove the row physically landed with a
  UUID `org_id` (asserted matches `HAPPY_ORG_ID`).
* **Fail-closed:** invokes `emitPlatformAuditEvent` for an org whose
  `platform_tenant_id` is explicitly `NULL`. Asserts the call throws
  `PlatformTenantMappingRequired` with `code =
  'PLATFORM_TENANT_MAPPING_REQUIRED'`, and re-SELECTs to prove
  zero rows were written.

## 5. Test execution transcript

```
$env:PHASE0B2R_INTEGRATION_DB_URL = "postgres://nzila:nzila_dev@localhost:5433/nzila_automation"
$env:DATABASE_URL = $env:PHASE0B2R_INTEGRATION_DB_URL
pnpm exec vitest run apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts

 RUN  v4.1.2 C:/APPS/nzila-automation-phase0b-clean

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  6.15s
```

## 6. Physical write proof

Immediately after the test run, a raw `psql` SELECT confirms the audit
row landed in the platform-owned table with a UUID `org_id`:

```
SELECT id, org_id, actor_user_id, action, hash_version
  FROM public.audit_events
 WHERE actor_user_id LIKE 'test:phase0b2r-section-7:%'
 ORDER BY occurred_at DESC LIMIT 3;

                  id                  |                org_id                |
--------------------------------------+--------------------------------------+
 08750cf8-7e85-4da2-8104-487a84058b72 | 00000007-0000-4007-8007-000000000007 |

                         actor_user_id                         |            action            | hash_version
---------------------------------------------------------------+------------------------------+----------------
 test:phase0b2r-section-7:21bb5610-0e0f-47bd-ae33-4a74b452cfe7 | test.phase0b2r.section7.emit | linkage-only-v0
(1 row)
```

Key observations for the mandate:

* `org_id` is a **UUID** (`00000007-0000-4007-8007-000000000007`) — NOT
  a prefixed text id. ✅
* `org_id` **equals** `organizations.id` for the seeded happy-path org,
  as required by the same-UUID CHECK on `organizations.platform_tenant_id`. ✅
* `hash_version` is the DB default `linkage-only-v0`, matching the
  scheme the helper computes. ✅

## 7. What §7 does NOT do

* Does not backfill audit rows for prior bootstrap runs. `audit_events`
  is append-only (immutability trigger on the platform DB); §7 only
  adds forward-emission at the current bootstrap callsite.
* Does not migrate the app-schema `audit_logs` writer (`auditLog(...)`
  in `apps/union-eyes/lib/audit-logger.ts`) to `audit_events`. These
  are separate tables serving separate purposes:
  - `audit_logs` — application-schema, RLS-scoped, user-facing audit trail
  - `audit_events` — platform-schema, hash-linked, immutable evidence chain
* Does not add other production callsites of `emitPlatformAuditEvent`.
  Additional callsites are follow-up work (Phase 0B.2R §9+ or Phase 0C).
* Does not verify the FK integrity of legacy pre-Phase-0B `audit_events`
  rows — that is §10 (clean composition proof) and §11 (existing-DB
  upgrade proof).

## 8. Files added / modified in this section

| File | Change | LOC |
|---|---|---|
| `apps/union-eyes/lib/audit/platform-audit-events.ts` | **new** — sanctioned emitter | +190 |
| `apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts` | **new** — real-DB test | +170 |
| `apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts` | provisioning + emit wired in | +37 |
| `reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-resolver-runtime-integration.md` | **new** — this report | +this file |

## 9. Cross-references

* Phase 0B.2 §5 blocker origin: `reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-audit.md`
* Resolver spec: `apps/union-eyes/lib/organizations/platform-tenant.ts`
* Same-UUID contract proof: `reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-org-contract-reverify.md` (§6)
* Org id type verification: `reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-org-id-type-reconciliation.md` (§8)
* Next section: §9 (KPI database migration proof — 6 tables with data)

---

_This is a Phase 0B.2R foundational-blocker closure. The overall Phase
0B.2R status remains AMBER until §15 closure._
