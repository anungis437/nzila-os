# Union Eyes Gate 0 — CMS audience and inactive-course read boundaries (2026-11-02)

**Source baseline:** `1fb1e108ee34e75ecb439abdf4082926dd737975`  
**Source correction:** `9aef80acde8f57b5e338a67366c9336c31dfd4d0`  
**Status:** SOURCE_CHANGED_TESTS_AUTHORED_NOT_QUALIFIED; **NO_GO**.  
**Defect/CLOSED credit:** 0. Frozen classification and 150-item index unchanged.

## Provenance and repairs

- `DEF-0B6-EDU-CONTENT-DRAFTS-AND-ARCHIVED-READABLE-BY-MEMBER`: `GET /api/content/templates` formerly returned all CMS statuses to every tenant member, including draft/review/archived records, author identifiers and content URLs, and ignored `cms_pages.allowed_roles`. The member read now requires a resolved tenant role, selects only published items, applies the PostgreSQL text-array audience restriction (null/empty means unrestricted), and omits author identifiers. The existing content-manager and administrator editorial journey retains drafts, review and archives.
- `DEF-0B6-EDU-CONTENT-LISTS-UNBOUNDED-OR-UNVALIDATED` (related read boundary): `GET /api/content/training?active=false` previously allowed any member to enumerate inactive/retired courses. Inactive-course reads now require the established content-manager or administrator role floor; members receive only active courses even if they supply `active=false`. Existing bounded list pagination and completed-not-attended counts remain intact.

**Files:** `apps/union-eyes/app/api/content/templates/route.ts`, `apps/union-eyes/app/api/content/training/route.ts`, `apps/union-eyes/app/api/content/__tests__/content-catalogue-audience.test.ts`.

**Adversarial tests authored:** ordinary member SQL restricts status and audience, no member author projection, editor sees draft records, unresolved reader role refuses before SQL, member `active=false` cannot bypass active filter, editor may intentionally list inactive courses. Tests use mocked route/SQL execution; they do not constitute real RLS or native PG15/16 acceptance.

## Remaining qualification and authority

Exact-final-HEAD complete Vitest/contract, native PostgreSQL 15/16 (with deployed schema and RLS), real HTTP/browser/staging and cross-tenant persona acceptance remain required. Institutional content-publication policy, allowed-role audience semantics, independent reviewer, owner-persona ratification and institutional authority must be reviewed; no agent ratification is claimed. No change was made to the 777-defect frozen register or any independent release decision.
