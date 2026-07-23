# Phase 0C — Baseline (Unmodified) Evidence — `PRE_FIX_INFRASTRUCTURE_SAMPLE`

> **Classification per Phase 0C.1 §3:** `PRE_FIX_INFRASTRUCTURE_SAMPLE`. Not a
> completed baseline. Sufficient to establish the untouched harness is
> infrastructure-blocked; insufficient to classify the 167 tests never executed
> nor to prove absence of product defects, fixture defects, or flake. The
> authoritative baseline is produced by Phase 0C.1 §14 after §4–§13 land.

**Command executed:**
```
PLAYWRIGHT_TEST_AUTH=true QA_TEST_ENV=true DATABASE_URL=postgresql://nzila:nzila_dev@localhost:5433/nzila_automation \
NODE_ENV=test PLAYWRIGHT_BASE_URL=http://localhost:3002 AUTH_SECRET=test-auth-secret \
VOTING_SECRET=test-voting-secret-0123456789abcdef UE_E2E_RISK_BYPASS=true \
pnpm --filter @nzila/union-eyes exec playwright test \
  --reporter=line,html,json \
  --output=reports/audits/cupe-national-phase-0/phase-0c/baseline-artifacts \
  | Tee-Object -FilePath reports/audits/cupe-national-phase-0/phase-0c/phase-0c-baseline-unmodified-run.log
```

**Modifications applied before run:** NONE. This is the baseline as of commit `eadf413cc` (Phase 0C §1–§5 evidence).

**Sampling policy (per `phase-0c-closure.md`):** The full 192-test run was terminated at
approximately test 23/192 after all observed failures collapsed to the same three
identical failure signatures. Rationale: further wall-clock burn consumes tool budget
without adding evidence. The sampled slice covered all six auth roles, `/dashboard`,
mobile navigation, and cross-role blocked routes.

## Observed failure signatures

### Signature A — Auth-required page fails to redirect from `/dashboard` to role landing

**Symptom:**
```
Error: expect(page).toHaveURL(expected) failed
  Expected pattern: /\/en-CA\/dashboard\/admin\/organizations(?:$|[/?#])/
  Received string:  "http://localhost:3002/en-CA/dashboard"
  Timeout: 5000ms
```

**Location:** `e2e/helpers/auth.ts:77` (`gotoDashboardAsRole` → `expect(page).toHaveURL(...)`)

**Observed for:** member, steward, staff, admin, executive, governance (every role tested)

**Test-count example (from log):** tests 1, 3, 5, 7, 9, 11 all fail with this identical
signature (only the role-specific landing regex differs).

**Root cause:** FR-01 in `phase-0c-failure-resolution-register.md` — seed not run →
no `auth_users` / `organization_members` → cookie-mode auth (`nzila_session=ue-seed-session-{userId}`) accepted but user has no membership → `/dashboard` shell renders but never redirects.

### Signature B — Sidebar navigation not visible after landing

**Symptom:**
```
Error: expect(locator).toBeVisible() failed
  Locator: locator('aside nav').first()
  Expected: visible
  Timeout: 5000ms
  Error: element(s) not found
```

**Location:** `e2e/helpers/navigation-assertions.ts:9` (`assertVisibleNavLabels`)

**Observed for:** member, steward, staff, admin, executive, governance mobile-landing variants

**Test-count example (from log):** tests 2, 4, 6, 8, 10, 12 all fail with this identical
signature.

**Root cause:** FR-01 (same as A) — no membership means no role-specific sidebar renders.

### Signature C — Cross-role blocked route may inconsistently succeed/fail

**Symptom (best-case):** Test passes because the requested `/dashboard/**` route is
correctly blocked (302, 403, or "not authorized" render).
**Symptom (worst-case, not observed in sample):** would fail if the blocked-page
detection is fooled by the same "landing shell without content" that FR-01 produces.

**Test-count example (from log):** tests 13–23 progressing rapidly without new failure
attachments — suggests cross-role blocks are correctly enforced even without seed
(because the auth boundary is enforced BEFORE role resolution).

## Server boot warnings (captured at webServer start)

- `Missing critical database tables` — indicates schema drift or missing seed tables the
  runtime probe expects.
- `NEXT_PUBLIC_APP_URL: Required` — env var not exported by `playwright.config.ts webServer.env`.
- `runtime-fail-closed` cataloged missing secrets: `auth.django.secret`, `crypto.fallback`,
  `auth.webhook.secret`, `crypto.pii`, `identity.entra.*`, `lineage.*`, `NZILA_MODE`.

All three warnings are cataloged as FR-02 / FR-03 in
`phase-0c-failure-resolution-register.md`.

## Public / no-auth tests

The sampled slice did NOT reach the public/no-auth tests (`smoke.spec.ts`,
`governance/deployment-legitimacy-visibility.spec.ts`, `ocra §1/§2`). Their expected
behavior under seed-less conditions is:

- **Public** tests SHOULD pass — no seed dependency.
- **OCRA §1/§2** tests SHOULD pass — no auth dependency (adaptive-flow §1/§2 traverse public routes).
- **Governance visibility** SHOULD pass — reads static content.

However, they may still fail on server-boot warnings (FR-02) if the boot-time env
validation kills the request early. This will be verified in §17 (Phase 0D) after
lifecycle scaffolding is in place.

## Artifacts

- Log file: `phase-0c-baseline-unmodified-run.log` (async terminal captured via Tee-Object)
- HTML reporter: `baseline-artifacts/html-report/` (Playwright default output — may be
  incomplete since run was terminated)
- JSON reporter: `baseline-artifacts/results.json` (may be missing if run terminated
  before finalization)
- Test-results directory: `apps/union-eyes/test-results/` (per-test video/screenshot/error-context)

## Delta from Phase 0B baseline

Phase 0B baseline (commit `11ac20821`) did NOT run the Union Eyes E2E suite as part
of its acceptance criteria — Phase 0B focused on migration lineage + tooling gates.
No prior "how many tests pass" figure exists. Historical claims of "116/24/10/42"
mentioned in earlier planning docs are NOT reproducible from `main` and are treated
as unverified per Phase 0C policy.

**Effective baseline:** With ZERO modifications, the Union Eyes E2E suite is
non-executable in a meaningful sense — every auth-required test fails at the seed
gap. This establishes the FLOOR the deterministic lifecycle must lift.
