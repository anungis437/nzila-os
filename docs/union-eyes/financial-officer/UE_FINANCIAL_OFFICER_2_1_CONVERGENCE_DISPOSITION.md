# UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION

**Mission:** UE-FINANCIAL-OFFICER-2.1-CONVERGENCE
**Canonical authority:** UE-FINANCIAL-OFFICER-CANONICAL-2.1 (FROZEN — design only)
**Disposition:** Slice B (security / wrong-table containment) partially delivered. Slices A, C, D, E not delivered.
**Implementation verdict:** NOT CERTIFIED. **Staging / production:** NO-GO (unchanged;
`UE_SAAS_OPERATIONAL_READINESS` remains `NO_GO — RUNTIME_PROOF_REQUIRED`).

Evidence labels: `SOURCE_INSPECTED`, `TEST_PROVEN` (unit tests with mocked storage/db/auth),
`LOCAL_RUNTIME_PROVEN`, `NATIVE_STAGING_PROVEN`, `NOT_PROVEN`. Nothing below is `LOCAL_RUNTIME_PROVEN` or
`NATIVE_STAGING_PROVEN`: no browser session, live database, blob storage or authenticated API call was run.

## 1. Source control

- Worktree `C:\APPS\nzila-os.worktrees\union-eyes-financial-officer-freeze`, branch
  `agents/union-eyes-financial-officer-freeze`, base HEAD `0c994b968` (merge of PR #995), clean at start.
- Sibling worktrees (Officer/Executive, Senior Representative, navigation) share the same base SHA. No shared
  navigation, authentication or executive files were edited; no merge, rebase, reset or force-push was performed.
- Shared files touched that need coordinated integration: `messages/{en,en-CA,fr,fr-CA}.json`,
  `lib/reality/capability-registry.ts`, `lib/api/deprecation.ts`.

## 2. Financial domain truth (source-to-domain map) — `SOURCE_INSPECTED`

| Surface | Bound to (before) | Domain classification | Disposition now |
| --- | --- | --- | --- |
| `/api/financial/{budgets,expenses,vendors}` and UIs | none (tables never created); HTTP 200 deprecation payload | LEGACY_RETIRED | HTTP 501; UI shows not-available |
| `/api/strike/{funds,disbursements,stipends,eligibility,picket-lines}` and UIs | `votingSessions` | MISBOUND | HTTP 501, no table imported; UI not-available |
| `/api/admin/clc/remittances/**` | `organizationMembers`; export/submit stubs returned "accepted" | MISBOUND | HTTP 501, no table imported |
| `/api/dues/*` member financial data (arrears, exceptions, ledger, remittances, reconciliation, payment plans, billing cycle, late fees) | `member_arrears`, `employer_remittances`, etc. | NATIVE (authority UNQUALIFIED) | Restricted to explicit financial allow-list |
| `/api/dues/remittances/upload` | `employer_remittances`, bytes not stored | NATIVE, LIMITED | Source preserved; unparsed state |
| `/api/pension/trustees` | `pension_trustees` | UNQUALIFIED (authority) | Mutations fail closed |
| `/api/finance/{dashboard,exports,...}` | `services/platform-economics` (Nzila SaaS billing) | Nzila platform billing | Labelled; not union finance |

## 3. P0 findings, fixes and denial tests

| ID | Finding (revalidated locally) | Fix | Evidence |
| --- | --- | --- | --- |
| P0-A | Budget/expense routes returned HTTP 200 deprecation payload and pointed to `/api/billing/reports` | 501 via `lib/finance/retired-financial-route.ts`; no pointer to billing; interactive components replaced by `FinancialCapabilityUnavailable` (EN/FR) | TEST_PROVEN (containment test) |
| P0-B | `/api/strike/funds` (and four siblings) bound to `votingSessions` | 501; no table import | TEST_PROVEN |
| P0-C | `/api/admin/clc/remittances/**` bound to `organizationMembers` (read member / write steward, including PATCH/DELETE) | 501 on all five route files | TEST_PROVEN |
| P0-D | `/api/dues/arrears` released member names, email, phone and arrears at steward level; `arrears/calculate` GET returned raw `member_arrears` rows to any member | `auth.roles = FINANCIAL_MEMBER_DATA_ROLES` on 18 route files (see §4) | TEST_PROVEN (static + RBAC-pinning test); runtime role resolution NOT_PROVEN |
| P0-E | Finance dashboard/exports present Nzila platform billing under finance labels | Response carries `domain: NZILA_PLATFORM_BILLING`, `notUnionFinancialRecords: true`; pages retitled and bannered (EN/FR); exports route doc updated | SOURCE_INSPECTED; existing route tests pass |
| P0-F | Upload stored metadata only, `totalAmount: 0` | Hash and preserve bytes (blob) before insert; failed store means no record; insert failure removes blob; duplicate hash gives 409; type/size/period/UUID validation; `fileUrl`, `fileHash` persisted; response `SOURCE_PRESERVED_UNPARSED` | TEST_PROVEN (mocked storage/db) |
| P0-G | Trustee create/update/delete gated at steward | 501 for every role until an independent trustee-administration authority exists | TEST_PROVEN |
| P0-H | Mutation integrity (idempotency, periods, self-approval, partial failure) | Not addressed beyond upload and containment | NOT_PROVEN |
| P1 | Native dues scheduler hardcoded test tenant; autopay/Stripe | Not activated or touched | SOURCE_INSPECTED via registry |

**Allow-list.** `FINANCIAL_MEMBER_DATA_ROLES = ['secretary_treasurer']` in `lib/finance/financial-authority.ts`. It is an
explicit list (never inferred from `ROLE_HIERARCHY`), and a unit test pins it to the organizational roles holding
`Permission.MANAGE_FINANCES`. President, VP, admin, officers, stewards and platform/CLC roles are excluded. This is a
route-level role guard only; it is **not** a mandate model (no delegations, limits, expiry, former-officer or
other-local checks beyond existing organization binding).

## 4. Routes moved to the allow-list

`dues/arrears` (GET), `arrears/calculate` (GET, POST), `arrears/[id]/payment`, `arrears/[id]/reminder`, `exceptions`,
`dashboard`, `ledger`, `billing-cycle`, `late-fees`, `payment-plans` (GET, POST), `reconcile`,
`reconciliation/{auto-match,match,queue,reject}`, `remittances` (GET, POST), `remittances/[id]` (GET, PATCH),
`remittances/upload`.

Behavioural consequence: admins and presidents who previously reached these routes now receive 403. This is deliberate
under the frozen doctrine (title is not financial authority) but removes access that existing pilots may rely on; the
product owner must decide whether a delegated-mandate store or an interim allow-list expansion is required.

## 5. Not delivered (honest status)

- **Navigation (seven destinations):** `NOT_PROVEN`. Not implemented. "Accounts & Cash", "Budgets & Spending" and
  "Funds & Programs" have no qualified engine; advertising them would link to unavailable pages. Existing nav entries
  (`components/dashboard-navbar.tsx`, `components/workspace/workspace-config.ts` "Strike Fund") still point at the
  strike-fund page, which now renders an explicit not-available state. Navigation is shared with the Officer/Executive
  agent and was deliberately not edited.
- **F01–F28:** no domain is `OPERATIONAL`. F11/F12/F13/F14 (budgets, expenses, vendors) UNAVAILABLE; F17/F18 (strike and
  restricted funds) UNAVAILABLE; F10 (affiliate remittances) UNAVAILABLE; F19 (trustees) BLOCKED on trustee authority;
  F09 LIMITED (source preservation only); F08 LIMITED (access restricted; individual-record scoping not runtime-proven);
  all other domains NOT_PROVEN.
- **Journeys FJ01–FJ10, organization scenarios, WorkAid boundary, external accounting, succession/revocation,
  bilingual/mobile/accessibility acceptance:** `NOT_PROVEN`. Only the new unavailable-state and platform-billing notice
  strings exist in EN/FR (`it`/`pt` locales were not updated).
- **Approvals / segregation of duties:** no financial approval workflow exists to qualify; self-approval, expired
  mandate and duplicate-invoice deny cases are `NOT_PROVEN`.

## 6. Known residual risks (named, not fixed)

Closed in a follow-up commit (TEST_PROVEN, mocked db): `PATCH /api/dues/remittances/[id]` now uses a strict schema that
rejects reconciliation, completion, variance and result-counter fields (only `notes`, `metadata` and a
`requires_review`/`failed` flag remain); `POST /api/dues/remittances` no longer accepts caller `fileUrl`/`fileName` and
always records `pending` / unreconciled; the CLC remittance dashboard and approval components now render the
not-available state, and the "Review Remittances" link to a raw API path was removed from the CLC dashboard.

1. Reconciliation has no engine-driven transition at all yet, so no remittance can become reconciled; the manual
   `POST` still accepts caller-asserted totals and member counts (recorded as pending, unverified).
2. Upload does not validate that `employerId` belongs to the organization (no employer table located) and does not
   parse or match; the evidence-pack call remains fire-and-forget.
3. `/api/finance/summary` (platform billing) feeds `components/financial/FinancialOverview.tsx` beside dues data.
4. `/dashboard/clc/staff` still passes server-action props (via `as any`) and `/api/v2/clc/remittances/*` calls to the
   approval component; the component now ignores them and offers no action, but the dead props should be removed.
5. `db/rls-storage-authority/*` reachability prose still names the former route bindings (historical evidence).
6. `lib/api/deprecation.ts` now lists `REMOVED` for the six retired routes; registry consumers were not re-audited.
7. Role resolution for `auth.roles` falls back to a DB role lookup in `withApi`; behaviour with real Entra sessions is
   `NOT_PROVEN`.

## 7. Cross-agent dependencies and responsible authority

- Officer/Executive agent: navigation shell, institutional financial-policy decisions, any financial mandate model.
- Member agent: member-facing dues presentation (self-service routes `balance`, `deductions`, `payment-history`,
  `receipt`, `issues` were intentionally untouched).
- Product owner / maintainers: mandate store, trustee authority, qualified budget/expense/strike-fund persistence, and
  the admin/president access change in section 4.
- Runtime qualification (Phase 3A) remains the gate for any `PROVEN_IN_STAGING` claim.

## 8. Verification performed

- Targeted vitest: `financial-officer-containment.test.ts` and `dues-remittances-upload.route.test.ts` pass (40 tests);
  related suites (dues, finance, strike, pension, clc, sidebar, reality, deprecation, crud-routes) pass
  (93 files / 1544 tests; the one worker-startup timeout on `sidebar.test.tsx` passed on re-run).
- `tsc --noEmit` on `apps/union-eyes`: no errors in changed areas. ESLint on changed paths: 0 errors.
- Not run: repo-wide `pnpm lint`, `pnpm typecheck`, `pnpm test:fast`, `pnpm governance:audit`.
