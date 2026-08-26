# CUPE National Audit Evidence Register

## Repository and execution evidence

| ID | Type | Exact evidence | Finding / limitation |
|---|---|---|---|
| ENV-01 | Git | branch `fix/union-eyes-reality-remediation`; commit `099af64e3d3ccb0a610dd4180069649d39cc40e9` | Audit is against committed code plus dirty working tree. |
| ENV-02 | Working tree | `git status --short` recorded modified `docs/**`, `ops/outputs/**`, `reports/**` and untracked institutional docs/reports | Do not claim pristine reproduction. This audit modified only `reports/audits/cupe-national-*`. |
| ENV-03 | Toolchain | root `package.json` declares `pnpm@10.33.0`; app package declares Next/Vitest/Playwright scripts | pnpm is authoritative package manager. |
| MAP-01 | Surface inventory | `reports/union-eyes-capability-inventory.json` | 1,714 discovered surfaces: 931 API routes, 347 pages, 284 schemas, 127 services, 12 actions, 13 cron routes. Registry covers 7; 1,707 missing. |
| MAP-02 | Entry points | `apps/union-eyes/app/**`, `apps/union-eyes/package.json`, `apps/union-eyes/playwright.config.ts`, `apps/union-eyes/vitest.config.ts` | Next.js application with locale, marketing, operational and API surfaces; tests configured but broad runtime coverage is not inferred. |
| AUTH-01 | Auth | `apps/union-eyes/lib/api-auth-guard.ts` | Imports platform auth, resolves organization ID using `getOrganizationIdForUser`, exposes server auth wrappers and extensive role hierarchy. |
| AUTH-02 | RBAC verification | `apps/union-eyes/tests/api/rbac.spec.ts`; `_qa-route-inventory.ts` | Critical pilot routes assert wrappers, org scope and explicit personas; inventory is deliberately finite. |
| AUTH-03 | Cross-org test | `apps/union-eyes/tests/e2e/org-isolation-negative.spec.ts` | Wrong-org seeded persona attempts claim, evidence, export, search, metrics, audit, workbench and workflow mutation. Passing execution is required before treating this as runtime proof. |
| DATA-01 | Schema | `apps/union-eyes/db/schema/index.ts` | Domains include claims, governance, communications, documents, data, AI and infrastructure; schema is not workflow proof. |
| DATA-02 | Structure schema | `apps/union-eyes/db/schema/union-structure-schema.ts` | Employers, worksites, bargaining units, committees and steward assignments are organization-linked. No National hierarchy workflow was traced. |
| CASE-01 | Pilot workflow | `apps/union-eyes/app/api/cases/[caseId]/transition/route.ts`; `[caseId]/assign/route.ts`; `[caseId]/export/route.ts`; `tests/e2e/member-intake.spec.ts`; `tests/e2e/case-resolution.spec.ts` | Selected pilot case workflow exists. These paths do not establish appeals/transfer/joint ownership. |
| DOC-01 | Attachment/evidence | `docs/categories/products-and-market/pilot/cupe/CUPE_READINESS_CHECKLIST.md`; evidence tests/routes | Checklist claims scoped storage, type/size checks, signed URLs, audit and malware state; audit treats checklist claims as requiring executable validation. |
| I18N-01 | Localization | `apps/union-eyes/i18n.ts`, `messages/en-CA.json`, `messages/fr-CA.json`, locale tests | Locale selection and fallback are implemented. Operational parity is unverified. |
| AI-01 | AI route | `apps/union-eyes/app/api/ai/summarize/route.ts` | Auth, rate limit, entitlement, feature guard, safety call, org document check, provider/model trace metadata and `reviewRequired: true` exist. Request content is sent to configured AI client/provider. |
| DEP-01 | Deployment | `apps/union-eyes/infra/main.bicep`, Dockerfiles, root release scripts | IaC/deployment components exist; production deployment and assurance claims require current runtime evidence. |
| OPS-01 | Pilot documentation | `docs/categories/products-and-market/pilot/cupe/CUPE_READINESS_CHECKLIST.md` | Dated 2026-03-25 and has unchecked manual validation/sign-off/go-no-go fields. It is context, not current operational proof. |

## Validation commands

| Command | Scope | Result classification | Evidence / blocker |
|---|---|---|---|
| `pnpm install --frozen-lockfile` | dependency installation | UNEXECUTED | Existing installation was present; running it was not necessary to inspect package scripts. Must be rerun in a clean CI checkout for a reproducible dependency verdict. |
| `pnpm --filter @nzila/union-eyes typecheck` | app type safety | PASS | Completed with exit code 0. |
| `pnpm --filter @nzila/union-eyes lint` | app lint | PASS_WITH_WARNINGS | Completed with exit code 0; 2,424 warnings and 0 errors, predominantly `@typescript-eslint/no-explicit-any`. |
| `pnpm --filter @nzila/union-eyes test` | app units/integration-style Vitest | FAIL | 1 of 1,103 test files and 4 of 16,036 tests failed. `app/api/__tests__/admin-pilot-status.route.test.ts` mocks `drizzle-orm` without its required `relations` export; schema initialization fails at `db/schema-organizations.ts:228`. |
| `pnpm --filter @nzila/union-eyes test:qa:api` | critical route/API tests | PASS | 9 files and 89 tests passed in 630ms. |
| `pnpm --filter @nzila/union-eyes test:qa:e2e` | Playwright E2E | FAIL | 116 passed, 24 failed, 10 skipped and 42 did not run over 20.9 minutes. Failures include role journeys, pilot gating, route rendering and governance visibility; local server logs include auth/permission failures and PostgreSQL UUID/query errors. |
| `pnpm contract-tests` | repository contracts | PASS | 272 files and 9,424 tests passed in 224.46 seconds. |
| `pnpm build:union-eyes` | production build | PASS | Turbo reported 3 successful tasks in 2m13.262s. |
| `pnpm validate:docs` | documentation consistency | PASS_WITH_WARNINGS | 2,260 files scanned; 0 errors, 1,223 warnings, 1,534 informational findings. It regenerated repository report artifacts. |
| `pnpm governance:audit` | governance | UNEXECUTED | Runs broad generators and is not necessary to falsify Union Eyes path; CI should run before review. |
| `pnpm reality:inventory` | surface ownership | PASS (pre-existing 2026-07-21 report) | Report shows material coverage gap; command not rerun to avoid unrelated report churn. |
| security/dependency audit | vulnerabilities | NOT_PROVEN | No fresh Snyk/audit command executed in this audit. |
| accessibility audit | WCAG | NOT_PROVEN | No comprehensive axe/manual run found or executed. |

## Final execution record

The app-test failure is a test-fixture/mock defect, not evidence that the affected pilot-status behavior is correct or incorrect. The E2E failures are not attributed to a single root cause by this audit, because they include expected authorization-denial responses as well as route-rendering, database/query, and test-environment/auth symptoms. Together, they leave affected runtime behaviors unproven. A command failure is preserved as a failure and is not remediated by this audit.

## Evidence disposition

The focused API suite, typecheck, contract suite, documentation validation and production build have executable results. The full Union Eyes and E2E suites did not pass. Security and accessibility status remain unproven because no comprehensive fresh audit was executed.
