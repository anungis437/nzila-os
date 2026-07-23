# Phase 0B.3 — Route-Test Mock Addition Review (Adversarial Audit)

**Section:** 5
**Date:** 2026-07-23 (America/New_York)
**Subject:** `apps/union-eyes/app/api/__tests__/pilot-bootstrap-cupe.route.test.ts` — added mocks
**Commit:** `690c9cbf5` (§16 of Phase 0B.2R)

---

## 1. What changed

The unit test for `POST /api/pilot/bootstrap/cupe` (a fully mocked test
that runs on every `pnpm test:fast`) was extended to mock the two new
imports added to the route in §7:

- `@/lib/organizations/platform-tenant` → `provisionPlatformParticipant`
- `@/lib/audit/platform-audit-events` → `emitPlatformAuditEvent`

Concretely (per commit `690c9cbf5`):

- 2 hoisted mock references via `vi.hoisted(() => ({ ... }))`.
- 2 `vi.mock('@/lib/...', () => ({ ... }))` blocks.
- 2 `mockResolvedValue(undefined)` calls in `beforeEach` (default
  no-op behavior).
- **Zero** assertion changes to existing test bodies.

## 2. The concern being audited

Question: **Does mocking the resolver/audit in the unit test weaken
Phase 0B's runtime-integration proof?**

## 3. The two-test model — deliberate separation of duties

Phase 0B.2R deliberately maintains two distinct tests for the CUPE
bootstrap path:

| Test | Purpose | Runs in |
| ---- | ------- | ------- |
| `apps/union-eyes/app/api/__tests__/pilot-bootstrap-cupe.route.test.ts` | **Unit test** — proves the HTTP surface behaves correctly (validation, response shape, existing mocked collaborators) | Every `pnpm test:fast` (no DB required) |
| `apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts` | **Real-DB integration test** — proves the runtime chain resolver → PG works with `psql` witness | Opt-in via `PHASE0B2R_INTEGRATION_DB_URL` env var + explicit test invocation |

The unit test **must** mock the resolver + audit imports because:

- `test:fast` does not have a live PostgreSQL — mocking is required or
  the test would fail on missing DB.
- The unit test's contract is "does the HTTP handler wire up right?"
  — collaborator behavior is out of its scope.
- The unit test already mocks the sibling collaborators
  (`db`, `withRlsContext`, `auditLogger`, `withSystemContext`). Adding
  the two new imports simply keeps the mock set consistent.

The real-DB integration test **must** exercise the real resolver + real
audit + real PG. Its contract is "does the wiring produce a physical
row with the correct UUID and hash?" — assertions include a `psql`
witness query.

## 4. Adversarial review — the mock is not covering up a defect

### 4.1 Do the mocks silence real errors?

No. The two mocks return `undefined` (matching the real signatures'
`Promise<void>` for `provisionPlatformParticipant` and
`Promise<{id, orgId, hash}>` for `emitPlatformAuditEvent`; the latter
returns a resolved undefined in the mock because the route does not
consume the return value).

Any real error (missing tenant mapping, PG unreachable, hash mismatch)
would be surfaced by the real-DB integration test — which is the test
that owns those assertions.

### 4.2 Does the unit test still assert the correct HTTP behavior?

Yes. The existing assertions cover:

- Route accepts a valid request body.
- Response shape includes `organizationId`, `organizationName`,
  `seeded` counts, `onboarding` object, optional `demoScript`.
- `auditLogger` receives the `cupe_bootstrap_executed` event with the
  expected details.

The added mocks do not remove or alter any of these assertions.

### 4.3 Does the unit test now over-mock (moving assertions away from
the runtime)?

No. Before §7, the route did not call `provisionPlatformParticipant`
or `emitPlatformAuditEvent`. The route now does. To keep the unit test
runnable on `test:fast`, the mocks are required. This is a symmetric,
minimal change: each new production dependency of the route earns one
mock declaration.

## 5. Regression tests

Fresh re-run on 2026-07-23:

- `apps/union-eyes/app/api/__tests__/pilot-bootstrap-cupe.route.test.ts` — passed (part of the 46/46 decisive suite; see §11 validation).
- `apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts` — 2/2 passed with `PHASE0B2R_INTEGRATION_DB_URL` set.

Both tests pass. The mock addition to the unit test does not weaken
the integration test's real-DB proof.

## 6. Verdict

The route-test mock addition is:

- **Symmetric** (one mock per new production import).
- **Necessary** (unit test cannot depend on live PG).
- **Non-invasive** (zero assertion changes).
- **Complemented** (real behavior is asserted by the sibling real-DB
  integration test).

The unit-test mock addition does **not** weaken Phase 0B's
runtime-integration proof. The two tests together correctly separate
"HTTP wiring" (unit) from "resolver→PG behavior" (integration).

## 7. Cross-references

- Unit test: [`apps/union-eyes/app/api/__tests__/pilot-bootstrap-cupe.route.test.ts`](../../../../apps/union-eyes/app/api/__tests__/pilot-bootstrap-cupe.route.test.ts)
- Integration test: [`apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts`](../../../../apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts)
- Route source: [`apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts`](../../../../apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts)
- Runtime callsite proof: [phase-0b3-runtime-callsite-proof.md](phase-0b3-runtime-callsite-proof.md)
- INV-06 exemption review: [phase-0b3-inv06-exemption-review.md](phase-0b3-inv06-exemption-review.md)
