# Phase 0B.2 — §13 Focused Code Reconstruction

**Status.** ✅ Complete on `fix/union-eyes-phase0b-clean` @ working tree.
**Scope.** Path-extraction ONLY of the two application-layer files
required by the Option D contract established in §10 (migration 0038) and
§12 (migration 0039). No cherry-pick of any historical commit was
performed. No `1e5a6bd94` (test-infra sweep) content was reconstructed.
No `7a1c90ab3` (docs/evidence sweep) content was reconstructed.

---

## 1. What was reconstructed

Two files were extracted verbatim from the historical branch
`fix/union-eyes-reality-remediation` @ commit `c40a3e33a` and written to
the clean branch. `git show <sha>:<path>` was used — this is
path-extraction, not `git cherry-pick`. No merge metadata, no other
commit content, no unrelated files were carried over.

| File | Source (historical) | Destination (clean) | Bytes | Notes |
| --- | --- | --- | --- | --- |
| `apps/union-eyes/lib/organizations/platform-tenant.ts` | `c40a3e33a:apps/union-eyes/lib/organizations/platform-tenant.ts` | `apps/union-eyes/lib/organizations/platform-tenant.ts` | 7364 | Byte-identical. LF line endings, no BOM. |
| `apps/union-eyes/lib/__tests__/platform-tenant.test.ts` | `c40a3e33a:apps/union-eyes/lib/__tests__/platform-tenant.test.ts` | `apps/union-eyes/lib/__tests__/platform-tenant.test.ts` | 9989 | Byte-identical. LF line endings, no BOM. |

## 2. What the reconstructed file provides

`apps/union-eyes/lib/organizations/platform-tenant.ts` is the app-layer
adapter that translates a Union Eyes `organizations.id` (UUID) into the
platform-side `orgs.id` (also UUID, per Option D same-UUID contract from
migration 0038).

### Exports

| Symbol | Purpose |
| --- | --- |
| `class PlatformTenantMappingRequired extends Error` | Fail-closed sentinel with `code = 'PLATFORM_TENANT_MAPPING_REQUIRED'` and `organizationId` payload. Thrown when a lookup finds no `platform_tenant_id` set for a given org. |
| `resolvePlatformTenantId(organizationId, tx?): Promise<string \| null>` | Read path. Returns `null` when the row does not exist or `platform_tenant_id IS NULL`. |
| `requirePlatformTenantId(organizationId, tx?): Promise<string>` | Non-nullable variant. Throws `PlatformTenantMappingRequired` on absence. This is what production route handlers MUST call. |
| `provisionPlatformParticipant({organizationId, legalName, jurisdiction, policyConfig?}, tx?): Promise<string>` | Transactional provisioner. (1) asserts the `organizations` row exists; (2) inserts `orgs` row with `id = organizationId` (idempotent via `ON CONFLICT DO NOTHING`); (3) UPDATEs `organizations.platform_tenant_id = organizationId` where currently NULL. Returns the platform tenant id. |

### DB contract enforced by the file

- `Executor` type accepts either the union-eyes Drizzle `db` handle or a
  transaction handle (`typeof db`).
- All reads target `union_eyes.organizations` (raw SQL for
  `platform_tenant_id` since the column is added by migration 0038, not
  by the Drizzle schema).
- All writes to `orgs` go via `packages/db` schema (`@nzila/db/schema`).
- The FK + CHECK on `union_eyes.organizations.platform_tenant_id` (added
  by migration 0038) makes any mismatch a database-level rejection —
  this file cannot silently produce a wrong id.

## 3. Relationship to the new `@nzila/platform-org-resolver` package (§11)

The clean branch now carries TWO layers of the resolver, deliberately:

| Layer | Package | Purpose | Callers |
| --- | --- | --- | --- |
| Type/contract | `packages/platform-org-resolver` | Branded `PlatformTenantId`, `TenantVerifier` interface, foundational-paths enum, fail-closed error classes. Pure TS, no DB. | Tooling, contract tests, any code that needs the type-safe brand. |
| DB adapter | `apps/union-eyes/lib/organizations/platform-tenant.ts` | Concrete Drizzle-based resolver + provisioner using union-eyes `db` + `@nzila/db/schema.orgs`. | Union Eyes API routes (integration is Phase 0C — see §4). |

The two layers are complementary: the DB adapter is what production code
imports; the contract package is what pure/type-only code imports. Both
enforce the same fail-closed semantics.

## 4. What was NOT reconstructed in §13 (deferred to Phase 0C)

Per [`phase-0b1/organization-resolver-integration-proof.md`](../phase-0b1/organization-resolver-integration-proof.md),
integration of the resolver into the 31 Union Eyes API route files
requires the Option-D-selected architecture (now confirmed by §2), but
wiring 31 routes without a companion test suite would inflate Phase 0B.2
scope. The baseline integration commit is authorized for Phase 0C.

Files intentionally NOT modified in §13:

- Any `apps/union-eyes/app/api/**/route.ts` — no route was rewired.
- Any `apps/union-eyes/app/api/cognition/**/route.ts` — cognition
  callers continue to use `organizationId` directly; they will migrate
  to `requirePlatformTenantId(organizationId)` in Phase 0C.
- `apps/union-eyes/app/api/admin/users/route.ts` — the highest-priority
  target from the gap analysis remains untouched.

The reconstructed resolver is thus present, test-covered, and callable —
but is NOT yet integrated. This matches Phase 0B.1's stated posture
("Retain + require companion production-integration commit") — the file
is retained; the companion integration commit is deferred to Phase 0C.

## 5. Reconstruction method (audit trail)

```powershell
# On clean branch, from repo root
git show c40a3e33a --stat # confirmed 2-file commit
git show c40a3e33a:apps/union-eyes/lib/organizations/platform-tenant.ts \
  > apps/union-eyes/lib/organizations/platform-tenant.ts
git show c40a3e33a:apps/union-eyes/lib/__tests__/platform-tenant.test.ts \
  > apps/union-eyes/lib/__tests__/platform-tenant.test.ts
```

Encoding verified post-extraction: first 4 bytes are `2f 2a 2a 0a`
(`/**\n`) — UTF-8 without BOM, LF line endings. Byte counts match the
historical file sizes (7364 and 9989).

## 6. Hard limits observed

- No commit `1e5a6bd94` content was reconstructed (test-infra sweep out of Phase 0B.2 scope).
- No commit `7a1c90ab3` content was reconstructed (docs/evidence sweep — this phase generates its own evidence).
- No `git cherry-pick` was invoked.
- No historical branch was rewritten or force-pushed.
- No `--no-verify` was used.
- No production route was modified.
- No CUPE scenario was graduated.

---

**§13 conclusion.** The resolver + provisioner code layer required by
Option D is now present on the clean branch by verifiable path-extraction
from the historical commit. Section 14 (clean-DB composition proof) can
now run the resolver's unit tests as part of the composition gauntlet.
