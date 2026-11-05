# Gate 0 — workspace telemetry abuse-control source patch

Defect: `DEF-0B12-PLT-WORKSPACE-TELEMETRY-LOGS-UNBOUNDED-CLIENT-STRINGS-AND-HAS-NO-LIMIT` (previously PARTIAL).

The telemetry POST now requires an authenticated user and organization, checks a distributed Redis-backed 120-events-per-minute per-organization/per-user limit before reading or logging a payload, responds 429 on quota exhaustion and 503 when the limiter is unavailable, and never records an event on those refusal paths. The existing streaming 2,048-byte limit and canonical payload projection remain unchanged.

Regression coverage is extended in `app/api/__tests__/workspace-telemetry.route.test.ts` for scoped limiter keys, 429 refusal, Redis failure and timeout. This patch is source-only: tests, exact-HEAD CI, native PostgreSQL and HTTP/browser acceptance have not been executed or independently ratified here. Do not mark CLOSED or increase the implemented total until qualified. Frozen Gate 0 evidence and the 777-defect population remain unchanged.
