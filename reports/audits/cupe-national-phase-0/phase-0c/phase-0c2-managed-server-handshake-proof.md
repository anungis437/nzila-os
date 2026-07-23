# Phase 0C.2 §5 — Managed-server handshake proof

**Section:** Phase 0C.2 §5 — Managed-server handshake  
**Status:** GREEN  
**Verdict:** Playwright cannot attach to any Next.js server other than the
one the current governed lifecycle run just booted. Every reachable
failure mode is exercised by unit tests.

## Threat modelled

Before §5 the governed lifecycle would:

1. Boot a Next.js dev server on port 3002 with `bootServer(...)`.
2. Poll `/api/health/readiness` until 200.
3. Spawn Playwright, trusting that whatever answered on port 3002 was
   the server we just booted.

Failure modes that step (3) did NOT catch:

- A stale dev server left running from a previous lifecycle run —
  bound to the SAME port but pointing at the developer database or an
  unrelated seed. Readiness would return 200 (it's a healthy server),
  the tests would run, and the entire result would be garbage.
- An unrelated developer terminal running `pnpm dev` in a different
  worktree happens to have won the port race. Same outcome.
- `playwright.config.ts` silently spawning its own `webServer` because
  the gate only checked `process.env.CI` (not the managed-server flag),
  which would spin up a competing dev server on port 3002 in parallel
  with the orchestrator's — indeterminate which one Playwright hits.

## Fix (three components)

### 1. Positive handshake helper — pure, injectable

New file: `apps/union-eyes/scripts/lifecycle/managed-server-handshake.ts`

- Exports the frozen env-var and path constants
  (`NZILA_E2E_MANAGED_SERVER`, `NZILA_E2E_RUN_ID`,
  `/api/health/managed-server`, `union-eyes`).
- `isManagedServerMode(env)` returns `true` iff the env var is
  EXACTLY the string `"true"`. Truthy-looking values (`"1"`, `"TRUE"`,
  `"yes"`, `"on"`, empty string) all return `false` — fail-closed.
- `isLoopbackUrl(url)` — accepts `localhost`, `127.0.0.1`, `::1`, `[::1]`,
  `0.0.0.0`; rejects any real hostname and any unparseable string.
- `verifyManagedServer({ baseUrl, expectedRunId, fetch?, timeoutMs? })`
  performs a fetch-based positive handshake and returns
  `{ ok, reason?, error?, status?, actualRunId?, actualApp? }`. All eight
  gates below MUST pass — otherwise `ok: false` with a
  machine-parseable `reason`:

  1. `non-loopback-base-url` — refuses baseUrls that don't parse as
     loopback. Fails BEFORE any fetch call.
  2. `empty-expected-run-id` — refuses empty/missing runId. Fails
     BEFORE any fetch call.
  3. `fetch-failed` — `fetch` itself threw (ECONNREFUSED, etc).
  4. `timeout` — `AbortController` fired before the response arrived.
  5. `non-200-status` — endpoint responded with anything other than 200
     (covers 404 = endpoint not present because the flag wasn't set on
     the target server).
  6. `non-json-body` — response body did not parse as JSON.
  7. `bad-payload-shape` — required fields (`app`, `managedServer`,
     `runId`, `pid`, `uptimeSec`) missing or wrong primitive type.
  8. `app-mismatch` — response reports a different app name (defence
     against an unrelated Next.js app squatting on the same port).
  9. `run-id-mismatch` — response reports a different runId (defence
     against a stale server from a previous lifecycle run).

### 2. Server-side echo endpoint

New file: `apps/union-eyes/app/api/health/managed-server/route.ts`

- If `process.env.NZILA_E2E_MANAGED_SERVER !== 'true'` → returns 404.
  This means production and staging Next.js processes DO NOT ADVERTISE
  this endpoint at all — an attacker probing the route sees a normal
  "not found" response, indistinguishable from any other missing route.
- If the flag is on but `NZILA_E2E_RUN_ID` is missing/empty → returns
  500 with an explicit "orchestrator misconfiguration" error (this is
  observable only in test environments where the flag is on).
- Otherwise returns 200 with
  `{ app: 'union-eyes', managedServer: true, runId, pid, uptimeSec }`
  and `Cache-Control: no-cache, no-store, must-revalidate`.

Response body deliberately contains NO secrets, NO DB URLs, NO cookies,
NO tokens — only the process metadata needed for handshake matching.

### 3. Config gate and orchestrator wiring

- `apps/union-eyes/playwright.config.ts` — the `webServer` block is now
  gated on `CI || NZILA_E2E_MANAGED_SERVER === 'true'`. Previously only
  `CI` was checked, which meant governed local runs would spawn a
  rogue second dev server on port 3002.
- `apps/union-eyes/scripts/lifecycle/run.ts`:
  - Step 8 (boot-server) now sets `NZILA_E2E_MANAGED_SERVER=true` and
    `NZILA_E2E_RUN_ID=<alloc.runId>` in the Next.js child process env.
  - Step 8 now performs `verifyManagedServer(...)` after `pollReadiness`
    passes. If the handshake fails for ANY reason the step throws
    (aborting the run) BEFORE step 9 (auth-state generation) or step
    10 (Playwright) execute. The failure detail includes `reason`,
    `error`, `actualRunId`, and `actualApp` for post-mortem.
  - Step 10 (playwright) now also sets `NZILA_E2E_MANAGED_SERVER=true`
    and `NZILA_E2E_RUN_ID=<alloc.runId>` in the Playwright child
    process env, so the config's gate resolves correctly and any
    downstream helper can consult the runId.

## Fail-closed refusal matrix

The `verifyManagedServer` helper was tested against every combination
below. In every failing row the orchestrator aborts BEFORE Playwright
starts.

| # | Scenario | Handshake input | Expected reason |
|---|----------|-----------------|-----------------|
| 1 | Non-loopback baseUrl | baseUrl points at a real hostname | `non-loopback-base-url` (no fetch call) |
| 2 | Empty expected runId | expectedRunId = `""` | `empty-expected-run-id` (no fetch call) |
| 3 | Server unreachable | fetch throws ECONNREFUSED | `fetch-failed` |
| 4 | Slow / hung server | fetch never resolves | `timeout` (AbortController) |
| 5 | Endpoint missing | server returns 404 | `non-200-status` |
| 6 | Server errored | server returns 500 | `non-200-status` |
| 7 | Non-JSON body | response body is plain text | `non-json-body` |
| 8 | Missing runId in payload | JSON body lacks runId | `bad-payload-shape` |
| 9 | Missing managedServer flag | JSON body lacks managedServer | `bad-payload-shape` |
| 10 | Wrong app name | body.app = `"some-other-app"` | `app-mismatch` |
| 11 | Stale runId | body.runId ≠ expected | `run-id-mismatch` |
| 12 | Matching runId & app | body.runId = expected, body.app = union-eyes | `ok` (only ok row) |

Additionally the frozen-constants and `isManagedServerMode` /
`isLoopbackUrl` / `isManagedServerHandshakePayload` predicates are
covered by their own describe blocks.

## Test evidence

- File: `apps/union-eyes/scripts/lifecycle/managed-server-handshake.test.ts`
- Suites: 6 (`env-var contract`, `isManagedServerMode`, `isLoopbackUrl`,
  `isManagedServerHandshakePayload`, `verifyManagedServer: baseUrl /
  expectedRunId guards`, `verifyManagedServer: happy path`,
  `verifyManagedServer: server failure modes`)
- Tests: **30 / 30 passing** (see companion `.log`)
- Runtime: 73 ms
- Vitest: v4.1.2

## Files changed

| Path | Kind |
|------|------|
| `apps/union-eyes/scripts/lifecycle/managed-server-handshake.ts` | NEW — pure helpers |
| `apps/union-eyes/app/api/health/managed-server/route.ts` | NEW — server-side echo endpoint |
| `apps/union-eyes/scripts/lifecycle/managed-server-handshake.test.ts` | NEW — 30 tests |
| `apps/union-eyes/playwright.config.ts` | MODIFIED — webServer gate now includes managed-server flag |
| `apps/union-eyes/scripts/lifecycle/run.ts` | MODIFIED — inject env vars in step 8 and step 10; verify handshake in step 8 |
| `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-managed-server-handshake-proof.md` | NEW — this document |
| `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-managed-server-handshake-proof.json` | NEW — structured evidence |

## Non-negotiables observed

- Handshake helper does NOT call `process.env` — all env access happens
  in `run.ts` and in the route handler; the helper is pure and
  test-injectable.
- Handshake helper does NOT retry — a single failure aborts the run
  (no "eventually consistent" bypass).
- Endpoint returns 404 (not 200 or 500) when the managed-server flag is
  off — production servers do not advertise the endpoint.
- Response body contains NO secrets, cookies, tokens, or DB URLs.
- Handshake refuses non-loopback baseUrls WITHOUT ever calling fetch
  (defence in depth against config errors that would otherwise leak
  the runId to an unrelated host).
- Playwright config now refuses to spawn its own `webServer` whenever
  the managed-server flag is on — the orchestrator is the single
  authority.
