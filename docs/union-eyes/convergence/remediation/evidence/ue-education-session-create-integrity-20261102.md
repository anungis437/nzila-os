# Union Eyes — education session creation integrity (2026-11-02)

## Scope and provenance
- Repository: `anungis437/nzila-os`; branch: `agents/ue-cursor-final-closure`.
- Frozen register remains authoritative: `ue-route-classification-0b1.json` through `0b12.json`, and `0c1.json` (777 original defects). This supplemental repair relates to the 0B6 education session/registration integrity family. It does not reclassify or close any original defect.
- Source implementation: `apps/union-eyes/app/api/education/sessions/route.ts`.
- Adversarial regression source: `apps/union-eyes/app/api/education/sessions/__tests__/session-create-integrity.test.ts`.
- Implementation commits: `a4407cda5259d4831b48a60a344fe97ecc511886`, `c7642d4581d02553d72eb927dfabec2ccdc05e0f`; test commits: `1bab9ddb851da8eab8f585e17244aa18c52e285c`, `0ee9c954975a4d6c974836c1233b2ebc05b133fa`.

## Permanent source correction
Previously the steward's course-session creation route delegated to the generic CRUD insert after checking only the referenced course's organization. It did not reject invalid or reversed dates, registration windows extending beyond a session, zero/negative/fractional capacity, or unsafe meeting URLs before SQL. The route now validates strict ISO calendar dates (including leap-year correctness), chronological session and registration boundaries, bounded positive integer capacity when specified, required bounded code/method, bounded access codes and HTTPS-only joining links without embedded URL credentials. An absent organization fails before the course lookup. The existing tenant-owned course check and server-owned counters, lifecycle, budget and cost fields remain intact.

## Regression design and qualification boundaries
The authored route-level adversarial test exercises valid and invalid date values, reversed windows, null optional values, leap days, capacity bounds, unsafe URLs, required fields and the tenant lookup boundary. These are mocked route tests; their existence is not a test pass, a native PostgreSQL 15/16 proof, an HTTP/browser proof, or staging acceptance.

Source readback was completed after the date-regex escaping correction. **Exact-HEAD CI, complete Vitest/contract, native PG15/16, disposable HTTP/browser and staging qualification are not attested by this document.** Inspect the workflow results for the final branch HEAD and record each independently before granting verification credit. No payment, credential issuance or institutional approval authority is created.

## Open obligations
- Prove the new create-path behavior with the real combined schema and runtime RLS role on PG15 and PG16, including a foreign-course denial and a legitimate session insert.
- Prove actual authenticated HTTP and browser behavior for staff creation and member enrolment/joining; inspect the full 111-capability and member/steward/officer/financial/WorkAid journey matrix.
- Complete independent reviewer, owner-persona and institutional authority decisions required by Gate 0C.4.
- **Defect credit: 0; CLOSED credit: 0; overall GO: NO.**
