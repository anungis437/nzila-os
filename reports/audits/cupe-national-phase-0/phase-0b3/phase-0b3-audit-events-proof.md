# Phase 0B.3 — `audit_events` Ownership Proof

**Section:** 8
**Date:** 2026-07-23 (America/New_York)
**Classification (from manifest v2):** `PLATFORM_OWNED_EXCLUSIVE`

---

## 1. Classification

- **Physical schema:** `public.audit_events`.
- **DDL owner:** Platform — `packages/db/` (schema + migrations).
- **Application access:** Only via sanctioned helpers
  (`packages/db/src/audit.ts` and, for Union Eyes,
  `apps/union-eyes/lib/audit/platform-audit-events.ts` which is itself
  a whitelisted helper).
- **Django access:** None. Django emits its own domain audit rows via
  `apps/union-eyes/api/audit_core/models.py::AuditLog` in a separate
  logical table (`audit_logs`) — deliberately distinct from
  `audit_events`.

## 2. Verification queries

### 2.1 Platform-owned references in `packages/db`

```
Count of files under packages/db that mention `audit_events`: 96 refs
(source: prior enumeration in phase-0b2r-audit-events-resolution.md §4).
```

These include the Drizzle schema declaration, migration DDL,
`emitPlatformAudit` helper, and internal tests.

### 2.2 Zero Django `db_table = 'audit_events'` bindings

Confirmed in Phase 0B.2R §5: no `class Meta: db_table = 'audit_events'`
appears anywhere under `apps/union-eyes/api/`. Django's `AuditLog`
model uses `db_table = 'audit_logs'` (distinct table).

### 2.3 Fresh spot-check on 2026-07-23

`emitPlatformAuditEvent` (Union Eyes helper) is the only application
code path that inserts into `public.audit_events`. It uses the
sanctioned resolver-then-insert pattern (see
[phase-0b3-runtime-callsite-proof.md](phase-0b3-runtime-callsite-proof.md)).

## 3. Internal consistency of the classification

- **Exclusive:** No non-platform code owns DDL or issues direct
  DML against `public.audit_events` outside the sanctioned helper.
- **Platform-owned:** The DDL lives in `packages/db/drizzle/*.sql`.
- **Runtime write path:** Sanctioned helper (`emitPlatformAuditEvent`)
  enforces resolver check + `${orgId}::uuid` bind + linkage-v0 hash.

## 4. Phase 0B impact assessment

The `PLATFORM_OWNED_EXCLUSIVE` classification of `audit_events`:

- Enables the Phase 0B pillar-4 runtime proof (§7) — the sanctioned
  write path is a real production call site with a real-DB witness.
- Enforces the ownership boundary that INV-06 defends (see
  [phase-0b3-inv06-exemption-review.md](phase-0b3-inv06-exemption-review.md)).
- Introduces zero Phase 0B blockers.

## 5. Blockers

**Phase 0B blockers introduced by `audit_events` classification: 0.**

## 6. Cross-references

- Prior resolution note: [../phase-0b2r/phase-0b2r-audit-events-resolution.md](../phase-0b2r/phase-0b2r-audit-events-resolution.md)
- Sanctioned helper: [`apps/union-eyes/lib/audit/platform-audit-events.ts`](../../../../apps/union-eyes/lib/audit/platform-audit-events.ts)
- Platform audit table (Drizzle): search `packages/db/src/` for `auditEvents`
- Runtime callsite proof: [phase-0b3-runtime-callsite-proof.md](phase-0b3-runtime-callsite-proof.md)
- INV-06 exemption review: [phase-0b3-inv06-exemption-review.md](phase-0b3-inv06-exemption-review.md)
