# Phase 0B.3 — `organization_members` Ownership Proof

**Section:** 7
**Date:** 2026-07-23 (America/New_York)
**Classification (from manifest v2):** `UNION_EYES_OWNED_SHARED`

---

## 1. Classification

- **Physical schema (current):** `public.organization_members`.
- **Target schema (manifest):** `union_eyes.organization_members` (Wave 1
  physical relocation).
- **DDL owner:** Union Eyes (Drizzle) — `apps/union-eyes/db/schema-organizations.ts`.
- **Django access:** `managed=False` adoption via
  `apps/union-eyes/api/migrations/0004_adopt_platform_organization_members.py`.

## 2. Internal consistency of the classification

The `UNION_EYES_OWNED_SHARED` classification is internally consistent
because:

- **Ownership:** Union Eyes owns the DDL and evolution of the table
  (Drizzle schema authoritative; Django only reads via unmanaged model).
- **Sharing:** Read access to the row set is offered to other packages
  that need organization membership context, but they must not issue
  DDL.
- **Physical-versus-logical:** The manifest permits `target_schema` to
  differ from the current physical schema; this is a legitimate
  transitional state documented in the manifest v2 spec.

## 3. Phase 0B impact assessment

Question: Does the current `public` physical placement affect any Phase
0B pillar?

| Pillar | Affected? | Why |
| ------ | --------- | --- |
| 1 — two-lineage organization model (`public.orgs` ⇔ `public.organizations`) | NO | The same-UUID FK+CHECK is on `organizations`, not `organization_members` |
| 2 — KPI identifier value/type contract | NO | KPI tables are in `ue_cognition` schema; no dependency on `organization_members` location |
| 3 — sanctioned cross-lineage provisioning entry point | NO | Resolver bind is `organization_id → orgs.id`; `organization_members` is not part of the provisioning contract |
| 4 — at least one runtime proof | NO | The CUPE bootstrap call site does not read/write `organization_members` for its resolver-integration proof |

## 4. Wave 1 relocation plan (not Phase 0B scope)

Deferred relocation steps (Wave 1):

1. `CREATE SCHEMA IF NOT EXISTS union_eyes;`
2. `ALTER TABLE public.organization_members SET SCHEMA union_eyes;`
3. Update Drizzle schema (`apps/union-eyes/db/schema-organizations.ts`)
   `pgSchema('union_eyes').table('organization_members', ...)`.
4. Regenerate Django `managed=False` model to point at
   `db_table = 'union_eyes"."organization_members'` (or equivalent).
5. Run migration lock, deploy to staging, verify no consumer regresses.

None of these steps is a Phase 0B gate.

## 5. Blockers

**Phase 0B blockers introduced by current `public` placement: 0.**

## 6. Cross-references

- Prior resolution note: [../phase-0b2r/phase-0b2r-organization-members-resolution.md](../phase-0b2r/phase-0b2r-organization-members-resolution.md)
- Drizzle schema: [`apps/union-eyes/db/schema-organizations.ts`](../../../../apps/union-eyes/db/schema-organizations.ts)
- Django unmanaged model migration: [`apps/union-eyes/api/migrations/0004_adopt_platform_organization_members.py`](../../../../apps/union-eyes/api/migrations/0004_adopt_platform_organization_members.py)
- Ownership closure: [phase-0b3-ownership-closure.md](phase-0b3-ownership-closure.md)
- Open items register (OPEN-06): [phase-0b3-open-items-register.md](phase-0b3-open-items-register.md)
