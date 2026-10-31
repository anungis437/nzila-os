# Gate 0 — clause tag input validation (source patch, qualification pending)

Defect: `DEF-0B4-CLAUSE-LIBRARY-BODY-FIELDS-UNVALIDATED` (existing PARTIAL). The clause tag POST and DELETE routes previously read arbitrary JSON and invoked `.trim()` on caller-controlled values. They now parse strict, typed payloads before the RLS transaction. Tag names are trimmed and bounded to the `varchar(100)` database limit; deletion identifiers must be UUIDs; legacy `tag` aliases are normalized; conflicting aliases, ambiguous deletion selectors, unknown fields, malformed bodies and wrong types are rejected.

Regression coverage: `lib/clause-library/__tests__/tag-body.test.ts` (parser) and `app/api/clause-library/[id]/tags/__tests__/route.test.ts` (rejection before database access). Existing ownership, child-row isolation and atomic audit controls remain in place.

**Evidence classification:** source change and test additions only. No test execution, native PostgreSQL 15/16 acceptance, browser/HTTP acceptance or institutional decision is claimed by this note. The frozen 777-defect register and existing cumulative accounting remain unchanged; the defect stays PARTIAL until complete source and runtime qualification.
