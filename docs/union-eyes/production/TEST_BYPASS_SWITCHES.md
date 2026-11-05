# Union Eyes — test-authentication and risk-bypass switches

Product-owner directive 2026-11-04, item 4: test-authentication and risk-bypass settings are
prohibited in Union Eyes staging and production. The old staging Container App
`nzila-os-union-eyes-staging` carried `PLAYWRIGHT_TEST_AUTH`, `UE_E2E_RISK_BYPASS` and
`UNION_EYES_ACCEPTANCE_AUTH_ENABLED` (names observed read-only; values never read).

This page lists every such switch found in `apps/union-eyes` and the shared packages it uses, and
describes how they are now refused. It does not claim any deployed environment is clean: that is
shown only by a deployed revision's `/api/ready` response.

## 1. Inventory

Search scope: `apps/union-eyes/**` and `packages/**` for `process.env.*` names containing
`BYPASS`, `TEST_AUTH`, `ACCEPTANCE`, `E2E`, `MOCK`, `SKIP`, `FAKE`, `PLAYWRIGHT`, `STUB`,
`DISABLE_AUTH`, `INSECURE`, plus `QA_TEST_ENV` and `NODE_ENV` test branches in auth and risk code.

| Switch                               | Read in                                                                                                                                                     | What it unlocks                                                                                                                                                                                                                                                                                         | Guarded |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `PLAYWRIGHT_TEST_AUTH`               | `packages/platform-auth/src/password/auth-service.ts`, `packages/platform-auth/src/entra/server.ts`, `apps/union-eyes/next.config.ts`                       | Password login skips risk scoring and MFA step-up when the user agent contains `playwright-e2e-auth`. With `QA_TEST_ENV` (and `UE_ENVIRONMENT=local`, `UE_CANONICAL_BOOTSTRAP_V2=0`, no auth database URLs) it enables `ue-seed-session-ue-qa-*` fake session tokens. At build time it drops HSTS and CSP `upgrade-insecure-requests`. | Yes     |
| `UE_E2E_RISK_BYPASS`                 | `packages/platform-auth/src/risk/assess.ts`                                                                                                                 | `assessRisk()` returns score 0 / `allow` for every login: no failed-login, new-IP or privileged-role signals, so no risk-driven MFA step-up or soft lockout.                                                                                                                                              | Yes     |
| `UNION_EYES_ACCEPTANCE_AUTH_ENABLED` | `packages/platform-auth/src/acceptance-auth.ts`, used by `auth()` / `currentUser()` in `packages/platform-auth/src/entra/server.ts`                          | When `UE_ENVIRONMENT` and `UE_DEPLOYMENT_TYPE` are both `staging`, a signed token in the `x-unioneyes-acceptance-auth` header or `ue_acceptance_auth` cookie is accepted as an identity without Entra or a password session. Companion settings: `UNION_EYES_ACCEPTANCE_AUTH_SECRET`, `UNION_EYES_ACCEPTANCE_AUTH_USER_IDS`. | Yes     |
| `QA_TEST_ENV`                        | `packages/platform-auth/src/password/handlers.ts`, `apps/union-eyes/app/api/workflow/transition/route.ts`, `apps/union-eyes/app/api/feature-flags/route.ts`, `apps/union-eyes/next.config.ts`, `packages/platform-auth/src/entra/server.ts` | Login and workflow-transition 500 responses include error detail and stack traces; `/api/feature-flags?flag=pilot-mode` reports enabled; build drops HSTS and CSP `upgrade-insecure-requests`; second half of the fake-session condition above.                                                         | Yes     |

Related settings reviewed and not added to the guard:

| Setting                                                       | Why not guarded                                                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORA_ACCEPTANCE_AUTH_ENABLED` (`cora-acceptance-auth.ts`)    | Exported by `@nzila/platform-auth` for the CORA product; no Union Eyes code path calls it.                                                                                             |
| `SKIP_DB_STARTUP_CHECK` (`instrumentation.ts`)                | Skips a startup diagnostic only; `/api/ready` still checks the database. No authentication or risk effect.                                                                            |
| `QA_TEST_ENV_ALLOW_PROD_URL`, `ALLOW_PRODUCTION_SEED`         | Read by operator scripts (`scripts/seed-test-env.ts`, `lib/runtime/production-guard.ts`), not by the server.                                                                           |
| `NODE_ENV !== 'production'` error-detail branches             | Off in every production build; deployed images always build with `NODE_ENV=production`.                                                                                             |

## 2. Runtime guard

`apps/union-eyes/lib/reality/test-bypass-guard.ts` decides whether the runtime is deployed and
whether any switch is set. A switch counts as set when it has any non-empty value, including
`false`: deployed environments must not carry the setting at all.

The environment is classified from `UE_ENVIRONMENT`, `UE_DEPLOYMENT_TYPE`, `NEXT_PUBLIC_APP_ENV`,
`TARGET_ENVIRONMENT`, `NZILA_MODE`, `NZILA_DEPLOYMENT_TYPE` and `DEPLOYMENT_ENVIRONMENT`, using
`@nzila/reality-env`. Only `local`, `development` and `test` may carry a switch. Any other value
(`staging`, `production`, `prod`, `pilot`, `demo`, or unrecognised) is deployed, and one deployed
marker is enough. With no marker set, `NODE_ENV=test` or `development` is local and anything else is
deployed.

| Enforcement point            | Behaviour when a switch is set in a deployed environment                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `instrumentation.ts` (boot)  | Logs `[test-bypass-guard] REFUSED (UE_TEST_BYPASS_IN_DEPLOYED_ENVIRONMENT)` with switch names, exits with code 1.                  |
| `proxy.ts` (every request)   | HTTP 503 `{ reasonCode: "UE_TEST_BYPASS_IN_DEPLOYED_ENVIRONMENT", switchesPresent: [...] }`, except `/api/ready`.                  |
| `/api/ready`                 | HTTP 503, `ready: false`, `checks.noTestBypass: "fail"`, `reasonCodes: ["UE_TEST_BYPASS_IN_DEPLOYED_ENVIRONMENT"]`.                |

Values are never logged or returned, only names.

`isAcceptanceAuthRuntimeEnabled()` in `@nzila/platform-auth` still enables acceptance auth in
staging by its own rules. The app-level guard overrides it for Union Eyes: the process will not boot,
and no request reaches `auth()`, while the switch is set. Removing the acceptance-auth path from the
shared package is a separate maintainer decision.

## 3. Static guard

`apps/union-eyes/lib/reality/__tests__/infra-test-bypass-settings.test.ts` scans
`infrastructure/bicep/**` and `.github/workflows/**` and fails on any mention of a switch outside
these allow-listed jobs:

| Workflow job                         | Reason                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/e2e.yml#e2e`           | Playwright against the standalone server on the runner (`localhost`) and a throwaway `ci_e2e` Postgres container, `UE_ENVIRONMENT=local`. |
| `.github/workflows/e2e.yml#e2e-canonical` | Same, with a verified staging snapshot restored into the runner-local container (Azure login only downloads that snapshot blob). |

The test also fails if an allow-listed job runs `az containerapp`, `az deployment`, `az webapp`,
`azure/arm-deploy` or `azure/container-apps-deploy-action`, or sets `PLAYWRIGHT_TEST_AUTH` / `UE_E2E_RISK_BYPASS` without
`UE_ENVIRONMENT: local`, and if an allow-list entry stops being used.

When this guard was added, `.github/workflows/deploy-union-eyes.yml` set `UE_E2E_RISK_BYPASS=true` on
the Container App whenever a demo profile was deployed. That line was removed.

## 4. Operator note

Removing these variables from an existing Container App is an Azure change and is not done by this
code. A revision that still carries one will not boot once this code is deployed.
