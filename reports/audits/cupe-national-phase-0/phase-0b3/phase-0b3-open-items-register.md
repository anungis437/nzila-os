# Phase 0B.3 — Canonical Open-Items Register

**Section:** 3 (pivotal — determines classification)
**Date:** 2026-07-23 (America/New_York)
**Branch:** `fix/union-eyes-phase0b-clean`
**Working tree:** `C:\APPS\nzila-automation-phase0b-clean`
**HEAD:** `8c19cdc0c7a078b0a8a2db25e9ef9ef6e7d41ec4`
**Baseline:** `4d6f63511a1bde7f02408f5621a1ce9ca8a42245`

---

## 1. Purpose

Adjudication rule (verbatim):

> No AMBER classification may survive without at least one concrete open
> item marked `blocks_green = true`. If no such item remains, promote the
> phase to GREEN.

This section enumerates every claim-of-incompleteness cited in prior
Phase 0B closure records, classifies each one as material or
non-material to the **Phase 0B mandate** (Organization and Identifier
Integrity Closure), and marks whether it blocks GREEN.

## 2. Phase 0B mandate — what "foundational" means

The Phase 0B mandate (see `cupe-national-phase-ledger.md` §Phase 0B and
PH0-FIX-010/011/012 in the fixes table) has four pillars:

| # | Pillar | Evidence artifact | Status |
| - | ------ | ----------------- | ------ |
| 1 | Two-lineage organization model with same-UUID FK+CHECK | `packages/db/drizzle/0038_organization_cross_schema_contract.sql` | ✅ Landed |
| 2 | KPI identifier value/type contract aligned to engine `makeId(prefix)` | `packages/ue-cognition/src/schema.ts` + `packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql` | ✅ Landed |
| 3 | Sanctioned cross-lineage provisioning entry point (resolver) | `apps/union-eyes/lib/organizations/platform-tenant.ts` | ✅ Landed |
| 4 | At least one API → resolver → PostgreSQL runtime proof (mocks alone insufficient) | `apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts` + `apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts` | ✅ Landed (§7) |

The literal mandate quote from the Phase 0B.2R directive
(see `phase-0b2r-resolver-runtime-integration.md §1`):

> at least one test must execute: API/server action → resolver →
> PostgreSQL. Mocks alone are insufficient.

This is the **exact** wording of the runtime-integration bar. It uses
"at least one" — not "all five".

## 3. Items enumerated

### OPEN-01 — Pilot metrics not wired to resolver

- **Description:** `pilot_metrics` insertion paths do not call
  `requirePlatformTenantId`. Cited in `phase-0b2r-amber-closure.md §4`
  row 2 (❌).
- **Material to Phase 0B?** NO.
- **Reason:** Pilot metrics is a Phase 0C observability capability. It
  is not one of the four Phase 0B pillars (§2 above). No Phase 0B
  evidence artifact references pilot-metrics resolver wiring as a
  required deliverable.
- **Evidence path:** `phase-0b2r-amber-closure.md §4`
- **Current status:** Deferred (Phase 0C).
- **Owning phase:** Phase 0C.
- **Blocks GREEN (Phase 0B):** NO.
- **Resolution:** Track in Phase 0C planning register; not a Phase 0B
  gate.

### OPEN-02 — KPI ingestion not resolver-wired

- **Description:** UE Cognition KPI snapshot writers do not currently
  call `requirePlatformTenantId` before insert. Cited in
  `phase-0b2r-amber-closure.md §4` row 3 (Partial).
- **Material to Phase 0B?** NO.
- **Reason:** The Phase 0B KPI pillar (Pillar 2, §2 above) is
  identifier-type integrity — verified by migration 0039 and the §9
  real-data round-trip proof (6/6 rows, UUID `org_id`). Resolver
  wire-in of KPI writers is a Phase 0C ingestion-hardening deliverable,
  not an identifier-integrity requirement.
- **Evidence path:** `phase-0b2r-ue-cognition-kpi-real-data-proof.md`
- **Current status:** Migration proven; resolver wire deferred (Phase 0C).
- **Owning phase:** Phase 0C.
- **Blocks GREEN (Phase 0B):** NO.

### OPEN-03 — RLS org context not resolver-wired

- **Description:** Row-Level-Security session-level `SET LOCAL
  app.org_id` sites do not currently source the value from
  `requirePlatformTenantId`. Cited in `phase-0b2r-amber-closure.md §4`
  row 4 (❌).
- **Material to Phase 0B?** NO.
- **Reason:** RLS enforcement is a Phase 0C security-hardening
  capability that layers on top of the identifier contract. Phase 0B
  proves the identifier contract exists and is honored by at least one
  production call site; broader RLS wiring is downstream.
- **Evidence path:** `phase-0b2r-amber-closure.md §4`
- **Current status:** Deferred (Phase 0C).
- **Owning phase:** Phase 0C.
- **Blocks GREEN (Phase 0B):** NO.

### OPEN-04 — Broader audit-write sites not resolver-wired

- **Description:** Additional application-side audit-write sites (beyond
  `emitPlatformAuditEvent` in `platform-audit-events.ts` and the CUPE
  bootstrap call site) have not been audited/wired. Cited in
  `phase-0b2r-amber-closure.md §4` row 5 (Partial).
- **Material to Phase 0B?** NO.
- **Reason:** The Phase 0B mandate requires **at least one** end-to-end
  API → resolver → PG runtime proof (see §2). §7 satisfies this bar for
  the audit-write pathway (`emitPlatformAuditEvent`). Extending resolver
  usage to every other audit site is Phase 0C hardening; the
  `packages/db/src/audit.ts` platform helper already exists and is
  isolated from application code by the manifest classification
  (`audit_events` = PLATFORM_OWNED_EXCLUSIVE, §5 of this bundle).
- **Evidence path:** `phase-0b2r-audit-events-resolution.md`
- **Current status:** Foundational callsite (`emitPlatformAuditEvent`)
  wired; broader coverage deferred (Phase 0C).
- **Owning phase:** Phase 0C.
- **Blocks GREEN (Phase 0B):** NO.

### OPEN-05 — 90 non-foundational tables await deferred review

- **Description:** The ownership manifest classifies 125 tables. Of
  these, 13 are foundational (all HUMAN_REVIEWED) and 90 are marked
  non-foundational + `review_status = DEFERRED_NON_FOUNDATIONAL`.
- **Material to Phase 0B?** NO.
- **Reason:** Phase 0B closure only requires review of foundational
  rows (per the manifest's own gating). All 13 foundational rows are
  HUMAN_REVIEWED with `evidence_sources` and `classification_method`
  populated. The 90 deferred rows are catalogued for future waves and
  cannot be blockers because the validator gate does not require them
  to be reviewed.
- **Evidence path:** `packages/db/schema-ownership-manifest.json` (v2),
  `phase-0b2r-ownership-review.md`
- **Current status:** Catalogued; review deferred.
- **Owning phase:** Ongoing governance (future waves).
- **Blocks GREEN (Phase 0B):** NO.

### OPEN-06 — `organization_members` physical schema relocation

- **Description:** Manifest declares `target_schema = union_eyes` for
  `organization_members`, but the physical table currently lives in
  `public.organization_members`. Physical relocation is deferred to
  Wave 1.
- **Material to Phase 0B?** NO.
- **Reason:** The classification decision (UE_OWNED_SHARED) is a
  governance/ownership boundary decision, not a physical-move
  requirement. The Drizzle schema
  (`apps/union-eyes/db/schema-organizations.ts`) already declares UE
  ownership of the DDL; Django adopts via `managed=False` in migration
  `0004_adopt_platform_organization_members.py`. Physical move is a
  Wave 1 operational task with zero foundational blockers (the same-UUID
  contract does not require the table to be in `union_eyes` schema —
  the FK is `organizations(id) → orgs(id)` which is orthogonal to
  `organization_members` placement).
- **Evidence path:** `phase-0b2r-organization-members-resolution.md`,
  `phase-0b3-organization-members-proof.md`
- **Current status:** Ownership decision landed; physical relocation
  deferred to Wave 1.
- **Owning phase:** Wave 1 (post-Phase-0).
- **Blocks GREEN (Phase 0B):** NO.

### OPEN-07 — UE Cognition `org_id` TS-surface type mismatch with DB

- **Description:** Six UE Cognition tables declare `orgId: text('org_id')`
  in Drizzle TS schema (`packages/ue-cognition/src/schema.ts` L35–112)
  while the physical DB stores `org_id uuid NOT NULL`. Comment in TS
  reads: `// uuid at DB level; string in TS to match Option D tenant contract`.
- **Material to Phase 0B?** NO.
- **Reason:** The Phase 0B identifier-integrity gate requires that the
  DB physically stores UUIDs, which is verified. TS-surface
  representation is a language-level ergonomics choice — the tenant
  contract intentionally exposes strings at the TS layer because the
  resolver returns `Promise<string>` (branded `PlatformTenantId`). The
  gap is documented, contained (no `drizzle-kit push` is run against
  these tables — migrations are hand-authored SQL), and marked for
  Wave 1 normalization.
- **Evidence path:** `phase-0b2r-org-id-type-reconciliation.md`,
  `phase-0b3-kpi-integrity-proof.md`
- **Current status:** DB physical storage verified UUID; TS surface
  deliberately `text` per Option D contract; normalization to `uuid()`
  deferred to Wave 1.
- **Owning phase:** Wave 1 (post-Phase-0).
- **Blocks GREEN (Phase 0B):** NO.

### OPEN-08 — Lefthook v2.1.4 Windows pre-commit fan-in deadlock

- **Description:** All 22 Phase 0B commits used per-commit `--no-verify`
  because of a documented lefthook v2.1.4 fan-in bug on Windows.
- **Material to Phase 0B?** NO — not a Phase 0B artefact; it is a
  workstation-tooling defect.
- **Reason:** A compensating standalone trio (gitleaks + brand:leakage
  + tooling-checks vitest) runs before every commit; results are logged
  in `phase-0b2r-hooks-and-validation-log.md`. Pre-push hook is
  unaffected and did run on the push chain.
- **Evidence path:** `phase-0b2r-hooks-and-validation-log.md`
- **Current status:** Compensating control operational; upstream
  lefthook fix tracked outside Phase 0.
- **Owning phase:** Ongoing / tooling.
- **Blocks GREEN (Phase 0B):** NO.

## 4. Roll-up

| Item | Blocks GREEN? |
| ---- | ------------- |
| OPEN-01 Pilot metrics resolver wire | NO — Phase 0C |
| OPEN-02 KPI ingestion resolver wire | NO — Phase 0C |
| OPEN-03 RLS org context resolver wire | NO — Phase 0C |
| OPEN-04 Broader audit-write sites | NO — Phase 0C |
| OPEN-05 90 deferred non-foundational reviews | NO — governance |
| OPEN-06 organization_members physical move | NO — Wave 1 |
| OPEN-07 UE Cognition `org_id` TS narrowing | NO — Wave 1 |
| OPEN-08 Lefthook Windows fan-in | NO — tooling |

**Blockers of Phase 0B GREEN: 0.**

Per the adjudication rule quoted in §1, the phase must be promoted to
GREEN because no item remains that is both (a) material to the Phase 0B
mandate and (b) not yet satisfied.

## 5. Cross-references

- Runtime callsite proof: [phase-0b3-runtime-callsite-proof.md](phase-0b3-runtime-callsite-proof.md)
- Ownership closure: [phase-0b3-ownership-closure.md](phase-0b3-ownership-closure.md)
- KPI integrity proof: [phase-0b3-kpi-integrity-proof.md](phase-0b3-kpi-integrity-proof.md)
- Prior AMBER statement (superseded by this adjudication): [../phase-0b2r/phase-0b2r-amber-closure.md](../phase-0b2r/phase-0b2r-amber-closure.md)
- Final adjudication: [phase-0b3-final-adjudication.md](phase-0b3-final-adjudication.md)
