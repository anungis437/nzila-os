# Union Eyes Gate 0 — clause-library read-family tenant transaction closure

**Disposition:** source corrections and adversarial tests authored; not independently qualified, not CLOSED, no defect-credit change.
**Frozen provenance:** all 777 recorded Gate 0 defects and 111 capabilities remain unchanged. Existing mapped family includes `DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS` and clause visibility/authority classifications.

## Root-cause sweep

The clause-sharing GET was corrected in `9b55a6d1c3a810d1127189514c9ee7f412d683a2`. A follow-up inspection of adjacent routes identified four more reads that entered `withRLSContext({ organizationId })` but still queried through the imported module-level `db`, which does not inherit the callback's tenant transaction:

1. `GET /api/clause-library/[id]`: both the clause and its tags.
2. `GET /api/clause-library/[id]/tags`: both the parent clause and the tag collection.
3. `GET/POST /api/clause-library/search`: the search result query.
4. `GET /api/clause-library`: both the paginated result and count queries.

These were source-level RLS-context escapes. Application-level visibility predicates were not sufficient evidence of tenant database isolation, especially where clause sharing spans organizations.

## Permanent source changes

Commits `b5cce051d5fbeace592b44b18735ab578a5b91fa`, `6213ebd471752f3fd243588c871bf9f655066b86`, `0084f1a5eef152a798efb9c5eda06697e0764271`, `20432a7f8f532a53d680c8fa760bf753781d1273` replace each module-level SELECT with the transaction handle supplied by `withRLSContext`. Clause and tag helper functions now require an explicit database executor rather than silently defaulting to the unscoped handle. The route-level role floor, ownership checks, sharing predicates, privacy projection, pagination, search functionality and write paths remain intact. Federation/congress sharing stays unavailable to non-owners until a safe institutional implementation is approved; no SECURITY DEFINER privilege gate was bypassed.

Commit `f7f7ee88184f6077db50593a5722a30316d01630` extends the adversarial route regression with separate assertions for clause detail, tag read, search, paginated collection/count and tenantless refusal. The test database mock distinguishes unscoped reads from the tenant transaction, so a regression to module-level `db.select()` is observable.

## Verification

**Source-level:** all five route source files and the regression file were committed; source readback and branch SHA confirmation remain the scope of engineering inspection.

**Unit/contract:** exact-head full Vitest/contract and focused test execution are not yet established. The previous baseline `f902f8b705fe0b230d45088bc4a6c306ee2ff945` had 23,779 passing, 1 failing and 28 skipped application tests. That prior result is not credited to this batch.

**Native:** real PostgreSQL 15/16 adversarial tenant qualification for these exact GET/POST reads remains pending. Prior native success at `f902f8b705fe0b230d45088bc4a6c306ee2ff945` is not exact-head evidence.

**Runtime:** production-build HTTP/browser, staging and independent reviewer qualification are outstanding at this source revision.

**Institutional:** owner-persona ratification, independent review and institutional authority decisions under Gate 0C.4 remain outstanding. No PR merge or production promotion is authorized by this source change.

## Required acceptance

Run complete app/contract suites, native PG15/16 with distinct owner/non-owner/shared-clause principals, HTTP/browser tests for each route and count consistency, then independent acceptance. Preserve original frozen register and cumulative evidence. No implemented/CLOSED credit is awarded solely for this batch.
