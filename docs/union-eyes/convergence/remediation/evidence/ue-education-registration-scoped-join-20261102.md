# Registration-scoped virtual education join: engineering evidence (2026-11-02)

Baseline: `ab0042ef930f7a49ba3bef7b3bddb07071409a98`. Branch: `agents/ue-cursor-final-closure`.

The member-wide education session catalogue now redacts URLs, access codes, hotels, notes and finance. This new route restores legitimate member attendance without reintroducing broad credential disclosure.

`GET /api/education/registrations/join?sessionId=<UUID>` uses an authenticated tenant context, exact member identity, matching session/course/organization foreign keys, registered and uncancelled status, approval where required, scheduled session status, inclusive UTC session dates and HTTPS URL validation. The only response fields are sessionId, joinUrl and accessCode. A durable audit records the registrant and session identifiers in the same RLS transaction before the secret response; no URL or code is logged. Missing, foreign, unapproved and inactive requests fail with uniform 404.

Regression source: `apps/union-eyes/app/api/education/registrations/join/__tests__/route.test.ts`. Adversarial checks cover role, tenant, foreign keys, approval, cancellation, time, unsafe URL, minimal response and audit failure.

This is source-level implementation, **not independently qualified**. Exact-HEAD complete Vitest/contract, native PG15/16, HTTP/browser and staging verification are required. UTC session-date availability is a conservative engineering default pending institutional policy ratification. No defect completion or CLOSED credit; the frozen 777-defect register is unchanged.
