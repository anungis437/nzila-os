# Tool Fabric baseline governance decisions

**Mission:** TF-FINAL-CONVERGENCE-001

**Disposition:** sixteen cumulative entries retired (seven original redundant entries plus nine
fully corrected scopes); seventeen retained. No renewal, risk acceptance or gate clearance.

**Evidence snapshot:** 2026-10-18, HEAD `c1564ffde70e47eb6a047c9ab0b205ae66b81bcf`.

The companion [JSON decision register](TOOL_FABRIC_BASELINE_GOVERNANCE_DECISIONS.json)
is the per-entry record: original owner, **verbatim current justification**, original
expiry, exact match counts, bounded file/line examples, classification, correction,
residual risk, required reviewers, required approver roles and next action. IDs below
map one-to-one to its 33 entries. Required approvers identify whom to obtain a
recorded decision from; they do not assert delegated authority or existing approval.
All proposed expiries are `null`: no evidence justifies a new deadline, and no approval
has been obtained. The historical “owner-accepted” bridge text is provenance, not
present authorization.

## Initial seven-entry retirement (historical phase)

The convergence agent used the existing mandate's safe-remediation scope for
**A03, N01, N02, N04, N05, N14, N15**. The parent-agent delegation timestamp
**2026-10-18T00:36:12.318-04:00** is not a separate human approval.
The bounded implementation agent removed them without staging or committing;
the parent subsequently preserved the four-file review unit in
`b5ae0a4776b71cebf57e50b387b2e42e21a307e5`.
At that historical phase N03 and every remediation/owner-decision entry remained unchanged.
The current execution section below supersedes that phase for the nine newly clean scopes.

| Rule | Original entries | Retired | Remaining / expired | Remaining actual matches | Matching files |
| --- | ---: | ---: | ---: | ---: | ---: |
| ARCH_LAYER_001 | 11 | 1 | 10 / 10 | 123 | 114 |
| NO_CONSOLE_001 | 22 | 6 | 16 / 16 | 85 | 46 |
| **Total** | **33** | **7** | **26 / 26** | **208** | **160 rule/file pairs** |

Retired scopes contribute **zero** actual-rule matches; removing them does not
reduce the 208 remaining matches or authorize any logging/DB behavior. At that phase, the 26 retained entries required remediation or a specifically recorded decision.
The additional unchanged expiry blockers remain raw actions **2**, org scoping
**33**, and stack authority **8**; the later parent-supplied qualification also
identifies **4 direct-provider expiries**, now included in both JSON blocker summaries.
UE remains **NO_GO — RUNTIME_PROOF_REQUIRED**.
Browser context and N03's indirect console access do not establish authorization.

Exact SHA-256 ledger fingerprints:

| Ledger | Before retirement | After retirement |
| --- | --- | --- |
| `governance/exceptions/arch-layer.json` | `1c3c9e85dfa7b371396b8047573cfae4fc66306930702b252de0a93b56d3d38e` | `a086c7268928e769b491e5d1c224525ae02cf592c78c4b759ddf8c70f9593000` |
| `governance/exceptions/no-console.json` | `b67115a2f92b862bf4b24f044a9a3119c2b860580e97d8ab94df1016a0148157` | `b84b681b454264d044c5898736f191b477efddd67e18ba5d1f83ebf59fb41b3a` |

The original snapshot, 33-entry adjudication, justifications, owners, dates,
reviewer/approver requirements and proposed corrections below and in JSON remain
historical provenance. This execution section and JSON `retirementExecution`
supersede removal-pending wording **only for those seven IDs**. Snapshot ledger
hashes are the before hashes. No exception renewal, structural exemption, residual
risk acceptance, or governance gate clearance is approved.

Validation is bounded to exact before/after ledger equality except the seven
authorized removals, unchanged retained entries/order/dates, the actual-rule
counterfactual for retired scopes, JSON/count/hash consistency and whitespace.
No suites or new agents were launched.


## Current approved safe-correction execution

This section and JSON `safeCorrectionExecution` / each entry's `currentDisposition`
and `currentMatchingViolations` supersede historical removal-pending/source-correction
wording. Original 33-entry classifications, justification strings, expiry values, evidence
and first-seven ledger hashes remain provenance, not claims that old source still exists.

**Newly retired:** A01, A06, A08, A09, A10, N16, N17, N18, N21.
**Still retained:** A02, A04, A05, A07, A11 and twelve console entries including N03.
Every retained entry remains expired. All proposed expiries remain null.

| Rule | Cumulative retired | Retained / expired | Actual unsuppressed matches | Files |
| --- | ---: | ---: | ---: | ---: |
| ARCH_LAYER_001 | 6 | 5 / 5 | 113 | 104 |
| NO_CONSOLE_001 | 10 | 12 / 12 | 40 | 37 |
| Total | 16 | 17 / 17 | 153 | 141 rule/file pairs |

The unchanged actual rule modules/walker/Civic exclusion were evaluated with only
exception suppression bypassed in memory: all nine newly retired scopes have zero
matches. Source corrections remove 55 original matches; seven initial retirements
remain untouched. JSON records every current match location (file/line/kind), not
payloads, and before/after per-entry counts.

### Policy correction and authorization

No binding repository rule requires blanket prior human permission for these thirteen
safe-refactor scopes. `AGENTS.md:9` reserves architecture/risk/production decisions,
`:43` requires approval for destructive Git/DB operations, `:44` limits scope, and
`:73–76` restrict UE readiness/Phase 3B claims; none forbids safe authorized extraction.
PR-template `:34–54` describes ordinary review, not prior-edit permission.
`governance/privacy/policies/data-classification-standard.md:30` requires log redaction;
`governance/security/APPLICATION_SECURITY_POLICY.md:77–81` preserves audit requirements
and `:86` concerns vulnerability waivers, not these source corrections.
Historical required-approver roles are not a new safe-refactor approval barrier.

### Implemented boundaries and preservation

- A01/A08/A09/A10: four real NAR service factories preserve construction/invocation,
  key capture, deferred secret lookup, organization predicate, previous-hash order/limit,
  date/payload mapping and audit persistence.
- A06: identity-sync service owns five Clerk handlers; boundary retains signature,
  timestamp and parsing order, dispatch/status behavior and existing role/DB predicates.
- A02: approve/execute DB operations moved to the Console AI-action service; guards,
  lookups, status handling, update, audit/review and execution ordering retained.
- A04: MFA service performs the exact email projection/user predicate/limit; route
  retains auth then lookup then enroll. Programme prerequisites were read in order
  before the edit. UE remains NO_GO; no runtime readiness claim or Phase 3B.
- A05: telemetry service preserves two separate awaited counts and partial fallback.
- A07: route → proof service → audit repository preserves previous hash → first
  secret/create → immutable upload → second secret/create → persistence. Neither
  secret lookup was silently deduplicated; history predicates/order/limit retained.
- N16/N17/N18/N21: existing structured logger/redaction plus `writeDiagnostic` replace
  runtime console and caught-error aliases. Fixed messages omit raw errors, customer,
  credential and event bodies. Seed exports/CLI guards and failure exit behavior
  remain, but CLI output presentation changes to structured JSON. Emitter subscriptions/
  transport, mobile-money queued/provider behavior and HQ audit fallbacks remain.
- Logger failure uses fixed stderr then fixed warning, without recursive audit or
  raw message/metadata/error forwarding. If all sinks throw, preserving primary
  behavior necessarily means no further diagnostic can be emitted.

### Remaining work: engineering versus actual decisions

| Entry | Before → current | Safe additional engineering | Specific separate decision, not a blanket blocker |
| --- | --- | --- | --- |
| A02 | 56 → 54 / 54 files | Remaining AI, analytics/approval/audit/evidence, finance/tax/close, governance, healthcare, ITSM/sales, ML, org/QBO/Stripe routes need genuine services preserving present guards/predicates/order. | No demonstrated mandatory decision for unchanged-authority extraction. Changing survey token authority, OAuth org binding, tenant/global visibility or payment policy is a different semantic change. |
| A04 | 16 → 15 / 15 files | Two case RLS-context routes and thirteen admin/entitlement/system-context lifecycle routes can be extracted with callbacks/actor/default/query behavior intact. | Making the global lifecycle policy registry tenant-scoped is a separate authority/data-model decision, not necessary for extraction. NO_GO is not a refactor ban. |
| A05 | 4 → 3 / 3 files | Extract metrics, ops/summary and quotes with current guards/fallbacks. | Changing global aggregate visibility is separate from unchanged-semantics extraction. |
| A07 | 41 → 40 / 31 files | Classify server roles and extract remaining endpoint-owned data operations. | Whether genuine server repositories/factories belong under the endpoint rule is a real architecture rule-role decision; no blanket server exclusion granted. |

A02 investigation included every remaining matched path's guard/query operations and
representative unusual routes: anonymous healthcare survey share-token/IP rate limit/
audit; ITSM `auth()` plus executive-org selection; sales platform-role global aggregates;
QBO user/CSRF before exchange, encrypted transactional replacement and cookie redirect;
two Stripe signature/provider sequences. No schema-import count proves an unscoped
query. Future extraction needs targeted token/rate-limit, OAuth/rollback, webhook replay/
idempotency and transaction-rejection tests, not invented prior-owner permission.
A04 case RLS and lifecycle admin/entitlement/system-context behavior require corresponding
denial/context/predicate tests before the remaining extractions. Not-yet-implemented
engineering is not mislabeled an owner-only authority decision.

### Focused validation and limitations

- Final serial selectors: **57 tests / 7 files passed** (five baseline contract files,
  diagnostic helper and Zonga mobile-money diagnostics; 06:59:57, 73.31 s).
- Existing exact UE MFA-enroll and Zonga payout-authorization selectors: **13 tests /
  2 files passed** (07:02:27, 4.32 s).
- Existing NAR adapter: **2 tests / 1 file passed** from its package (07:14:21, 29.85 s).
- Final ESLint pass covered all **38** changed source/test files with existing Console/
  Zonga configurations (exit 0; existing root pages-directory notice only). New-test
  import placement/reserved identifiers were corrected; no rule/suppression changed.
- Strict selected-root TypeScript checks with actual dependencies passed for diagnostic
  helper/test, four NAR factories, Console/Flow services, Agrimo identity service and
  Control Plane repository/proof service. Aggregate checking hit bounded heap limits;
  smaller groups intentionally do not check dependency implementations. Enrollment
  alone exceeded a 1024 MiB heap cap, so its semantic check remains unverified (its
  runtime selector passed). No full project typecheck/build is claimed.
- Mock/VM tests establish bounded source behavior, not deployed storage, tenant isolation,
  payment delivery, log infrastructure or UE staging proof. Independent Linux run on
  **9a877f10** qualifies only that old source, never these working-tree edits.
- Historical pre-AUTH-001-correction focused receipts are bound to the 38 source/test files by the reproducible
  JSON `focusedValidationBinding` SHA-256
  `9e7fb8212e9a7d0fbf6214888d1e513c3772338c02f6c73dd0d06eae93aa2830`.
  This historical binding is not the current-byte fingerprint after the narrow fix below.
- In that implementation phase: no full suites/builds, agents, dependency installs, rule/date weakening, staging or
  commits. Original thirteen owner decisions (including N03 and A11), raw-actions **2**,
  org-scoping **33**, stack-authority **8** and direct-provider **4** expiry blockers remain.
  Migration **0041** separately requires explicit approval for **ANY environment**.
  No gate clearance.

### Narrow introduced AUTH-001 correction

Baseline staged tree: `3c7447deae892eed1b71fb4ea4590ffc55aee488`.
The exact Agrimo AUTH-001 selector reproduced **19 naming matches / one failed test**.
The service now uses neutral `authOrgId`/`userId`; a real `lib/org-registry.ts`
storage adapter owns organization lookup/create/update against the unchanged legacy
column. This follows Flow's `lib/org-resolver.ts` compatibility boundary and
platform-auth's neutral identity adapter naming. It is not a file move, computed-name
evasion, new exemption or storage migration. All five handler exports, webhook
verification/dispatch, predicates/limit, persisted keys/defaults, role/status mapping,
timestamps, ordering, rejection propagation and diagnostics are preserved.

Separately bound new-source receipts:

- Three exact contract files, selector
  `agrimo has no Clerk-style variable names|A06`, serial worker:
  **9 passed / 307 selector-filtered**, **3 files passed**, 08:14:43, 15.20 s.
  Includes identity storage defaults/predicates/removals, adapter rejection before
  success logging and signed webhook route regression. The auth scanner is unchanged.
- Existing Agrimo ESLint config: both implementation files and the identity regression
  test **exit 0**; existing root pages-directory advisory only.
- Agrimo-config selected-root TypeScript check: **2 implementation roots**, actual
  dependency closure, **0 diagnostics**, 768 MiB heap cap, no emit / skipLibCheck.
  This is not full app/test/dependency-implementation type qualification.
- Three-file raw-byte fingerprint:
  `425301a66e1aca7491c0bc613cd299250440d1751b51fe1039d01888d3329512`;
  paths and reproducible algorithm are in JSON `authPurityCorrection`.

Only these narrow source/test changes and the two report corrections are authorized
for additional staging; no commit. Original ledger hashes/retirements and current
**153 findings / 141 rule-file pairs** remain unchanged. Neither the exact-9a
qualification nor staged-3c full runs qualify these new bytes. No full suites,
giant compiler, dependency install or Linux runner changes: **HOLD**, mandatory
full type gate still resource blocked.

### Parent-supplied exact-9a Linux qualification update

Reported **2026-10-18T07:24:29.066-04:00**, bound to isolated exact
`9a877f10d07aa8e84d690425dad4f6221dc9d076`, **not these new source edits**.
These runs were not duplicated by this bounded implementation agent.
**Repository qualification remains HOLD.**

- Full fast: **30,446 passed / 35 failed / 596 existing skipped**, across **2,256
  files**. All **41 failure headers** (six suites plus 35 assertions) reproduced
  independently on exact main.
- Recovery: generic private `DATABASE_URL` conflicted with guarded acceptance/default
  fixture modes. After removing that generic input and repairing missing Python/
  cryptography in a non-root venv, failed selectors passed **93 tests**, with **54
  existing conditional auth skips** and only **two Docker-dependent suite failures**:
  no privileged daemon/socket was available.
- **Concrete authority boundary:** dedicated auth fixture preparation stopped before
  migration **0041**. Its first three lines explicitly require separate approval for
  **ANY environment**. No migration or equivalent DDL workaround was applied. This
  specific boundary is distinct from the unsupported blanket prior-CODEOWNERS claim;
  it does not retrospectively prohibit the authorized safe refactors.
- Full contracts: **10,112 passed / six expiry-only assertions failed**; five rule
  tests plus fleet meta reproduced independently. Meta additionally identifies **four
  expired no-direct-provider entries outside the selected 33**, alongside raw-actions
  **2**, org-actions **33** and stack-authority **8**. These additional entries were
  not adjudicated or changed by this bounded source correction.
- Exact-9a Linux full lint **172**, docs, governance **564**, ownership/release/repo/
  deps/supply-chain checks passed. Historical Windows **ownership29** is **not** the
  Linux result.
- Full UE typecheck remains **resource-interrupted, exit 137**. Do not rerun the giant
  compiler on this host. The separate bounded enrollment semantic-check heap failure
  above is not this Linux receipt.

Only the separately bound focused tests/lints above support the new source. No
full-qualification relabeling, migration approval, runtime readiness or gate clearance.
JSON `repositoryQualificationUpdate` preserves this supplied evidence separately.

### Current phase exact SHA-256 ledger fingerprints

| Ledger | Before safe-correction retirement | After nine further removals |
| --- | --- | --- |
| `governance/exceptions/arch-layer.json` | `a086c7268928e769b491e5d1c224525ae02cf592c78c4b759ddf8c70f9593000` | `51bb70c1a81cc92424ac6bf20f9fe1fad5ad970a2baa3a1401684f6fd1d7fc9a` |
| `governance/exceptions/no-console.json` | `b84b681b454264d044c5898736f191b477efddd67e18ba5d1f83ebf59fb41b3a` | `b3f2d7752a151fe08970b16e72db10d771179a245affc8e70ceeba407d1c9380` |

Retained values/order/dates are unchanged. Complete exact source/test/report path inventory
and receipts are in JSON `safeCorrectionExecution.changedPaths` and `receipts`.
Final consistency checks passed: duplicate-free JSON, original 33-entry field equality
against the initial-retirement commit, exact nine new removals, retained values/order/
dates, both byte hashes, disposition/match totals, source binding, no staged changes,
and `git diff --check`.

## Original 33-entry decision summary (historical evidence)

| Rule | Entries adjudicated | Expired entries | Matching violations | Files with matches |
| --- | ---: | ---: | ---: | ---: |
| ARCH_LAYER_001 | 11 | 11 | 123 | 114 |
| NO_CONSOLE_001 | 22 | 22 | 85 | 46 |
| **Total** | **33** | **33** | **208** | **160 rule/file pairs** |

| Proposed classification | Count | Meaning |
| --- | ---: | --- |
| RETIRED | 7 | Original recommendation applied within the mission's safe-remediation scope; no risk acceptance granted. |
| REMEDIATE | 13 | Real rule matches need a scoped implementation/boundary correction. |
| OWNER DECISION REQUIRED | 13 | A module-role or runtime-sink decision needs explicit review. |
| LEGITIMATE EXCEPTION | 0 | No new or permanent exception is approved by this assessment. |
| INVALID | 0 | No entry is classified as malformed; an inaccurate historical rationale alone is not fabricated approval. |

“Files with matches” counts rule/file pairs, not executed DB operations or logged
production events. Examples are bounded; **counts include all present matches** in
the relevant glob and rule scope.

## How the actual rules were evaluated

The evaluation is a read-only **counterfactual without exception suppression**, per
entry. Existing TypeScript rule modules and `governance-helpers.ts` were transpiled
in memory with the installed TypeScript compiler; their scan functions, regexes and
`minimatch` implementation were evaluated without running Vitest suites, application
code or external integrations. Ledger and rule SHA-256 fingerprints are in JSON.
No expensive/full suites or subagents were launched.

- The source walker includes `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, skipping generated,
  dependency, fixture and test-result directories exactly as `walkSync` specifies.
- **ARCH_LAYER_001** scans `app/api`, `pages/api`, `src/routes` and **every `server/`
  file**, not only endpoint handlers. It skips test/spec files and `__tests__`.
  Counts are pattern matches per line, including schema imports—not counts of unsafe
  queries. It does **not** reject `@nzila/db/platform`, scoped/local DB aliases or
  arbitrary named repository modules.
- **NO_CONSOLE_001** actually scans **only `apps`**, despite the header referring to
  runtime packages. It already excludes scripts/tools/tooling/seeds, tests and
  config/setup files. It counts the first direct `console.log/info/warn/error/debug`
  call on each line; method references and Reflect/bracket/alias access are invisible.
  The conditional archived Civic proof-CLI carve-out cannot intersect any of these
  22 exception globs.
- A matched source file is not necessarily a **scanned** file. N01 has two source
  files but **zero scanned files**; its ledger entry is redundant.
- `loadExceptions` uses `new Date(expiresOn) < today`. A date of `2026-10-18` becomes
  midnight **UTC**, not the end of the local day; all 33 entries are expired at the
  snapshot. `isExcepted` still uses expired entries for suppression; the separate
  expiry assertions fail independently. This package does not change that behavior.
- Source locations and counts are evidence of the implemented check, not staging
  execution, remote RUM delivery, redaction correctness or tenant-isolation proof.
  No credentials, code snippets containing payload values, or runtime payloads are
  reproduced in the deliverables.

## Architecture-layer adjudication — all 11 entries

The **source/scanned** column distinguishes glob coverage from actual enforcement
scope. JSON supplies every original justification and individual reviewer/action.

| ID | Exception path | Owner | Source / scanned | Matches / files | Proposed classification | Bounded matching evidence |
| --- | --- | --- | ---: | ---: | --- | --- |
| A01 | `apps/orchestrator-api/**` | platform-team | 35 / 12 | 1 / 1 | REMEDIATE | `apps/orchestrator-api/src/routes/execute.ts:36` |
| A02 | `apps/console/**` | platform-team | 450 / 106 | 56 / 56 | REMEDIATE | `apps/console/app/api/ai/actions/approve/route.ts:11`; `apps/console/app/api/ai/actions/execute/route.ts:10` |
| A03 | `apps/partners/**` | partners-team | 112 / 10 | 0 / 0 | RETIRED | No matching violation in the ten scanned files. |
| A04 | `apps/union-eyes/**` | union-eyes-team | 5103 / 972 | 16 / 16 | REMEDIATE | `apps/union-eyes/app/api/auth/mfa/enroll/route.ts:13`; `apps/union-eyes/app/api/cases/intake/route.ts:29` |
| A05 | `apps/flow/**` | commerce-team | 438 / 24 | 4 / 4 | REMEDIATE | `apps/flow/app/api/governance/telemetry/route.ts:13`; `apps/flow/app/api/metrics/route.ts:12` |
| A06 | `apps/agrimo/**` | agri-team | 52 / 5 | 1 / 1 | REMEDIATE | `apps/agrimo/app/api/webhooks/clerk/route.ts:15` |
| A07 | `apps/control-plane/**` | platform-team | 334 / 127 | 41 / 32 | REMEDIATE | `apps/control-plane/app/api/audit/export/route.ts:5`; `apps/control-plane/app/api/audit/record/route.ts:6` |
| A08 | `apps/abr/app/api/abr/incidents/route.ts` | faircase-team | 1 / 1 | 1 / 1 | REMEDIATE | Same file, line 19. |
| A09 | `apps/platform-admin/app/api/admin/org/route.ts` | platform-team | 1 / 1 | 1 / 1 | REMEDIATE | Same file, line 17. |
| A10 | `apps/zonga/app/api/payouts/route.ts` | zonga-team | 1 / 1 | 1 / 1 | REMEDIATE | Same file, line 16. |
| A11 | `apps/nzila-hq/**` | platform-core | 108 / 14 | 1 / 1 | OWNER DECISION REQUIRED | `apps/nzila-hq/server/db/client.ts:38` |

### Corrections and structural decisions

- **A01:** Non-Next.js is not out of scope: Fastify `src/routes` is explicitly
  scanned. Extract the route-local NAR proof adapter/repository into a service
  module; the current adapter performs a real audit insert at `execute.ts:53`.
  Preserve decision enforcement and evidence integrity.
- **A02:** All **56** matches are **schema imports**, not a verified count of
  “~60 unscoped DB routes.” The representative approval route imports `platformDb`
  and an org-access guard. Move table-dependent operations behind scoped services;
  do not claim the schema import alone proves an unscoped query.
- **A03:** Retire the unused blanket entry. Its historical `lib/partner-auth.ts`
  justification points **outside this scan universe**: that file still imports
  `platformDb` at line 17 and executes SQL at line 291. Retirement is not approval
  of that auth module; assess it under the applicable service/scoping controls.
- **A04:** All **16** matches are schema imports. Local DB usage can escape this
  rule, as in the MFA route's local DB import at line 11. Extract the matched
  responsibilities while preserving RLS, auth and NAR semantics. Do not equate
  972 scanned files with 972 violations or portray UE as generally
  Django-authoritative under the current implementation.
- **A05:** This is real route-owned data access: telemetry has `db.select` calls
  at lines 54 and 56. Move the four matched route responsibilities behind scoped
  services and explicitly authorize any platform-wide aggregate.
- **A06:** The barrel match imports tables, while `platformDb` performs org/member
  inserts at lines 84 and 140. Extract verified, idempotent identity-sync service
  logic; keep webhook signature verification at the route boundary.
- **A07:** **20 package imports + 21 schema imports** span 32 files. Genuine route
  coupling and overbroad `server/` classification coexist. `server/db-bridge.ts:11`
  imports a direct DB handle; its name is not evidence of scope. Fix route logic
  and have architecture ownership define explicit server endpoint/service/repository
  roles with import-direction tests. Never replace the blanket app waiver with an
  unguarded blanket `server/` exclusion.
- **A08–A10:** Each still constructs a DB-backed NAR proof adapter in its route;
  real audit inserts occur at incident line 92, admin-org line 35 and payout line 47.
  Move adapter construction and persistence into a service/repository, preserving
  decision gates, org/role checks, audit chains and payout idempotency. These are
  not purely type-only schema references.
- **A11:** The only match is `drizzle()` inside a server-only **DB factory**, not an
  endpoint. Architecture ownership must choose shared-service migration or a
  narrowly defined infrastructure module role with dependency tests. INCUBATING
  status does not justify bypassing the whole app. No narrow exception is granted.

Safe behavior-preserving architecture corrections are authorized by this mission; ordinary
app/CODEOWNERS and governance PR review remains required. Historical JSON approver roles
apply to exception/risk/structural-policy decisions, not blanket prior-edit permission.
Merely moving or renaming an import does not resolve unsafe scope.

## No-console adjudication — original 22 entries (historical evidence)

| ID | Exception path | Owner | Source / scanned | Matches / files | Proposed classification | Bounded matching evidence |
| --- | --- | --- | ---: | ---: | --- | --- |
| N01 | `apps/union-eyes/db/seeds/**` | union-eyes-team | 2 / 0 | 0 / 0 | RETIRED | Already excluded by `/seeds/`. |
| N02 | `apps/union-eyes/lib/client-logger.ts` | platform-team | 1 / 1 | 0 / 0 | RETIRED | No direct call; Sentry transport at lines 40–52. |
| N03 | `apps/union-eyes/lib/console-wrapper.ts` | platform-team | 1 / 1 | 0 / 0 | OWNER DECISION REQUIRED | No literal match; indirect console acquisition at line 26. |
| N04 | `apps/union-eyes/lib/logger.ts` | platform-team | 1 / 1 | 0 / 0 | RETIRED | No direct call; stream output/Sentry instead. |
| N05 | `apps/union-eyes/public/service-worker.js` | union-eyes-team | 1 / 1 | 0 / 0 | RETIRED | `_swLog` / `postMessage` at lines 27–32. |
| N06 | `apps/cfo/app/*/dashboard/error.tsx` | platform-team | 1 / 1 | 1 / 1 | OWNER DECISION REQUIRED | `apps/cfo/app/[locale]/dashboard/error.tsx:23` |
| N07 | `apps/cfo/app/*/dashboard/*/error.tsx` | platform-team | 18 / 18 | 18 / 18 | OWNER DECISION REQUIRED | `apps/cfo/app/[locale]/dashboard/advisory-ai/error.tsx:17`; `.../ai-insights/error.tsx:17` |
| N08 | `apps/cfo/app/*/dashboard/*/*/error.tsx` | platform-team | 3 / 3 | 3 / 3 | OWNER DECISION REQUIRED | `apps/cfo/app/[locale]/dashboard/documents/upload/error.tsx:17`; `.../workflows/new/error.tsx:17` |
| N09 | `apps/zonga/app/*/dashboard/error.tsx` | platform-team | 1 / 1 | 1 / 1 | OWNER DECISION REQUIRED | `apps/zonga/app/[locale]/dashboard/error.tsx:16` |
| N10 | `apps/zonga/app/*/dashboard/*/error.tsx` | platform-team | 6 / 6 | 6 / 6 | OWNER DECISION REQUIRED | `apps/zonga/app/[locale]/dashboard/artists/error.tsx:16`; `.../browse/error.tsx:16` |
| N11 | `apps/partners/app/**/admin/error.tsx` | platform-team | 2 / 2 | 2 / 2 | OWNER DECISION REQUIRED | `apps/partners/app/admin/error.tsx:13`; `apps/partners/app/[locale]/admin/error.tsx:13` |
| N12 | `apps/partners/app/**/portal/error.tsx` | platform-team | 2 / 2 | 2 / 2 | OWNER DECISION REQUIRED | `apps/partners/app/portal/error.tsx:13`; `apps/partners/app/[locale]/portal/error.tsx:13` |
| N13 | `apps/nacp-exams/app/*/dashboard/error.tsx` | platform-team | 1 / 1 | 1 / 1 | OWNER DECISION REQUIRED | `apps/nacp-exams/app/[locale]/dashboard/error.tsx:13` |
| N14 | `apps/union-eyes/lib/api.ts` | platform-team | 1 / 1 | 0 / 0 | RETIRED | `createClientLogger` at lines 8–10; no direct call. |
| N15 | `apps/union-eyes/lib/api/index.ts` | platform-team | 1 / 1 | 0 / 0 | RETIRED | `createClientLogger` at lines 8–10; no direct call. |
| N16 | `apps/*/lib/demoSeed.ts` | platform-team | 7 / 7 | 38 / 6 | REMEDIATE | `apps/cfo/lib/demoSeed.ts:71`; `apps/console/lib/demoSeed.ts:41` |
| N17 | `apps/agrimo/lib/events/agri-event-emitter.ts` | agri-team | 1 / 1 | 4 / 1 | REMEDIATE | Same file, lines 19 and 41. |
| N18 | `apps/zonga/lib/stripe.ts` | platform-team | 1 / 1 | 1 / 1 | REMEDIATE | Same file, line 129. |
| N19 | `apps/console/components/ui/ErrorPanel.tsx` | platform-team | 1 / 1 | 1 / 1 | OWNER DECISION REQUIRED | Same file, line 55. |
| N20 | `apps/nzila-hq/components/primitives/ErrorPanel.tsx` | platform-core | 1 / 1 | 1 / 1 | OWNER DECISION REQUIRED | Same file, line 31. |
| N21 | `apps/nzila-hq/server/db/audit.ts` | platform-core | 1 / 1 | 2 / 1 | REMEDIATE | Same file, lines 58 and 73. |
| N22 | `apps/union-eyes/instrumentation.ts` | platform-team | 1 / 1 | 4 / 1 | OWNER DECISION REQUIRED | Same file, lines 31 and 40; also 56 and 57. |

### Obsolete entries versus hidden console behavior

**N01, N02, N04, N05, N14 and N15** are proposed retirements, not authorizations of
new logging behavior. Their current justifications are redundant or describe sinks
that have already changed. In particular, the service worker demonstrates an
alternative to console: messages to connected clients. That does not prove delivery
when no client exists, nor does moving output to Sentry prove correct redaction.

**N03 must not be waved through as “zero console.”** It captures the console via
`Reflect.get`, installs replacements with `Reflect.set`, and exports original methods.
Comments explicitly discuss avoiding the grep pattern. The zero is an enforcement
blind spot, not evidence of an authorized permanent sink. Prefer an injected
structured sink. If interception is retained, require a narrowly owned adapter role,
AST coverage for indirect access, sanitization, recursion/failure tests and a
decision about the runtime original-console escape. A lexical waiver is obsolete,
but its underlying behavior still needs platform, UE-runtime and privacy review.

### Browser error reporting — N06–N13, N19 and N20

These ten entries account for **36 real direct console-error matches** across 36
browser files. They are **OWNER DECISION REQUIRED**, not “LEGITIMATE EXCEPTION.”
Node-only logger incompatibility is a real runtime constraint; it is **not** evidence
that Next.js requires application `console.error`, that a browser console is a remote
RUM transport, or that permanent exception approval exists.

Proposed structural alternative:

1. Boundaries call a **browser-safe reporter** using an allowlisted event code,
   sanitized scope and stable digest/incident identifier. Do not transmit arbitrary
   Error objects, stacks, document content or response payloads by default.
2. Keep Node-only logger dependencies out of the client import graph. Use a bounded
   browser telemetry transport, with explicit unavailable-sink behavior.
3. If a console fallback is desired, isolate it in one narrowly reviewed adapter
   with a development-only default—not wildcard exemptions on boundary directories.
4. Preserve reset/retry and copy-incident UI. Test sanitization, bundle compatibility,
   transport failures and import direction before retiring the existing entries.
5. Require the recorded platform/app owner, logging governance maintainer and privacy
   reviewer to approve the contract. No expiry, deployment or approval is inferred here.

`**` in the Partners globs includes **zero** directories: both localized and
unlocalized admin/portal files were evaluated. The CFO/Zonga depth-specific globs
were evaluated at their actual depths; no imaginary missing route was counted.

### CLI, server and bootstrap corrections

- **N16 — demoSeed:** Seven matching files are scanned; six contain **38** direct
  console-call lines. Per-file counts: CFO 5, Console 3, Control Plane 10, Flow 0,
  Partners 5, Web 6, Weekone 9. CLI guards exist, but
  `apps/control-plane/server/data.ts:20` imports seed exports from the same module.
  Split CLI logging entrypoints into existing scripts/tooling boundaries and keep
  runtime-importable data exports non-logging. Add runtime-to-CLI import restrictions;
  do not merely exempt every `lib/demoSeed.ts`. `.catch(console.error)` references
  are outside the implemented call regex and are not added to the 38 count.
- **N17 — event emitter:** One event observation and three webhook-failure branches
  are real runtime console calls. Replace all four with the server structured logger,
  allowlisted identifiers and sanitized error classification. A JSON string passed
  to console is not compliance with the no-console rule.
- **N18 — payment integration:** The remaining line 129 warning concerns missing
  provider configuration on a mobile-money payout path, not necessarily startup.
  It is not evidence that a credential **value** is logged. Emit a fixed structured
  configuration event; preserve and test queued-payout behavior.
- **N21 — audit failure:** Both insert failure at line 58 **and list failure** at
  line 73 need a DB-independent structured fallback. Avoid recursively reporting
  audit failure through the same failing audit DB. Retain explicit durability limits.
- **N22 — bootstrap:** Four direct errors exist: two deployment-guard refusals and
  two OTel initialization error/stack paths. A catch-path loader comment does not
  justify the whole file. Design a fixed-code, sanitized, bootstrap-safe Node sink
  without catch-path relative dynamic imports; preserve fail-closed guard exits.
  Require a supported-build reproduction before deciding any narrow console fallback
  is unavoidable. No exception approval is granted.

## Consolidated pre-existing owner blockers

These decisions carry forward the prior
[convergence dossier](TOOL_FABRIC_CONVERGENCE.md) and
[validation record](TOOL_FABRIC_CONVERGENCE_VALIDATION.json).
They are **separate from the exhaustive 33-entry adjudication above**. Their
current ledger populations and expiry semantics were checked; they are not newly
claimed full source remediations or executed test results.

| ID | Rule / ledger | Current entries / expired | Required owner decision |
| --- | --- | ---: | --- |
| B01 | `NO_RAW_DB_IN_ACTIONS_001` / `no-raw-db-in-actions.json` | 2 / 2 | UE owner reviews admin/member-segments local DB access and governed DAL/RLS usage; no renewal. |
| B02 | `ORG_REQUIRED_SERVER_ACTIONS_001` / `org-required-server-actions.json` | 33 / 33 | CFO 12, Partners 5, UE 10, Zonga 6: classify tenant vs privileged platform actions and enforce context at execution, not by text alone. |
| B03 | `STACK_AUTHORITY_001` / `stack-authority.json` | 26 / 8 | Reconcile current authority and independently evaluate mutation/context exceptions; leave the 18 future-dated entries unchanged. |

- **B01:** The raw-action checker scans immediate `*-actions.ts` files in named
  roots and has whole-file RLS token allowances. It differs materially from the route
  layering rule. The two UE local imports are at `admin-actions.ts:13` and
  `member-segments-actions.ts:14`. Neither an import token nor moving it is proof of
  authorized tenant-boundary behavior.
- **B02:** The org checker recognizes only literal single-quoted `'use server'`
  when deciding whether to require `resolveOrgContext`. UE's double-quoted directives
  illustrate a gap. Propose AST-aware directive/call detection and real scope tests;
  do not “fix” it by sprinkling helper names into files. The separate bare-auth check
  is not suppressed by this exception ledger. All 33 expiries block independently.
- **B03:** Current code lists ABR as Django-authoritative and UE as TS-authoritative,
  **but** still checks UE `app/` mutations using both regex and alias-aware AST
  analysis. Of the eight expired UE entries, the two `actions/` entries are outside
  those UE app-only mutation checks; six are app paths/globs that must be evaluated
  rather than declared obsolete. JSON lists all eight expired paths. Do not clear
  an expiry blocker by relabeling stack authority or removing RLS obligations.

Each requires the corresponding application owner, architecture governance maintainer
and identity/tenant/audit reviewer. No deadline or acceptance is invented.

## Union Eyes boundary and closure conditions

The prerequisite reading order was README → operational-readiness rerun **25** →
capability registry before UE source evaluation. The current programme remains
**`NO_GO — RUNTIME_PROOF_REQUIRED`**. The approved MFA service refactor does not start Phase 3B, recording fixtures,
certification or runtime acceptance; NO_GO is not a blanket safe-refactor prohibition. No
source-only scan is represented as deployed proof.

To close individual decisions, owners must submit separate scoped changes, retain
auth/audit/error behavior, evaluate the actual rule **without the retired entry**,
and obtain explicit reviewer/approver decisions on any new narrow structural policy.
Do not weaken tests, suppress findings, use aliases/Reflect to evade a check, or roll
expiry dates forward. Recompute this package after source/rule/ledger changes.

The bounded follow-up extended the implementation agent's write scope to the two
exception ledgers alongside this Markdown and its companion JSON. Only the seven
proven redundant entries were removed. No retained entry, date, application source,
rule or test was changed, and no new suppression was added. That implementation
agent did not stage or commit; the parent subsequently committed the review unit
as recorded above. These retirements do not clear the remaining
authority blockers, required repository gates or external runtime proof obligations.
