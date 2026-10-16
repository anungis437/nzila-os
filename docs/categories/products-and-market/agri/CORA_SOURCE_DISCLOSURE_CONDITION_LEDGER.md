# CORA Agrimo Producer-Status Disclosure Condition Ledger

**Decision:** `APPROVE_WITH_CONDITIONS`  
**Candidate:** `cora-farmer360-agrimo-producer-status-same-org-viewer`
`1.0.0`  
**Candidate state:** `PROPOSED_NOT_ACTIVE`  
**Activation:** `BLOCKED_CONDITIONS_OPEN`  
**Capability truth:** `DESIGN_ONLY`

This documentary ledger tracks the mandatory conditions established by the
[decision packet](CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md) and
[conditional decision record](CORA_SOURCE_DISCLOSURE_APPROVAL_RECORD_TEMPLATE.md).
The [human decision register](CORA_DISCLOSURE_HUMAN_DECISION_REGISTER.md)
provides the decision packets and evidence closure workflow. Its preparation
state is `READY_FOR_DECISIONS`; none of the human states below is closed.
The [C1-only authority intake](CORA_C1_SOURCE_AUTHORITY_INTAKE.md) establishes
the repository routing path, not a source mandate. C1 remains
`PENDING_SOURCE_AUTHORITY`; controlling institution and delegated approver
require human confirmation for the specific fact origin, producer/source
relationship, recipient organization, purpose, and applicable authority
instrument. The origin-scoped documentary model is
`C1_AUTHORITY_MODEL = ORIGIN_SCOPED_READY`; that is model readiness only, not
proof of any authority link or a universal Agrimo controller.
The instruction records a narrow direction in principle; it does not prove
the requester's institutional delegation or any source-owner, privacy or legal
concurrence. Do not promote a human judgment to `PROVEN` based on code,
team ownership, or inference.

Human states describe institutional decisions; engineering states describe only repository-verifiable controls. Engineering proof never closes a human gate.
Engineering states do not authorize disclosure. The current aggregate
certification is `CORA_PREACTIVATION_ENGINEERING = PASS`; activation remains
`BLOCKED_HUMAN_CONDITIONS`.

| Condition                           | Human state                     | Engineering state                     | Remaining decision/evidence                                                                                                                                                                                                                                                                                                                                      | Required authority                                                                                                 | Activation blocker                                                            |
| ----------------------------------- | ------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| C1 — Source authority               | `PENDING_SOURCE_AUTHORITY`      | `NOT_ENGINEERING_CLOSABLE`            | Identify the institutions with authority over this fact/origin and exact source-to-recipient disclosure; evidence producer/source relationships, delegated mandate, upstream restrictions, and recipient/purpose scope. The origin-scoped intake model is ready for human review; no authority link is proven.                                                   | Relevant delegated source authority; Agrimo business owner routes; Privacy/Legal determines legal roles.           | Yes — source authority is not established for this disclosure.                |
| C2 — Status semantics and allowlist | `PENDING_SOURCE_AUTHORITY`      | `READY_FOR_APPROVED_ALLOWLIST`        | Versioned contract machinery rejects missing, mismatched, and unlisted values. Ratify status meanings and exact allowed values; no production allowlist is configured.                                                                                                                                                                                           | Source data owner and Agrimo technical owner; Cora engineering implements only after decision.                     | Yes — source-approved meanings and allowlist are absent.                      |
| C3 — Privacy/legal basis            | `PENDING_PRIVACY_LEGAL`         | `FAIL_CLOSED_ONLY`                    | Determine controllers, jurisdiction, lawful basis, consent/withdrawal requirements, linkage assessment, and rights handling.                                                                                                                                                                                                                                     | Privacy Lead/DPO and qualified legal authority with source controller.                                             | Yes — no flow-specific determination exists.                                  |
| C4 — Exact recipient eligibility    | `PENDING_ROLE_RATIFICATION`     | `PROVEN_FAIL_CLOSED_ELIGIBILITY`      | Explicit eligible canonical roles can pass an exact policy match. Fallback `viewer`, unknown/unmapped, malformed, and explicitly ineligible roles cannot satisfy eligibility; the read permission alone is insufficient.                                                                                                                                         | Source authority and Cora product owner, with platform authorization engineering.                                  | Yes — institutional role concurrence is absent.                               |
| C5 — Freshness and correction       | `PENDING_SOURCE_AUTHORITY`      | `READY_FOR_APPROVED_FRESHNESS_POLICY` | Removed creation-time fallback. Missing/invalid observation time withholds; future time is preserved and rejected. Adapter/authority/service tests prove a recent valid creation time cannot rescue disclosure. Source-approved age, state handling and correction/propagation SLA remain open.                                                                  | Source data owner and Cora Surface Owner; Cora engineering implements.                                             | Yes — source-approved freshness/correction rules remain unresolved.           |
| C6 — Caching and retention          | `PENDING_PRIVACY_LEGAL`         | `NO_CACHE_AND_NO_SOURCE_COPY_PROVEN`  | Dynamic/no-store route controls and response headers are present; status is not a Cora domain-storage field or durable cache entry, and disclosure audit omits status/source record ID. Audit retention, deletion, legal holds, and the 30-day vs 1-year/6-year schedule conflict remain unresolved.                                                             | Privacy Lead/DPO and source controller decide; Cora Surface Owner/Platform Lead implement.                         | Yes — retention and audit doctrine remain unresolved.                         |
| C7 — Export and onward disclosure   | `ONWARD_USE_GOVERNANCE_PENDING` | `TECHNICAL_SURFACE_CONTROL_PROVEN`    | CORA exposure inventory found no other producer-status path; only Farmer 360 profile GET reaches the source adapter. A legitimately authorized recipient can still manually copy displayed information; residual-use controls need approval.                                                                                                                     | Cora/platform engineering verifies the boundary; source authority and Privacy/Legal approve residual-use controls. | Yes — residual onward-use controls are not approved.                          |
| C8 — Policy governance              | `PENDING_PRODUCT_GOVERNANCE`    | `ACTIVATION_PREFLIGHT_PROVEN`         | Strict preflight requires a draft candidate, cross-referenced versioned status/freshness definitions, current approval evidence, and effective/review/expiry metadata. Conditional approval alone is rejected; preflight never installs policy. Accountable owners, delegated authority, dates, conditions, suspension/revocation authority and SLA remain open. | Institutional delegated disclosure approver with source, product and privacy concurrence.                          | Yes — accountable authority, owners, dates, and approvals are unfilled.       |
| C9 — Audit doctrine                 | `PENDING_PRIVACY_LEGAL`         | `PASS_MINIMIZED_AUDIT`                | Technical audit is org-scoped, hash-chained, and omits fact values/source record IDs. Reconcile the 30-day personal-data log cap with the generic 1-year hot/6-year cold security-audit schedule; approve purpose, access, retention, disposal, and legal holds.                                                                                                 | Privacy Lead/DPO and qualified legal authority.                                                                    | Yes — no source-disclosure-specific, consistent retention disposition exists. |

No condition is currently `PROVEN`. Existing evidence (canonical active
identity/membership checks, same-org matching, permission enforcement,
provenance validation and hash-chained decision audit) proves only those
technical primitives; it does not close source, legal, role, retention or
policy-governance conditions. See packet evidence E1-E12.

## Work-order classification

### Human/external decisions

- C1 source authority and authority to bind the source institution.
- C2 meaning and disclosure eligibility of each status value.
- C3 controller, jurisdiction, privacy/legal basis, consent and linkage
  assessment.
- C5 acceptable age, state semantics, correction and history boundary.
- C6 approved cache/retention/deletion and audit retention resolution.
- C8 delegated approver, owners, dates, review, expiry and revocation authority.
- C9 reconciliation/approval of audit-retention doctrine.
- Source/product/privacy decision on the exact recipient roles (C4), and
  acceptable onward-use/residual-copy controls (C7).

### Repository-governance decisions

- Current doctrine assigns classification to the Surface Owner, Privacy Lead
  arbitration, retention schedule approval to the Privacy Lead, and platform
  implementation to the Platform Lead (packet E9-E11).
- Ownership registry supplies Agrimo/Cora/platform team aliases for routing
  only (packet E8); it does not grant disclosure authority.
- Governance doctrine supplies Legal/Compliance and Product & Impact
  escalation paths, but establishes no disclosure-specific quorum or
  delegation (packet E12).
- No current repository evidence closes C1, C2, C3, C5, C6, C8 or C9.

### Verified engineering boundary

**CORA_PREACTIVATION_ENGINEERING:** `PASS`  
**CORA_DISCLOSURE_ACTIVATION:** `BLOCKED_HUMAN_CONDITIONS`  
**Runtime policy registry:** empty; current Agrimo producer-status fact remains
`WITHHOLD`. No positive disclosure policy, HTTP acceptance, deployment,
capability promotion, or shared/production data mutation was performed.

#### Verified engineering boundary

- The runtime policy, status-contract, freshness-policy, and approved-evidence
  registries in [adapters.ts](../../../../apps/cora/lib/farmer-360/adapters.ts)
  are empty. Unit and local acceptance use fail-closed evaluation; an active
  rule requires exact provenance, recipient, permission, role, fact contract,
  allowed value, freshness and current approved evidence.
- [route.ts](../../../../apps/cora/app/api/farmer-360/[profileId]/route.ts)
  exports only `GET`, is dynamic, disables fetch caching, and returns
  `private, no-store`, `Pragma: no-cache`, and `Vary: Cookie, Authorization`.
  The route test verifies headers on successful and denied/error responses.
- [acceptance.integration.test.ts](../../../../apps/cora/lib/farmer-360/acceptance.integration.test.ts)
  exercises a synthetic, org-scoped Agrimo producer in a disposable local
  PostgreSQL database. With the empty runtime policy registry, the producer
  status is omitted and its section is `UNKNOWN`; the authenticated route
  returns no-store headers. Source changes do not rewrite Cora context or
  assertion history. Value-free disclosure audit metadata is checked for the
  absence of the source status and source record ID.
- The source adapter reads the organization-filtered canonical producer
  repository, which internally selects the full row, then projects only the
  current status fact in memory. The read-model path does not persist that
  fact. Cora-owned enterprise context and farmer assertions remain distinct
  write paths; farmer assertions are user-entered and are not a copy of
  Agrimo's source status.
- App Router inventory for this inspected worktree contains the Farmer 360
  profile `GET` route plus unrelated health, readiness, version, and auth
  routes. No Farmer 360 export, bulk, report, server action, scheduled job,
  analytics consumer, or UI service consumer was found. This is a repository
  inventory, not a claim that a user cannot copy data after display.
- The non-mutating activation preflight rejects active candidate status,
  missing or expired evidence, absent fact/freshness definitions, missing
  recipient-eligibility or condition-attestation evidence, and non-finite/
  invalid dates. It returns `installsPolicy: false`. The documentary
  `APPROVE_WITH_CONDITIONS` record is not a runtime policy and cannot produce
  `ALLOW`.
- Source-disclosure eligibility requires server-derived canonical role
  provenance plus an exact role in the policy. Cora's fallback presentation
  mapping cannot satisfy this requirement. Tests cover a canonically eligible
  recipient, fallback and unknown roles, an ineligible role with the read
  permission, and cross-organization withholding.
- Versioned fact-contract enforcement is tested with synthetic-only
  allowlists, including missing contract, version mismatch, and an unlisted
  future status value. The production contract registry remains empty.
- The freshness evaluator is tested at inside/exact/outside boundaries, with
  missing/invalid/future timestamps and absent policy. The prior C5 defect
  substituted `createdAt` for invalid/missing `updatedAt`. The repaired adapter
  never substitutes record creation time: valid update time is the observation
  time; missing/null/invalid update time becomes an absent typed observation.
  Shared authority returns `WITHHOLD` / `FACT_TIMESTAMP_INVALID`. Future time
  remains unchanged and is rejected. Synthetic-policy tests traverse adapter,
  authority and service filtering; absent/invalid time with recent creation
  time cannot surface status or fabricate a replacement status.
- No production freshness interval has been institutionally approved.
  Presentation freshness remains separate from disclosure-authority freshness;
  the existing 90-day display label is not an authorization policy. Creation
  time remains on the canonical record only; the status projection does not
  need it. Technical readiness to enforce a policy is not itself an approved
  policy.
- CORA API inventory consists of Farmer 360 profile GET plus auth, health,
  ready, and version routes. The other routes do not access the Agrimo producer
  repository. No Cora server actions, export/download endpoints, bulk/report
  APIs, background jobs, analytics consumers, or generic query surface exposing
  `producer.status` were found. Application controls cannot prevent a
  recipient from manually copying information legitimately shown.
- Cora profile/context/assertion schema contains no producer-status value
  field. The profile stores a source reference; status is projected into the
  request read model and evaluated before response assembly. No durable cache
  or materialization was found.
- The prior `READY_FOR_HUMAN_DECISION` gate is historical, not the current
  phase status. Conditional direction is recorded; C5 engineering repair is
  proven and activation remains blocked on human conditions. Capability truth
  remains `DESIGN_ONLY`.
- No audit-retention interval was selected or changed. Technical proof does
  not resolve C6/C9 retention, lawful basis, legal holds, or authority.

#### Validation evidence

- `pnpm exec vitest run packages/platform-auth/src/source-disclosure.test.ts packages/platform-auth/src/authorization-context.test.ts apps/cora/lib/__tests__/resolve-org.test.ts apps/cora/lib/farmer-360/adapters.test.ts apps/cora/lib/farmer-360/service.test.ts apps/cora/app/api/farmer-360/[profileId]/route.test.ts` — passed, 74 tests across 6 files.
- `pnpm --filter @nzila/platform-auth typecheck` — passed.
- `pnpm --filter @nzila/cora typecheck` — passed.
- Focused ESLint runs for the changed platform-auth and CORA implementation/test files — passed.
- `pnpm cora:acceptance:db:up`, `pnpm cora:acceptance:db:bootstrap`, `pnpm cora:acceptance:test`, and `pnpm cora:acceptance:db:down` — passed against the isolated disposable local PostgreSQL harness; teardown removed its container, network, and volume.
- `pnpm governance:audit` — passed with exit code 0. Documentation consistency reported 0 errors and existing warnings; governance audit chain completed.
- `git diff --check` — passed.

#### Historical certification rerun — 2026-10-07

- Focused six-file Vitest command listed above — passed, 74 tests across 6 files.
- `pnpm --filter @nzila/platform-auth typecheck` and `pnpm --filter @nzila/cora typecheck` — both passed.
- Focused ESLint on the source-disclosure, authorization-context, recipient-resolution, Farmer 360 adapter/service, and route implementation/test files — passed.
- `pnpm validate:docs` — passed; 2,463 files scanned, 0 errors, 1,215 warnings, and 1,673 informational findings.
- `pnpm governance:audit` — passed with exit code 0; its financial-service health check passed, including 553 tests across 29 files.
- `git diff --check` — passed.
- Disposable database acceptance was not repeated: this certification rerun changed documentation only and did not alter database-composition code.

#### C5 repair verification — 2026-10-07

- The focused six-file Vitest command above passed: 82 tests across 6 files.
  This includes seven deterministic adapter/authority/service timestamp cases
  and a shared-authority missing-time regression. Positive policies and
  contract-version annotation exist only inside isolated tests.
- Both platform-auth and CORA typechecks passed.
- Focused ESLint and Prettier checks for all eight C5 implementation/test/
  documentation files passed.
- `pnpm governance:audit` passed with exit code 0, including
  `pnpm validate:docs` (0 errors, 1,215 warnings, 1,673 informational findings)
  and the financial-service health suite (553 tests across 29 files).
- `git diff --check` passed. Branch remains `main`, HEAD
  `1c337567635bb86ea0df7831557d8d2d22df1e6f`, upstream `origin/main`,
  ahead/behind `0/0` against the local reference without fetching.
  Existing modified/untracked work is preserved; no commit or merge occurred.
- `pnpm cora:acceptance:db:up`, `pnpm cora:acceptance:db:bootstrap`,
  `pnpm cora:acceptance:test`, and `pnpm cora:acceptance:db:down` passed.
  The disposable PostgreSQL test proves canonical update-time projection,
  source `NOT NULL` enforcement without changing schema or source records,
  missing producer withholding, and omission of status from the read model.
  Missing/null/malformed timestamp cases are exercised at the repository/
  adapter boundary because the canonical PostgreSQL column prohibits them.
  The dedicated container, network and volume were removed.
- No authenticated HTTP acceptance command was run. The existing disposable
  DB test calls the route handler in-process with mocked authentication; it
  does not start a server or authorize positive Agrimo disclosure.

Do not start Value Opportunity, resume authenticated HTTP acceptance, or
activate a policy. C1-C9 remain human/institutional gates; a later explicit
authorization is required before any policy installation or positive-path
acceptance.
