# Gate 0 scope lock (adversarial rework, Gate 0A, Gate 0A.2, Gate 0B.1, Gate 0B.2, Gate 0B.3, Gate 0B.4, Gate 0B.5, Gate 0B.6, Gate 0B.7, Gate 0B.8, and Gate 0B.9)

Mission: `UE-FINAL-CONVERGENCE-2026-10`. Verdict: `IN_PROGRESS`.

The earlier verdict, `READY_FOR_ADVERSARIAL_REVIEW`, is withdrawn. The adversarial review of `2247978bd642a89a7d4f8bd720b978f789cb4437` returned REWORK REQUIRED. This report states what Gate 0 can and cannot prove today. `matrix.gate0Verdict` is computed from the validator's blockers and the validator rejects any other value. `CURSOR_IMPLEMENTATION_COMPLETE` stays false. Staging and production stay NO-GO. This rework does not start Gate 1.

## Evaluated SHAs

| Fact | SHA |
| --- | --- |
| Reviewed HEAD (verdict REWORK REQUIRED) | `2247978bd642a89a7d4f8bd720b978f789cb4437` |
| Evidence recorder | `e9b8cbe6a` |
| First executed-evidence recording | `8c40e84d6` |
| Validator, persona, ownership, lock, and test rework | `b3a7f4046` |
| Regenerated matrix, route ownership, lock, and evidence | `489f16277` |
| Starting HEAD for Gate 0A (second review: rework accepted, Gate 0 still open) | `f39828e97837afa73cf2a03f40c841b3b2699dad` |
| Gate 0A validator, recovery verifier, and tests | `1f182b2a3` |
| Gate 0A recovery file and regenerated matrix | `66eac06d7` |
| Gate 0A recovery report (starting HEAD for Gate 0A.2) | `f1f7178ee1b10933e3addb1dc0a05f2997bca0ac` |
| This report | the next commit; a file cannot contain its own SHA |

The capability lock is anchored to the reviewed HEAD. It reads that commit's matrix with `git show`, so editing the working-tree matrix cannot rewrite the anchor.

## Why the old 102 of 102 headline was incomplete

The earlier extractor counted only the tokens it could see. It matched 102 persona actions, 14 of them for the Financial Officer, and then reported that all 102 were mapped. That proved the extractor against itself. It did not prove coverage of the personas:

- The Steward had no action list, and the report recorded that as out of scope.
- The Representative disposition cites `UE-REPRESENTATIVE-CANONICAL-2.2`, which is not in the repository, and its action list was never extracted.
- The Financial Officer disposition cites `F01–F28` and `FJ01–FJ10`. Range endpoints were counted as actions and the interior of each range was never expanded.
- Routes were mapped by guard class, not by route and method.

Coverage is now measured against each persona's declared universe. The validator refuses a `READY_FOR_ADVERSARIAL_REVIEW` verdict while any persona universe is unresolved.

## Register reconciliation

The register has 41 entries: CLOSED 8, OPEN 12, IN_PROGRESS 17, EXTERNAL_GATE 4. `UE-CONV-H-007`, `UE-CONV-K-006`, `UE-CONV-K-009`, and `UE-CONV-G-002` stay IN_PROGRESS. The four EXTERNAL_GATE entries stay `operationallyActivated` false. `UE-CONV-H-007` stays one workstream with census 231; the census was not edited and the 231 rows are not copied into the matrix.

## Persona-source coverage

182 persona action identifiers are extracted and mapped to a capability. Individually defined means the source gives that identifier its own definition. Grouped only means the identifier appears only inside a range or a list that carries one shared title. Unspecified means the source cites the identifier as an endpoint or range member and gives it no content.

| Persona | Source | Universe | Individually defined | Grouped only | Unspecified | Resolved |
| --- | --- | --- | --- | --- | --- | --- |
| Member | `UE_MEMBER_CANONICAL_2_1.md` | 10 | 10 | 0 | 0 | yes |
| Steward | no canonical file in the repository | 0 | 0 | 0 | 0 | no |
| Representative | `UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION.md` and its first version at `571784d58` (canonical 2.2 file absent) | 56 | 39 | 17 | 0 | no |
| Senior representative | `32_UE_SENIOR_REPRESENTATIVE_2_1_CONVERGENCE_DISPOSITION.md` | 22 | 22 | 0 | 0 | yes |
| Officer / executive | `apps/union-eyes/lib/executive/capability-matrix.ts` | 26 | 26 | 0 | 0 | yes |
| Financial officer | `UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md` (canonical file absent) | 38 | 4 | 6 | 28 | no |
| Governance officer | `UE-GOVERNANCE-OFFICER-CANONICAL-2.1.md` | 30 | 30 | 0 | 0 | yes |

Total: 182 identifiers, 131 individually defined. Gate 0A moved 7 Representative identifiers to individually defined and 4 from unspecified to grouped only. The Financial Officer and Steward counts did not change.

Unresolved detail:

- Steward: no action universe exists. `UE-OMIT-STEWARD-CANONICAL-ABSENT` (gate 10, `SOURCE_UNSPECIFIED`) owns the gap. The earlier out-of-scope record for the Steward was removed, because absent specs are debt and not an exclusion.
- Representative: individually defined `REP-NAV-1..7`, `REP-ACT-01..25`, and (Gate 0A) `R01 R02 R09 R13 R14 R15 R18`. Grouped only `R03 R04 R05 R06 R07 R08 R10 R11 R12 R16 R17 R19 R20 R21 R22 R23 R24`. Unspecified: none. One unresolved source conflict (`R18`). Two references with no identifier (Journeys A–G, institutional scenarios). Owner `UE-OMIT-REP-CANONICAL-ABSENT`. Two source findings are tracked separately: `UE-OMIT-REP-CORRESPONDENCE` (gate 11, `PARTIAL`) and `UE-OMIT-REP-TRANSITION-REASON-LEAK` (gate 10, `NOT_IMPLEMENTED`).
- Financial officer: individually defined `F08 F09 F10 F19`. Grouped only `F11 F12 F13 F14 F17 F18`. Unspecified `F01–F07 F15 F16 F20–F28 FJ01–FJ10`. Three references with no identifier (seven navigation destinations of which three are named, organization scenarios and related acceptance topics). Owner `UE-OMIT-FINANCE-RANGE-UNSPECIFIED`. No title or action text was invented for any unspecified identifier.

No canonical source was invented. The three unresolved personas make Gate 0 `IN_PROGRESS` until the repository contains those sources or an institutional owner decides each open question below.

## Gate 0A: persona source recovery

Gate 0A searched for the three missing canonicals and reconciled what exists. It added no persona identifier, no capability, and no requirement. The consolidation is `docs/union-eyes/convergence/register/ue-gate0a-persona-source-recovery.json`. It declares itself an `EVIDENCE_CONSOLIDATION`, and the validator rejects any other kind.

### Search

All 526 refs (every local branch and every `origin` head) and the full history were searched at the starting HEAD. The commands and the result are in the recovery file under `searchProtocol`.

| Canonical | Recovered | What exists |
| --- | --- | --- |
| Steward | no | No document names a Steward canonical identifier. |
| `UE-REPRESENTATIVE-CANONICAL-2.2` | no | Cited as FROZEN in the disposition (first at `571784d58`) and in code comments. Never committed as a file. |
| `UE-FINANCIAL-OFFICER-CANONICAL-2.1` | no | Cited as FROZEN, design only, in the disposition (first at `ee9ecbb51`) and in the `financial-authority.ts` header. Never committed as a file. |

### What was recovered

The first version of the Representative 2.2 disposition (`571784d58f93ed6939438422534c63b83d77c7ed`) carried an R01–R24 table that the rewrite at `a0e7753fd` dropped. It survives only in git history. Source class: frozen disposition. It gives a title to seven identifiers:

| Identifier | Title (verbatim) | Status in the first version |
| --- | --- | --- |
| `R01` | identity/mandates | LIMITED |
| `R02` | daily workload | LIMITED |
| `R09` | member relationships | LIMITED |
| `R13` | evidence/records | UNAVAILABLE (unverified) |
| `R14` | tasks/deadlines | LIMITED |
| `R15` | agreements | LIMITED |
| `R18` | WorkAid/specialists | BLOCKED |

These are titles. No required behavior was recovered for any of them. Each maps to one existing capability (`UE-CAP-I-001`, `UE-CAP-F-002`, `UE-OMIT-DEADLINE-OVERDUE`, `UE-CAP-G-002`).

Not promoted, because the source joins identifiers: `R07/R08` (one cell, two labels; reading them in order is an inference), `R11/R12` (one label), `R03–R06` (four labels in one parenthetical), `F11–F14` (four identifiers, three labels, so no pairing exists), `F17/F18` (one label phrase). A machine check rejects individual definition for any identifier joined to a sibling by a slash, comma, or dash in its quote.

### Conflict

`R18` is BLOCKED in the first version and MISSING in the current one. Gate 0A recorded both and settled neither. The validator fails if two sources disagree and no unresolved conflict is recorded, and fails if a conflict is marked resolved.

### Steward

Authoritative Steward actions recovered: 0. Eight evidence items are recorded and each is marked as defining no action. They show that the Representative 2.2 record treats one combined steward and staff experience, places the steward at level 1, lists what a steward must not hold or see, and that a `STEWARD` role exists in code. The reading that the Steward is the level-1 role inside Representative 2.2 is an unverified inference. It is recorded as an inference and does not define any action.

Open questions: is the Steward a distinct frozen persona or the level-1 role in Representative 2.2; who supplies the canonical if it is distinct; which Representative actions a steward holds without an assignment, and by what mandate.

### Financial authority separation

The recovery file records, for viewing, preparation, approval, payment execution, reconciliation, mandate administration, and audit, what the dispositions and the code say. Every row carries `institutionallyRequired: false`. The code names six powers (view, prepare, approve, execute, reconcile, audit) and a three-person mandate rule. The disposition states gaps for approval, payment execution, reconciliation, and the mandate store. No row states an institutional requirement, so none is presented as one. The validator rejects a row marked required without a canonical-class source.

### Guards added

- A recovered source must be a git object at a full commit SHA, its blob hash is re-derived, and each quote is re-found in it.
- Only a canonical or a frozen disposition can define an identifier. An executable contract, supporting evidence, or an inference cannot.
- Recovery cannot add an identifier to a universe or remove one.
- The universe recorded before Gate 0A is read from `f39828e97` with `git show`. An identifier there must stay in the extracted universe and in the matrix.
- A persona stays unresolved while it has a source conflict or a reference with no identifier.

### Can the three blockers be cleared?

No.

- Steward: no authoritative action exists and the persona question is open.
- Representative: 17 identifiers have no individual definition, `R18` is in conflict, two references have no identifier, and the canonical is absent.
- Financial Officer: 34 of 38 identifiers have no individual definition, three references have no identifier, and the canonical is absent. F08 and F09 carry a status statement and no domain title.

Each needs an original canonical or an institutional decision. A reconstructed document would not satisfy that.

## Gate 0A.2: three proposed persona baselines

Gate 0A.2 prepared three proposed canonical specifications for product specification review. They are new designs. They are not recovered originals, not frozen, and not adopted. No search was repeated. The matrix records them under `proposedPersonaBaselines` with status `READY_FOR_PRODUCT_SPECIFICATION_REVIEW`, `adopted: false`, and a SHA-256 for each data file. A persona's `resolved` flag, a persona universe, the 56 capabilities, and the Gate 0 verdict (`IN_PROGRESS`) did not change.

| Document | Data |
| --- | --- |
| `docs/union-eyes/persona-baselines/UE-STEWARD-PROPOSED-PERSONA-BASELINE.md` | `register/ue-persona-proposed-baseline-steward.json` |
| `docs/union-eyes/persona-baselines/UE-REPRESENTATIVE-2.2-PROPOSED-PERSONA-BASELINE.md` | `register/ue-persona-proposed-baseline-representative.json` |
| `docs/union-eyes/persona-baselines/UE-FINANCIAL-OFFICER-2.1-PROPOSED-PERSONA-BASELINE.md` | `register/ue-persona-proposed-baseline-financial-officer.json` |
| `docs/union-eyes/persona-baselines/UE-PERSONA-BASELINE-DECISION-REGISTER.md` | `register/ue-persona-proposed-baseline-decisions.json` |

The JSON files are generated by `node tooling/scripts/lib/ue-gate0a2-build-baselines.mjs` from `ue-gate0a2-content-*.mjs`. The markdown carries the data hash and the validator rejects a stale document.

### Three separate measures

The validator reports identifier coverage, behavioral specification completeness, and implemented functionality as three separate numbers per persona. One cannot stand in for another.

| Persona | Identifier coverage | Contracts with every required field | Implementation the cited source supports |
| --- | --- | --- | --- |
| Steward | no historical identifiers; 40 actions, 7 navigation destinations, 8 denial contracts | 55 of 55 | 25 source present, 21 partial, 9 not implemented |
| Representative | 56 of 56 (`REP-NAV-1..7`, `REP-ACT-01..25`, `R01`–`R24`), plus Journeys A–G and 4 institutional scenarios | 63 of 63 | 15 source present, 37 partial, 4 not implemented |
| Financial Officer | 38 of 38 (`F01`–`F28`, `FJ01`–`FJ10`), plus 7 navigation destinations, 5 denial contracts, 4 scenarios | 51 of 51 | 8 source present, 11 partial, 13 not implemented, 9 unavailable (501) |

A cited file is not verification. Conformance was not checked and no run exists. "Source present" requires a cited file that carries an authority-kernel signal in the route itself. A route that only applies a role floor is recorded as partial. The validator raised the first draft's overclaims (six contracts) and they were downgraded.

### Labels

`HISTORICALLY_EVIDENCED`, `PROPOSED_NEW_BASELINE`, `IMPLEMENTED_SOURCE`, and `REQUIRES_INSTITUTIONAL_ADOPTION` are derived from separate fields and never merged. Only an identifier and a recorded title or status are historical. Every specification is new.

| Persona | Contracts | Historically evidenced (identifier and title) | Historical group or status only | New design only | Requires institutional adoption |
| --- | --- | --- | --- | --- | --- |
| Steward | 55 | 0 | 0 | 55 | 18 |
| Representative | 67 | 39 | 28 | 0 | 39 |
| Financial Officer | 55 | 7 | 39 | 9 | 49 |

`R18` carries both versioned dispositions (BLOCKED in the first version, MISSING in the current one) and a separate current implementation status. The four institutional scenarios (CAPE, CUPE, LIUNA, small local) each state why they are not interchangeable. Financial Officer navigation distinguishes three recovered names from four proposed new names. The six financial powers (view, prepare, approve, execute, reconcile, audit) are specified apart, and no mandate is derived from a role title.

### Decisions

The decision register holds 46 decisions, all `OUTSTANDING`: 14 product design (`DEC-PD-01..14`, proposal only) and 32 institutional authority (`DEC-IA-01..32`, inactive, owner to be named by the institution, no proposal). Every institutional decision is referenced by at least one contract. A baseline cannot settle a decision, name an owner, or activate a behavior.

### What it does not do

- It does not edit the 1,152 unresolved route operations or regenerate the route manifest.
- It implements no application functionality. It does not start Gate 1.
- It creates no live institutional authority. Every contract has `liveAuthorityCreated: false` and is inactive until adopted.
- It does not close Gate 0. The five Gate 0 blockers remain.

## Gate 0A.2R: adversarial product specification corrections

An adversarial review of the three proposed baselines returned conditional acceptance with revisions. Gate 0A.2R corrects the product specification only. It adds no application code, does not classify routes, edits no migration, and leaves the route ownership register, the 1,152 unresolved operations, the schema census (231) and the security allowlists untouched. The only matrix change is the four baseline data hashes. The baselines remain proposed, not adopted, not frozen, and not recovered originals. Gate 0 stays `IN_PROGRESS`.

The corrections are layered on top of the Gate 0A.2 content by `ue-gate0a2r-revise.mjs`. Every revised contract carries a `revision` block (round, reasons, changed fields), and `ue-gate0a2r-validate.mjs` compares each identifier, historical record, meaning origin, title and decision against the Gate 0A.2 anchor commit `9836ecd7a` read from git, so a silent change to provenance fails.

| Area | Correction |
| --- | --- |
| Steward identity | Interface persona, union office, platform role, case relationship and issued authority are five separate facts. Only a live case relationship (one case) and issued authority carry authority. A distinct institutional office is not implied, and office and capacity are configurable per organization. The focused workspace grants no organization-wide visibility, triage, reassignment or privileged disclosure. |
| Steward navigation | The seven destinations are candidates. A destination is shown only while a capability behind it is usable by the principal and is hidden otherwise. No page count is promised. |
| Lifecycle | Inquiry, service request, case, formal grievance, complaint, appeal and reconsideration are seven distinct entity types. None requires a prior entity, links are optional, and transitions are configured per organization protocol. Whether claims and grievances are one canonical entity stays unresolved under Gate 4 (`UE-CAP-C-001`). |
| Staff notes | A note is staff-only. Member visibility needs a classification and an authorized server-side disclosure decision, taken independently of the authoring authority. A client flag is never sufficient. Source is recorded as partial: the notes route lets the request body choose visibility and records no classification or disclosure decision. |
| Financial separation | Viewing, preparing, approving, executing, reconciling and auditing stay separate powers. Whether one principal may hold two is decided by a separation rule evaluated against the transaction, account, amount, mandate, approval and principal. The model separates 6 mandatory technical protections, 8 implemented software rules (source today, none universal, none adopted), and 10 proposed institutional rules. The three-person issuance design is evidence of an implemented software rule and not proof of institutional adoption. Journeys carry actor slots and per-rule separation checks and assume nothing about consecutive steps. |
| Financial navigation | Every destination carries a capability state derived from the contracts behind it. A destination whose capabilities are all unavailable is not advertised, and the taxonomy is not evidence of functionality. Platform economics surfaces were removed from union finance evidence, which downgraded F07 and F28 to not implemented. |
| Reports and exports | A view duty does not authorize a report, an aggregate, member-level rows or an export. Disclosed fields, aggregation, scope, sensitivity, export and inference risk are authorized separately. No union finance report engine exists. |
| Institutional decisions | All 32 stay `OUTSTANDING` and `INACTIVE`. Each now states what engineering may build, what a synthetic test may do, that production or institutional activation is prohibited until adoption, and that adoption is required. No real mandate, office, payment, privileged disclosure or counsel activation is permitted. |
| Product decisions | Each of the 14 carries the reviewer disposition as a recommendation only (never an adoption). PD-02, PD-04, PD-10 and PD-11 are revised. |

Preserved: all 182 persona identifiers (the matrix universes are compared with the anchor), the 46 decisions and their titles, every historical record, the R18 versioned discrepancy, and the Gate 0 verdict.

## Route and method ownership

The 993-route manifest is unchanged: 993 routes, 1644 route-method pairs. `ue-route-capability-ownership.json` owns every pair with a route, method, rule, capability, disposition, actor, control category, audit code, and privacy code (or a justified non-applicability). Rules carry evidence from the register, the frozen persona sources, or the capability registry. `matrix.routeOwnership.entriesHash` covers the entries, so deleting an entry fails validation even when the route hash is unchanged.

| Disposition | Operations |
| --- | --- |
| `OWNED` | 634 |
| `RETIRED_501` | 97 |
| `STUB_501` | 31 |
| `SYSTEM` | 9 |
| `SCOPE_UNDECIDED` | 873 |
| Total | 1644 |

The validator rejects an operation without an entry, an entry without a capability, an owner that is not a capability, an owner that differs from the rule-derived owner, two owners for one operation, an entry for a route that is not in the manifest, a route that matches no rule, and a route file on disk that is neither in the manifest nor recorded as uninventoried.

Exceptions:

- `SCOPE_UNDECIDED` is 873 operations (after Gate 0B.3), owned by `UE-OMIT-ROUTE-DOMAIN-SCOPE` (gate 13, `SOURCE_UNSPECIFIED`). Their control owner stays the guard-class owner. No register entry, persona source, or registry record names a business owner for those domains, and none was guessed. This blocks Gate 0 until each domain is decided.
- `reviews/route.ts` (GET, POST) exists on disk and is absent from the manifest. It is recorded as uninventoried and owned by `UE-CAP-REVIEW-INTAKE`. Regenerating the manifest belongs to `UE-CONV-K-008` and was not done here.
- 0 operations are unauthenticated without a recorded justification. The 42 operations previously counted were each inspected in Gate 0B.1 and carry a disposition. Three supplementary system probes are recorded as unjustified exposure. Gate 0B.2 registers them as Gate 14 release-blocking defects (see Gate 0B.2), and Gate 0B.3 preserves them.
- 0 mutating operations have an absent audit code.

## Gate 0B.1: first route-classification tranche

Scope: the Gate 0 route inventory only. No application route, service, schema, migration, security allowlist, census item or persona baseline changed. No regression was investigated and `pnpm test:fast` was not run.

Tranche: `GATE-0B.1`, version 1. The first 100 `SCOPE_UNDECIDED` route-method operations in ascending code-unit order of `<route>|<METHOD>` at anchor commit `ed2cf69d83f366ca431817c21113d7b6dd15fb28`. `ue-route-tranche-0b1-manifest.json` freezes them with an operations hash and a `versionLog`. The validator recomputes the selection from the anchored ownership register, so a changed order or membership fails unless a new version carries a reason of at least 20 characters and the new hash.

Result: 100 examined, 81 classified with source evidence, 19 left `SCOPE_UNDECIDED`. The register now holds 436 `OWNED` and 1071 `SCOPE_UNDECIDED`. All 1644 operations are preserved and no previously classified operation reverted. No capability was created.

| Group | Operations | Capability |
| --- | --- | --- |
| Generic CRUD facade over `organization_members` (READ_ONLY, every write refused with 403) | 64 | `UE-CAP-K-007` |
| Generic CRUD over `analytics_metrics` (OPERATIONAL, atomically audited) | 2 | `UE-CAP-K-007` |
| Billing cycles | 4 | `UE-CAP-D-003` |
| CLC remittance analytics reads | 4 | `UE-OMIT-FINANCE-UNAVAILABLE` |
| Case ingestion and duplicates | 6 | `UE-CAP-K-010` |
| Legacy document backfill | 1 | `UE-CAP-F-002` |

Each record in `ue-route-classification-0b1.json` holds route, method, business domain, capability, actor, service owner, authorization category, tenant scope, data sensitivity, mutation and audit obligation, implementation status, source references (each quote is verified in the file), and unresolved defects. A role floor is recorded as a role floor, never as a kernel decision. An audit is recorded as `ATOMIC` only when `persistAtomicAudit` appears in source. `performAuditedOperation` is recorded as `INTENT_OUTCOME`, because it writes intent and outcome in separate transactions. The route manifest's own audit and control labels were corrected where the source disagrees (the detector marks CRUD reads as mutating, overstates `performAuditedOperation`, and misses `cognitionRoute` and `authenticateUser`).

The 19 unresolved operations are `activities`, `ai-usage`, `database/health`, `database/optimize`, `feature-flags` (GET, PATCH), `jobs/[action]`, `jobs/retry`, `members/stats`, `organizations` (GET), `pilot-status`, `pki/sign`, `pki/verify`, `pki/workflows` (GET, PUT, DELETE) and `representation-protocol` (GET, POST, PUT). No existing capability genuinely covers them. Each carries a `proposedCapability` candidate for Gate 0B.2 and none was invented as an owner.

### Unauthenticated operations

All 42 operations flagged unauthenticated were inspected against source. Eight further `SYSTEM` probes were inspected and recorded, giving 50 records.

| Disposition | Operations |
| --- | --- |
| `AUTHENTICATED_BY_UNDETECTED_GUARD` (a sixth category: `cognitionRoute` or equivalent guard the manifest detector misses) | 27 |
| `INTENTIONALLY_PUBLIC` | 12 |
| `HEALTH_OR_OPERATIONAL` | 4 |
| `EXTERNAL_TRUST_MECHANISM` (HMAC tracking tokens) | 3 |
| `INTERNAL_MACHINE_TO_MACHINE` (staging-proof, HMAC, nonce, environment gates) | 1 |
| `UNJUSTIFIED_EXPOSURE` (`docs`, `docs/openapi`, `version`) | 3 |

Of the 42, 27 are guarded by an undetected guard, 11 are intentionally public, 3 use an external trust mechanism and 1 is machine-to-machine. None of the 42 is unjustified exposure. The three unjustified operations are among the supplementary probes and raise the blocker `ROUTE_UNJUSTIFIED_EXPOSURE`. A public disposition needs a recorded exposure contract, and the validator rejects one without it.

### Defects recorded (21, none fixed)

Gate 13: CRUD facade over `organization_members`, inert super-admin write fix, writable CLC analytics, platform role title as authority. Gate 14: non-atomic intent and outcome audit, CLC cross-tenant read, CLC public cache control, audit read at member floor, legacy cross-tenant AI usage, organizations cross-org contacts, unauthenticated docs surface, unauthenticated version topology, process-local ICRA telemetry limit. Gate 5: billing history returns a false empty result, billing target org unbound, billing scheduler latent. Gate 6: PKI workflows held in memory. Gate 2: representation protocol absent from the capability model. Gate 11: communications tracking GET mutates. Gate 15: manifest detector errors, public-route allowlist drift.

### New validator checks

`validateClassification` is part of `validateGate0`. It rejects an operation without source evidence, a role floor labelled kernel authorization, a public endpoint without an exposure contract, a mutating operation labelled atomically audited without `persistAtomicAudit`, a route assigned to a capability outside its business domain, a previously classified operation reverted to undecided (against the ledger and against the anchored register), a tranche operation that disappears, and a tranche order or membership change without a versioned reason. The matrix pins the sha256 of the three 0B.1 files.

## Gate 0B.2: second route-classification tranche

Scope: the Gate 0 route inventory only. No application route, service, schema, migration, security allowlist, census item or persona baseline changed. No regression was investigated. `pnpm test:fast`, native PostgreSQL, Docker and credentialed browser suites were not run.

Ownership is accountability, not authorization. Owning a route establishes which capability must answer for it. It does not make the route's guard a kernel decision, and no record in this tranche is authorized by a kernel decision.

Tranche: `GATE-0B.2`, version 1, frozen in `ue-route-tranche-0b2-manifest.json` with an operations hash and a `versionLog`. It is the 19 operations Gate 0B.1 left `SCOPE_UNDECIDED` (`carryForward`) plus the next 81 previously unexamined `SCOPE_UNDECIDED` operations in ascending code-unit order of `<route>|<METHOD>` at anchor commit `8480b8899c49d313e8f1254637255674a1c1e4be` (`newOperations`). The validator recomputes both sets, so a changed membership or order fails unless a new version carries a reason and the new hash.

Result: 100 examined, 99 classified with source evidence, 1 left `SCOPE_UNDECIDED`. The register now holds 535 `OWNED` and 972 `SCOPE_UNDECIDED` (previously 436 and 1071). All 1644 operations are preserved, the 231-entry schema census is untouched, the Gate 0B.1 manifest and classification are byte-identical to the accepted commit, and no previously classified operation reverted.

### The 19 carried-forward operations

| Group | Operations | Owner |
| --- | --- | --- |
| Activity feed (`activities`) | 1 | `UE-OMIT-AUDIT-LOG-VISIBILITY` (new) |
| AI usage (`admin/ai-usage`) | 1 | `UE-OMIT-AI-ADVISORY-GOVERNANCE` (new) |
| Database health and optimization | 2 | `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` (new) |
| Feature flags (GET, PATCH) | 2 | `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` |
| Jobs (`[action]`, `retry`) | 2 | `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` |
| Pilot status | 1 | `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` |
| Member statistics, organizations GET | 2 | `UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION` (new) |
| PKI sign, verify, workflows (GET, PUT, DELETE) | 5 | `UE-OMIT-PKI-SIGNING-WORKFLOW` (new) |
| Representation protocol (GET, POST, PUT) | 3 | `UE-OMIT-REPRESENTATION-PROTOCOL-POLICY` (new) |

Each was assigned only after reading the implementation. Where source cannot settle who may use the operation, the software owner and the unresolved institutional decision are recorded separately: the record carries an `institutionalDecisions` list and the classification file holds five `OUTSTANDING` decisions (`UE-INST-PLATFORM-STAFF-MANDATE`, `UE-INST-REPRESENTATION-AUTHORITY-SOURCE`, `UE-INST-KNOWLEDGE-PUBLICATION`, `UE-INST-AUDIT-HISTORY-READERS`, `UE-INST-OBSERVABILITY-ALERT-OWNER`). None is adopted and the validator rejects any record that uses one to justify access.

### The next 81 operations

| Group | Operations | Owner |
| --- | --- | --- |
| Generic CRUD facades over `organization_members` (segments x8, system settings x2, update-role x2) | 12 | `UE-CAP-K-007` |
| Generic CRUD analytics (`analytics_metrics`, `trend_analyses`, `insight_recommendations`) | 31 | `UE-CAP-K-007` |
| AI advisory routes (grievance triage, clause reasoning, copilot, extraction, feedback, finance and pension analysis, insights, ingest, mamba, classify, precedents, search, summarize) | 27 | `UE-OMIT-AI-ADVISORY-GOVERNANCE` |
| Embedding-cache statistics (GET, POST) | 2 | `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` |
| Platform directory and statistics (users, stats, cross-org analytics) | 4 | `UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION` |
| Member access revocation (`admin/users/[userId]` PUT, DELETE) | 2 | `UE-CAP-A-003` |
| Collective agreements (GET, POST) | 2 | `UE-CAP-I-001` |
| `alerts/realtime` GET | 1 | stays `SCOPE_UNDECIDED` |

`analytics/insights` is a partly examined file: only its GET is in the tranche. The ownership rules gained an optional `methods` filter so its POST stays `SCOPE_UNDECIDED`.

`alerts/realtime` stays undecided with an exact evidence gap. No register entry, persona source or capability names observability alerting, and the candidate owners carry different gates and readers. The record names the software owner candidate (`UE-CAP-K-005` for the sweep's audit obligation) and the institutional decision it waits on (`UE-INST-OBSERVABILITY-ALERT-OWNER`) separately.

Every record in `ue-route-classification-0b2.json` states route, method, business domain, canonical owner, persona or system actor, data ownership, authentication mechanism, actual authorization level, tenant and resource scope, privacy and disclosure, mutation and audit obligation, implemented behavior, source defects, required engineering gate and future guard, and source references whose quotes are verified in the file. Actual guards and required future guards are kept apart: an insecure route still has an owner, plus an explicit defect.

### New capabilities (7)

Each is narrowly defined, has a stable id, source evidence, one primary gate and dependency gates, and an entry in the independent capability lock. None was assigned to an unrelated capability to remove an undecided count.

| Capability | Primary gate | Dependencies | Status |
| --- | --- | --- | --- |
| `UE-OMIT-AI-ADVISORY-GOVERNANCE` | 14 | 2, 5, 6, 13 | `PARTIAL` |
| `UE-OMIT-AUDIT-LOG-VISIBILITY` | 14 | 13 | `PARTIAL` |
| `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` | 9 | 13, 14 | `PARTIAL` |
| `UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION` | 14 | 10, 13 | `PARTIAL` |
| `UE-OMIT-PKI-SIGNING-WORKFLOW` | 6 | 14 | `PARTIAL` |
| `UE-OMIT-REPRESENTATION-PROTOCOL-POLICY` | 2 | 13 | `PARTIAL` |
| `UE-OMIT-ROUTE-EXPOSURE-HARDENING` | 14 | 15 | `NOT_IMPLEMENTED` |

### Defects

The 21 Gate 0B.1 defects keep their gates and now each has one responsible engineering capability. Gate 0B.2 adds 19 defects, each with one responsible capability whose primary gate equals the repair gate (the validator checks this):

- Gate 1: member revocation spans several stores and the audit is atomic only with the local row (`UE-CAP-A-003`).
- Gate 2: AI triage, reasoning and copilot read any organization grievance without case authority (`UE-CAP-B-001`).
- Gate 5: AI finance and pension analysis authorized by an officer role title (`UE-CAP-D-003`).
- Gate 6: PKI signature is an attestation with no cryptographic value (`UE-OMIT-PKI-SIGNING-WORKFLOW`).
- Gate 9: the AI ingest index is process-local (`UE-CAP-H-004`).
- Gate 13: segment, settings and update-role facades; writable analytics facades; unvalidated agreement body; platform-wide cache statistics behind an organization role title (`UE-CAP-K-007`).
- Gate 14: unscoped platform directory reads, unproven cross-organization analytics scope, AI data-class downgrade, GET handlers that insert rows, unaudited AI invocations, unguarded classify, public knowledge rows crossing tenants, unscoped semantic-search statistics, feedback readable across users.

Nine operations record `crossTenantExposure` true and `crossTenantAuthorized` false. Public or cross-tenant data is never treated as authorized because it is reachable.

The 40 defects are listed in `matrix.routeDefects` with owner, gate and release-blocking mark, and `validateGate0` fails if the matrix and the classification disagree.

### The three unjustified exposures

`docs`, `docs/openapi` and `version` are implementation defects, not missing inventory. They move from Gate 0 blockers to Gate 14 release-blocking defects (`DEF-0B1-DOCS-UNAUTH-API-SURFACE`, `DEF-0B1-VERSION-UNAUTH-TOPOLOGY`, owner `UE-OMIT-ROUTE-EXPOSURE-HARDENING`), listed in `gateAcceptanceBlockers`. Each exposure's contract and required security contract are preserved by hash in `releaseBlockingExposures`. The validator returns the `ROUTE_UNJUSTIFIED_EXPOSURE` blocker if a registration or hash is removed. No repair was made.

### New validator checks

`validateClassification2` is part of `validateGate0`. It rejects an operation that has no legitimate owner, is owned only through a catch-all or earlier generic rule, claims kernel authorization with only a role floor, claims atomic audit without `persistAtomicAudit` in source, treats cross-tenant public data as authorized, silently changes or reverts a Gate 0B.1 classification or defect, disappears from the frozen tranche, or uses an institutional decision to justify access. A genuinely unresolved operation must carry an evidence gap and name the decision it waits on. The matrix pins the sha256 of the Gate 0B.2 files.

## Gate 0B.3: third route-classification tranche

Scope: the Gate 0 route inventory only. No application route, service, schema, migration, security allowlist, census item or persona baseline changed. No defect was repaired. `pnpm test:fast`, native PostgreSQL, Docker and credentialed browser suites were not run.

Ownership is accountability, not authorization. No record in this tranche is authorized by a kernel decision: all 100 are `ROLE_FLOOR` and record `kernelAuthorization` false.

Tranche: `GATE-0B.3`, version 1, frozen in `ue-route-tranche-0b3-manifest.json` with an operations hash and a `versionLog`. It is the one operation Gate 0B.2 left `SCOPE_UNDECIDED` (`alerts/realtime/route.ts|GET`, `carryForward`) plus the next 99 previously unexamined `SCOPE_UNDECIDED` operations in ascending code-unit order of `<route>|<METHOD>` at anchor commit `e38eee48d8dbc7b4dddddeb4974ca4067213117a` (`newOperations`). The validator recomputes the new set from the anchored register, rejects any operation an earlier tranche already examined, and rejects a changed membership or order unless a new version carries a reason and the new hash.

Result: 100 examined, 99 classified with source evidence, 1 left `SCOPE_UNDECIDED`. The register now holds 634 `OWNED` and 873 `SCOPE_UNDECIDED` (previously 535 and 972). All 1644 operations are preserved, the 231-entry schema census is untouched, the Gate 0B.1 and Gate 0B.2 manifests and classifications are byte-identical to the accepted commit, and no previously classified operation reverted. The ledger grew from 180 to 279 classified operations.

### The carry-forward operation

`alerts/realtime` GET is classified under the new `UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY` (gate 14, dependencies 9 and 13). That names the software owner of the alert inbox read. It does not settle who may read alerts: `UE-INST-OBSERVABILITY-ALERT-OWNER` stays `OUTSTANDING`, the inbox read has no redaction at the member floor (`DEF-0B3-ALERT-INBOX-MEMBER-FLOOR-NO-REDACTION`), and the sweep's audit atomicity is unproven in source (`DEF-0B3-ALERT-SWEEP-AUDIT-ATOMICITY-UNPROVEN`).

### The next 99 operations

| Group | Operations | Owner |
| --- | --- | --- |
| Generic CRUD over `kpi_configurations`, `analytics_metrics`, `insight_recommendations` (analytics) | 31 | `UE-CAP-K-007` |
| Generic CRUD over `member_breaks` and `break_policies` | 10 | `UE-CAP-K-007` |
| Generic CRUD over `organization_members` (`bulk-import`) | 2 | `UE-CAP-K-007` |
| Generic CRUD over `external_calendar_connections` (disconnect) | 1 | `UE-CAP-K-007` |
| Bargaining negotiations, proposals, notes, tentative agreements | 17 | `UE-OMIT-BARGAINING-RECORDS` (new) |
| Arbitration precedent library over `arbitration_decisions` | 13 | `UE-OMIT-ARBITRATION-PRECEDENT-LIBRARY` (new) |
| Platform subscriptions, invoicing, trial expiry, billing validation | 10 | `UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING` (new) |
| Computed analytics reports and break compliance | 5 | `UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION` (new) |
| Arbitration case records | 5 | `UE-CAP-K-010` |
| Audit-log engagement reads | 2 | `UE-OMIT-AUDIT-LOG-VISIBILITY` |
| External invoices | 2 | `UE-CAP-D-003` |
| `billing/batch-status/[jobId]` GET | 1 | stays `SCOPE_UNDECIDED` |

`analytics/insights` is a partly examined file: only its POST is in this tranche (its GET was classified in Gate 0B.2), and `calendar-sync/connections/[id]` is examined for DELETE only. The ownership rules use the optional `methods` filter so the remaining methods are unaffected.

`billing/batch-status/[jobId]` stays undecided with an exact evidence gap. It sits under billing and checks the finance entitlement, but reads newsletter campaign and recipient tables. No capability, persona source or register entry names newsletter delivery, so there is no engineering owner to assign. The record names the candidate owner and the institutional decision it waits on (`UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER`). Gate 0B.3 adds one other institutional decision, `UE-INST-PLATFORM-CONTRACT-AUTHORITY`. The classification file now holds seven `OUTSTANDING` decisions. None is adopted and the validator rejects any record that uses one to justify access.

Facts that the generic CRUD factory leaves open were read, not assumed. The break collection declares `ownerColumn: 'memberId'`; the item route `breaks/[id]` does not, so it is held by the factory's low-role own-rows scope for callers below steward (GET and PATCH) and by no owner scope on DELETE. The classification records the two routes separately, and a negative test fails if a record claims an owner column the route file does not declare.

Every record adds `callers` (route-level hits in product source outside the API tree, tests, documentation and capability registries, each a file and a quoted line whose presence the validator checks) with a `callerFinding`, a `requiredAudit` statement and `dependencyGates`. 26 operations have at least one caller; 74 have none, and the finding says so. A route-level caller search does not determine which HTTP method each caller uses.

### New capabilities (5)

Each is narrowly defined, has a stable id, source evidence, one primary gate (14) and dependency gates, and an entry in the independent capability lock. None was assigned to an unrelated capability to remove an undecided count.

| Capability | Primary gate | Dependencies | Status |
| --- | --- | --- | --- |
| `UE-OMIT-BARGAINING-RECORDS` | 14 | 10, 13 | `PARTIAL` |
| `UE-OMIT-ARBITRATION-PRECEDENT-LIBRARY` | 14 | 13 | `PARTIAL` |
| `UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING` | 14 | 9, 13 | `PARTIAL` |
| `UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION` | 14 | 10, 13 | `PARTIAL` |
| `UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY` | 14 | 9, 13 | `PARTIAL` |

### Defects

The 40 earlier defects are preserved verbatim. Gate 0B.3 adds 36, each with one responsible capability whose primary gate equals the repair gate (the validator checks this), and none repaired:

- Gate 4: arbitration case records carry no case authority (`UE-CAP-K-010`).
- Gate 5: external invoices readable at the member floor, and a write advertised on a read-only table (`UE-CAP-D-003`).
- Gate 13: body mass assignment and a soft delete value outside the status enum, break owner identity and create-for-another-member, KPI alert recipients readable by members, calendar disconnect at the administrator floor without provider revocation, an inert bulk import (`UE-CAP-K-007`).
- Gate 14: bargaining proposals with no tenant predicate, billing batch and replay across tenants, non-atomic and mislabelled billing audits, arbitration decisions readable across tenants and deletable by an organization administrator, confidential bargaining notes bypassed by summary modes and the item route, fabricated model and engagement fields, placeholder trial-expiry payment check, an invoice route that sends nothing, claim identifiers in member-readable metrics, derived case metrics built from telemetry, per-member break compliance for stewards, and the alert inbox.

Twenty operations record `crossTenantExposure` true and `crossTenantAuthorized` false (arbitration precedents, bargaining proposals, billing send-batch and replay-invoice). Public or cross-tenant data is never treated as authorized because it is reachable. No new defect is release blocking: the three unjustified exposures keep their registered release-blocking mark and contract hashes.

The 76 defects are listed in `matrix.routeDefects` with owner, gate and release-blocking mark, and `validateGate0` fails if the matrix and the classification disagree.

### New validator checks

`validateClassification3` is part of `validateGate0`. It applies the shared record rules (also now used by `validateClassification2`, which gained a check that rejects a read method recorded as not mutating while citing a write) and adds: the tranche freeze against the anchored register, the carry-forward operation, the preservation of every Gate 0B.1 and 0B.2 classification, institutional decision and defect, caller line and file existence, a caller finding that agrees with the caller list, a stated required audit, valid dependency gates, and a ledger entry for every classification. The matrix pins the sha256 of the Gate 0B.3 files.

## Gate 0B.4: fourth route-classification tranche

Scope: the Gate 0 route inventory only. No application route, service, schema, migration, security allowlist, census item or persona baseline changed. No defect was repaired. `pnpm test:fast`, VS Code, the broader regression suite, native PostgreSQL, Docker and credentialed browser suites were not run. Phase 3B and Gate 1 did not start.

Ownership is accountability, not authorization. No record in this tranche is authorized by a kernel decision: all 100 are `ROLE_FLOOR` or `NONE_PUBLIC` and record `kernelAuthorization` false. The count of undecided operations was not traded for accuracy: four operations stay undecided because no source names their domain.

Tranche: `GATE-0B.4`, version 1, frozen in `ue-route-tranche-0b4-manifest.json` with an operations hash and a `versionLog`. It is the one operation Gate 0B.3 left `SCOPE_UNDECIDED` (`billing/batch-status/[jobId]/route.ts|GET`, `carryForward`) plus the next 99 previously unexamined `SCOPE_UNDECIDED` operations in ascending code-unit order of `<route>|<METHOD>` at anchor commit `6dcc66d292d9a10f3713691a93009e7dc82bd610` (`newOperations`, `calendar-sync/connections/[id]/route.ts|GET` through `cnesst/hs-committees/route.ts|POST`). The validator recomputes the new set from the anchored register, rejects any operation an earlier tranche already examined, and rejects a changed membership or order unless a new version carries a reason and the new hash.

Result: 100 examined, 96 classified with source evidence, 4 left `SCOPE_UNDECIDED`. The register now holds 730 `OWNED` and 777 `SCOPE_UNDECIDED` (previously 634 and 873). All 1644 operations are preserved, the 231-entry schema census is untouched, the Gate 0B.1, 0B.2 and 0B.3 manifests and classifications are byte-identical to the commits that accepted them, and no previously classified operation reverted. The ledger grew from 279 to 375 classified operations.

### The carry-forward operation

`billing/batch-status/[jobId]` GET is classified under the new, narrow `UE-OMIT-COMMUNICATIONS-CAMPAIGN-DELIVERY` (gate 11, dependencies 9 and 14). The route sits under billing and checks the finance entitlement `financial_intelligence_suite`, but it reads `newsletter_campaigns` and `newsletter_recipients`. That names the software owner of the delivery-status read. It does not settle who owns newsletter campaigns: `UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER` stays `OUTSTANDING`. Three defects are recorded: a finance entitlement guarding a newsletter read, a fabricated `processing` status with zero counts for an unknown job or campaign, and up to ten failed recipient e-mail addresses returned to a steward without an audited read.

### The next 99 operations

| Group | Operations | Owner |
| --- | --- | --- |
| Calendar records (events and calendars) | 11 | `UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS` (new) |
| Calendar provider connections (collection and item) | 5 | `UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS` (new) |
| Google and Microsoft calendar OAuth | 4 | `UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS` (new) |
| CBA intelligence dataset reads | 7 | `UE-OMIT-CBA-INTELLIGENCE-DATASET` (new) |
| CBA intelligence sources, ingestion and extraction | 9 | `UE-OMIT-CBA-INTELLIGENCE-DATASET` (new) |
| CBA intelligence review | 2 | `UE-OMIT-CBA-INTELLIGENCE-DATASET` (new) |
| Collective agreement records | 5 | `UE-OMIT-COLLECTIVE-AGREEMENT-REGISTER` (new) |
| Clause records, search and comparison | 8 | `UE-OMIT-COLLECTIVE-AGREEMENT-REGISTER` (new) |
| Clause library entries | 5 | `UE-OMIT-CLAUSE-LIBRARY-SHARING` (new) |
| Clause library sharing and tags | 5 | `UE-OMIT-CLAUSE-LIBRARY-SHARING` (new) |
| Clause library search and comparison | 4 | `UE-OMIT-CLAUSE-LIBRARY-SHARING` (new) |
| Anti-scab, CNESST filings, joint health and safety committees | 15 | `UE-OMIT-OHS-REGULATORY-RECORDS` (new) |
| Chatbot sessions and messages | 4 | `UE-OMIT-AI-ADVISORY-GOVERNANCE` |
| Public marketing case studies | 5 | `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` |
| Generic CRUD over the CLC sync log (`clc/dashboard`, `clc/remittances`, `clc/sync`) | 6 | `UE-CAP-K-007` |
| `carbon/dashboard`, `carbon/infrastructure`, `carbon/validate` (GET and POST) | 4 | stay `SCOPE_UNDECIDED` |

`calendar-sync/connections/[id]` is examined for GET, PATCH only in the item group; DELETE was classified in Gate 0B.3. The ownership rules use the optional `methods` filter, so the already classified method is unaffected.

The four carbon operations stay undecided with an exact evidence gap. The handlers hold emissions figures written as literals and score caller-supplied data against fixed thresholds. There is no table, service, caller, persona source, register entry or capability-registry entry for carbon accounting, so there is no engineering capability whose obligation covers them. Creating one only to remove four undecided entries would be inventing scope. The records name the decision they wait on (`UE-INST-CARBON-ACCOUNTING-SCOPE`, new and `OUTSTANDING`), the candidate software owner, and the defect `DEF-0B4-CARBON-VALIDATE-ATTESTS-CALLER-DATA` (a certification-shaped result for unverified numbers). The classification file now holds eight `OUTSTANDING` decisions. None is adopted and the validator rejects any record that uses one to justify access.

Every record adds `callers`, a `callerFinding`, a `requiredAudit` statement and `dependencyGates`, as in Gate 0B.3. 50 operations have at least one caller; 50 have none and the finding says so.

### Evidence provenance

Earlier tranches checked only that a quoted line exists somewhere in the cited file. A quote from a sibling method, a sibling route, or a helper the route does not import passed that check. Gate 0B.4 requires each evidence item to state how it supports its claim, and the validator proves the relationship from source text (`ue-gate0b4-provenance.mjs`):

| Provenance | What the validator proves |
| --- | --- |
| `ROUTE_HANDLER_DIRECT` | The quote is inside the exact exported handler of the classified method in the route file. A handler taken from `crudRoutes(...)` is the configuration call that builds it. A local helper is accepted only if that handler calls it. |
| `ROUTE_IMPORTED_HELPER` | The route imports the symbol, uses it inside that method, and the quote is inside the symbol's definition in the module the route imports it from. |
| `SERVICE_IMPLEMENTATION` | The cited file is reachable from the route file through imports (four hops), and the quote is inside the named symbol when one is given. |
| `SCHEMA_OR_POLICY` | The file is a schema, migration or governance file. When `resolvesExport` is named, the file must be the one the route's own import path resolves that export to; an export defined twice is ambiguous and refused. `absentColumns` claims are checked against the table definition. |
| `INFERENCE_UNVERIFIED` | Not evidence. Recorded in `inferences`, apart from the evidence list, and may not support authentication, authorization, tenant scope, mutation or audit. |

Authentication and authorization claims need route-near evidence (the handler or an imported helper). The 1,087 evidence items are 360 `ROUTE_HANDLER_DIRECT`, 450 `ROUTE_IMPORTED_HELPER`, 70 `SERVICE_IMPLEMENTATION` and 207 `SCHEMA_OR_POLICY`; 14 non-material inferences are recorded. All 100 records pass the provenance rules against the live source. The Gate 0B.4 provenance rules are not applied retroactively: the accepted Gate 0B.1 to 0B.3 classifications are byte-identical and keep their original, weaker checks.

### New capabilities (6)

Each is narrowly defined, has a stable id, source evidence, one primary gate and dependency gates, owns at least one classified operation, and has an addition record in the independent capability lock. None was added to reduce an undecided count.

| Capability | Primary gate | Dependencies | Status |
| --- | --- | --- | --- |
| `UE-OMIT-COMMUNICATIONS-CAMPAIGN-DELIVERY` | 11 | 9, 14 | `PARTIAL` |
| `UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS` | 14 | 1, 13 | `PARTIAL` |
| `UE-OMIT-CBA-INTELLIGENCE-DATASET` | 14 | 6, 13 | `PARTIAL` |
| `UE-OMIT-COLLECTIVE-AGREEMENT-REGISTER` | 14 | 6, 13 | `PARTIAL` |
| `UE-OMIT-CLAUSE-LIBRARY-SHARING` | 14 | 6, 13 | `PARTIAL` |
| `UE-OMIT-OHS-REGULATORY-RECORDS` | 6 | 2, 13 | `PARTIAL` |

### Defects

The 76 earlier defects are preserved verbatim. Gate 0B.4 adds 60 (19 high, 36 medium, 5 low), each with one responsible capability whose primary gate equals the repair gate (the validator checks this and that a classification cites it), and none repaired. By repair gate: Gate 14 holds 45 (calendar and provider connections 11, clause library 10, CBA dataset 9, agreement register 9, AI advisory 6), Gate 6 holds 5 (OHS), Gate 11 holds 3 (campaign delivery), Gate 8 holds 3 (`UE-CAP-H-001`, carbon), Gate 13 holds 2 (`UE-CAP-K-007`, CLC sync log) and Gate 9 holds 2 (`UE-OMIT-PLATFORM-OPERATOR-CONTROLS`, marketing content). Eight operations record `crossTenantExposure` true and `crossTenantAuthorized` false: the clause library reads and comparison (system-context reads of clauses shared across organizations, with two federation predicates that disagree) and the public marketing reads. No new defect is release blocking: the three unjustified exposures keep their registered release-blocking mark and contract hashes.

The 136 defects are listed in `matrix.routeDefects` with owner, gate and release-blocking mark, and `validateGate0` fails if the matrix and the classification disagree.

### Capability lock integrity

The independent lock no longer relies on a hand-edited id list. Each id is justified by exactly one of: the anchor matrix read from git at `2247978bd642a89a7d4f8bd720b978f789cb4437`; a `checkpoints` entry (the lock read from git at an accepted commit, here `6dcc66d29`, whose ids can never be dropped without a versioned retirement); or an `additions` record naming the capability, the frozen tranche, that tranche's operations hash, the number of operations the tranche classified to it and a reason. The validator recomputes the count from the frozen tranche files, requires an existing implementation source file in the matrix, and refuses an addition that owns no classified operation. `lockVersion` is derived (1 plus checkpoints plus distinct addition tranches, now 3). `ue-gate0-update-lock.mjs` is the only writer and is deterministic and idempotent; a hand edit that adds an id fails the validator. The lock holds 74 ids.

### New validator checks

`validateClassification4` is part of `validateGate0`. It applies the shared record rules and adds the tranche freeze against the anchored register, the carry-forward operation, preservation of every earlier classification, decision and defect, the provenance proof above, and a ledger entry for every classification. `resolvedLater` is now derived from the ledger, so a tranche's own file does not need to change when a later tranche resolves one of its unresolved operations. The matrix pins the sha256 of the Gate 0B.4 files.

### Historical tests

The Gate 0B.1, 0B.2 and 0B.3 suites now build their validator input from the ownership register and ledger at the commit that accepted each tranche (`ue-gate0-history.mjs` reads them with `git show`), so each keeps proving the counts, identities and classifications it was accepted with. A later tranche cannot change what an earlier suite proves. Where an assertion read the current register and was only true at acceptance, it was split: the historical suite asserts the number at its commit and that the current register preserved every owner and never reverted; `ue-gate0-cumulative.test.mjs` is the one suite that asserts the moving totals. The one exception is the 0B.2 unregistered-exposure check, which now perturbs the Gate 0B.4 classification because the validator reads the exposure registry from the latest tranche; the invariant (an unregistered exposure returns as a blocker) is unchanged.

## Gate 0B.5: fifth route-classification tranche

Scope: the Gate 0 route inventory only. No application route, service, schema, migration, security allowlist, census item or persona baseline changed. No defect was repaired. `pnpm test:fast`, VS Code, the broader regression suite, native PostgreSQL, Docker and credentialed browser suites were not run. Phase 3B and Gate 1 did not start.

Ownership is accountability, not authorization. No record in this tranche is authorized by a kernel decision: 97 are `ROLE_FLOOR`, 3 are `EXTERNAL_TRUST` (token or link holders, no session), and all record `kernelAuthorization` false.

Tranche: `GATE-0B.5`, version 1, frozen in `ue-route-tranche-0b5-manifest.json` with an operations hash (`5143d4bb…`) and a `versionLog`. It is the four carbon operations Gate 0B.4 left `SCOPE_UNDECIDED` (`carryForward`) plus the next 96 previously unexamined `SCOPE_UNDECIDED` operations in ascending code-unit order of `<route>|<METHOD>` at anchor commit `64d45940c34890eef41cc86c017d99b484dbf71c` (`newOperations`, `cnesst/pay-equity/[id]/route.ts|DELETE` through `communications/unsubscribe/[recipientId]/route.ts|GET`). The validator recomputes the new set from the anchored register, rejects any operation an earlier tranche already examined, and rejects a changed membership or order unless a new version carries a reason and the new hash.

Result: 100 examined, 96 classified with source evidence, 4 left `SCOPE_UNDECIDED`. The register now holds 826 `OWNED` and 681 `SCOPE_UNDECIDED` (previously 730 and 777). All 1644 operations are preserved, the 231-entry schema census is untouched, the Gate 0B.1 to 0B.4 manifests and classifications are byte-identical to the commits that accepted them, and no previously classified operation reverted. The ledger grew from 375 to 471 classified operations.

### The four carry-forward operations

`carbon/dashboard` GET, `carbon/infrastructure` GET and `carbon/validate` GET and POST stay unresolved under the catch-all `UE-OMIT-ROUTE-DOMAIN-SCOPE` and `UE-INST-CARBON-ACCOUNTING-SCOPE` stays `OUTSTANDING`. Gate 0B.5 does not decide it. It records what the institution has to decide, so the four operations stop being an unexplained residue:

- `scopeDisposition`: `RETAIN_AS_UNAPPROVED_CAPABILITY_CANDIDATE`, `adopted` false. The routes are kept as a candidate for a capability the institution has not approved. Retaining them confers nothing.
- Three options, none chosen: the platform operator owns carbon accounting, an organization owns it, or the routes are retired. The record states that neither ownership option justifies access to the current handlers.
- `implementationObligation`: gate 8, held by `UE-CAP-H-001`. Until the decision is made, the handlers that return literal figures and a certification-shaped result for caller-supplied data must return 501 and not 200, and that does not close the institutional decision.

The validator rejects a disposition that is adopted, that cites no decision, that offers fewer than two options or marks one chosen, that lacks the no-access statement, that carries no obligation or puts it on another capability or gate, that uses adoption wording, or that is attached to a classified record.

### The next 96 operations

| Group | Operations | Owner |
| --- | --- | --- |
| Pay equity exercises (collection and item) | 5 | `UE-OMIT-PAY-EQUITY-EXERCISES` (new) |
| CNESST preventive withdrawals | 5 | `UE-OMIT-OHS-REGULATORY-RECORDS` |
| CNESST right of refusal | 5 | `UE-OMIT-OHS-REGULATORY-RECORDS` |
| Cognition derived analytics (cases risk, engagement, executive summary, KPIs, precedents, workload) | 6 | `UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION` |
| Cognition health | 1 | `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` |
| Committee records | 5 | `UE-OMIT-COMMITTEE-WORKSPACE` (new) |
| Committee meetings, attendance and minutes | 8 | `UE-OMIT-COMMITTEE-WORKSPACE` (new) |
| Committee action items | 3 | `UE-OMIT-COMMITTEE-WORKSPACE` (new) |
| Committee documents | 2 | `UE-OMIT-COMMITTEE-WORKSPACE` (new) |
| Committee intelligence | 2 | `UE-OMIT-COMMITTEE-WORKSPACE` (new) |
| Communications campaigns | 14 | `UE-OMIT-COMMUNICATIONS-CAMPAIGN-AUTHORING` (new) |
| Communications templates | 8 | `UE-OMIT-COMMUNICATIONS-CAMPAIGN-AUTHORING` (new) |
| Distribution lists and subscribers | 7 | `UE-OMIT-COMMUNICATIONS-CAMPAIGN-AUTHORING` (new) |
| SMS messages, campaigns and conversations | 8 | `UE-OMIT-COMMUNICATIONS-SMS` (new) |
| Tracking pixel, click redirect and unsubscribe | 3 | `UE-OMIT-COMMUNICATIONS-TRACKING-AND-UNSUBSCRIBE` (new) |
| Member polls | 6 | `UE-OMIT-MEMBER-POLLS-AND-SURVEYS` (new) |
| Member surveys | 8 | `UE-OMIT-MEMBER-POLLS-AND-SURVEYS` (new) |

Ownership is by exact route file. A route prefix or an HTTP method never decides ownership. Cognition operations whose repair gate is 9 are owned by the platform operator capability; the others by the analytics authorization capability. The three communications tracking and unsubscribe operations are `EXTERNAL_TRUST` (a signed token, no session) and are `GET` operations that write: the open and click routes update the message log and campaign counters, and the unsubscribe route updates the message log, upserts the recipient preference and inserts a revoked consent record in separate statements. The validator rejects a read that writes with no audit record and cites no write, so each is recorded with its mutation quotes and a `mutationAudit` of `NONE`. The poll and survey groups carry three CRUD governance classes: `OPERATIONAL`, `READ_ONLY` (polls) and `DENIED` (poll votes).

`UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER` stays `OUTSTANDING`. Gate 0B.5 adds two software owner candidates to it (authoring, and consent and unsubscribe). It does not decide who owns newsletter campaigns. The classification file holds eight `OUTSTANDING` decisions and none is adopted.

Every record adds `callers`, a `callerFinding`, a `requiredAudit` statement and `dependencyGates`, as in Gate 0B.3. 65 operations have at least one caller; 35 have none and the finding says so.

### Evidence provenance

The Gate 0B.4 provenance rules apply to every record (`ue-gate0b4-provenance.mjs`). The 1,014 evidence items are 272 `ROUTE_HANDLER_DIRECT`, 491 `ROUTE_IMPORTED_HELPER`, 14 `SERVICE_IMPLEMENTATION` and 237 `SCHEMA_OR_POLICY`; 28 non-material inferences are recorded apart from the evidence list. All 100 records pass the provenance rules against the live source. Gate 0B.5 also treats `writeFileSync` and `writeRecord(` as writes when it checks a read for an undeclared mutation, since the cognition snapshots write to local files and not to the database.

### New capabilities (6)

Each is narrowly defined, has a stable id, source evidence, one primary gate and dependency gates, owns at least one classified operation, and has an addition record in the independent capability lock. None was added to reduce an undecided count. Four existing capabilities were reused: `UE-OMIT-OHS-REGULATORY-RECORDS`, `UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION`, `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` and `UE-CAP-H-001`.

| Capability | Primary gate | Dependencies | Status |
| --- | --- | --- | --- |
| `UE-OMIT-PAY-EQUITY-EXERCISES` | 6 | 2, 13 | `PARTIAL` |
| `UE-OMIT-COMMITTEE-WORKSPACE` | 14 | 1, 6 | `PARTIAL` |
| `UE-OMIT-COMMUNICATIONS-CAMPAIGN-AUTHORING` | 11 | 9, 14 | `PARTIAL` |
| `UE-OMIT-COMMUNICATIONS-SMS` | 11 | 9, 14 | `PARTIAL` |
| `UE-OMIT-COMMUNICATIONS-TRACKING-AND-UNSUBSCRIBE` | 11 | 9, 14 | `PARTIAL` |
| `UE-OMIT-MEMBER-POLLS-AND-SURVEYS` | 14 | 6, 13 | `PARTIAL` |

### Defects

The 136 earlier defects are preserved verbatim. Gate 0B.5 adds 42 (4 high, 27 medium, 11 low), each with one responsible capability whose primary gate equals the repair gate (the validator checks this and that a classification cites it), and none repaired. By repair gate: Gate 14 holds 21, Gate 11 holds 15, Gate 6 holds 4, Gate 8 holds 1 (`UE-CAP-H-001`, carbon) and Gate 9 holds 1 (`UE-OMIT-PLATFORM-OPERATOR-CONTROLS`, cognition health). The four high defects are: preventive withdrawals and refusals without case authority (`DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY`), cognition snapshots kept in local files (`DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES`), survey responses that identify respondents to stewards (`DEF-0B5-SURVEY-RESPONSES-IDENTIFY-RESPONDENTS-TO-STEWARDS`), and survey results with no organization predicate that load every answer (`DEF-0B5-SURVEY-RESULTS-NO-ORG-PREDICATE-LOADS-ALL-ANSWERS`). No operation records `crossTenantExposure`, and no new defect is release blocking: the three unjustified exposures keep their registered release-blocking mark and contract hashes.

The 178 defects are listed in `matrix.routeDefects` with owner, gate and release-blocking mark, and `validateGate0` fails if the matrix and the classification disagree.

### Capability lock integrity

The independent lock now holds 12 addition records since its Gate 0B.3 checkpoint: six from Gate 0B.4 and six for the new Gate 0B.5 capabilities (the four reused capabilities are not added again). Each addition names the frozen tranche, its operations hash and the count of operations it owns, and the validator recomputes both from the frozen tranche files. `lockVersion` is derived (now 4). The lock was produced only by `ue-gate0-update-lock.mjs`, which is deterministic and idempotent. It holds 80 ids.

### New validator checks

`validateClassification5` is part of `validateGate0`. It applies the shared record rules and the Gate 0B.4 provenance rules, and adds the tranche freeze against the anchored register, the four carry-forward operations and their scope disposition, preservation of every earlier classification, decision (with its software owners) and the 136 defects unaltered, a ledger entry for every classification, and that the four evidence-gap operations remain `SCOPE_UNDECIDED` in the ownership register. The matrix pins the sha256 of the Gate 0B.5 files.

### Historical tests

The Gate 0B.4 suite is anchored to the Gate 0B.4 commit, as the 0B.1 to 0B.3 suites are. Where an assertion read the current register and was only true at acceptance, it is split: the historical suite asserts the number at its commit and that the current register preserved every owner and never reverted. `ue-gate0-cumulative.test.mjs` is the one suite that asserts the moving totals.

## Gate 0B.6: sixth route-classification tranche

Inventory only. No application source, migration, allowlist or census change.

### Inventory totals

The 1,644 operations now report in six separate classes that sum to 1,644. Operations that were inspected and wait on an institutional decision are no longer mixed with operations nobody has examined.

| Class | Operations |
| --- | --- |
| `OWNED` | 926 |
| `SCOPE_UNDECIDED`, awaiting source classification | 577 |
| `DECISION_BOUND_SCOPE_EXCEPTION` | 4 |
| `RETIRED_501` | 97 |
| `STUB_501` | 31 |
| `SYSTEM` | 9 |

The raw `SCOPE_UNDECIDED` count in the ownership register is 581 (577 awaiting classification plus the 4 exceptions). Of the 1,644, 571 operations are classified.

### Tranche freeze

Tranche `GATE-0B.6`, version 1, frozen in `ue-route-tranche-0b6-manifest.json` with operations hash `0447fff9829a7b19ebf64fd329fe24e19e053a0fe0fd714f9499d82a2e3dd385` and a `versionLog`. Anchor commit `00de050b86e1014854e38fc34f51b4c7c85ed747`. It holds exactly 100 previously unexamined operations in ascending code-unit order of `<route>|<METHOD>`, `communications/webhooks/resend/route.ts|POST` through `enterprise/integrations/route.ts|GET`, and records the provenance of all five earlier tranches. It carries nothing forward. The validator recomputes the selection from the anchored register, rejects a duplicate, an operation an earlier tranche examined, a decision-bound exception, a changed membership or order, and a changed hash without a new version and reason.

### Decision-bound exceptions (4)

`carbon/dashboard` GET, `carbon/infrastructure` GET, `carbon/validate` GET and `carbon/validate` POST were examined in Gate 0B.4 and again in Gate 0B.5. The available evidence is exhausted: no source names a data owner, a measured data source or a persona. They are recorded in `ue-route-decision-bound-exceptions.json` as `DECISION_BOUND_SCOPE_EXCEPTION`, tied to the outstanding `UE-INST-CARBON-ACCOUNTING-SCOPE`. This is an inventory disposition and not a product decision. The operations are not `OWNED`, not adopted, not authorized, and not validated; carbon figures and neutrality claims remain unsupported, and the Gate 8 containment obligation holds whichever way the decision goes. They were not selected for source investigation in this tranche. Their Gate 0B.4 and Gate 0B.5 classification records are unchanged and pinned by sha256 in the register. The validator rejects converting an exception to an adopted, authorized or production-ready capability without an independent decision record, and rejects a later tranche that re-examines one.

### The 100 operations

All 100 are classified with a handler, method, domain, canonical engineering capability, ownership, actual and required authentication and authorization, tenant boundary, privacy, mutation and audit behavior, dependencies, caller evidence and a repair gate. None is unresolved. No capability was invented to reduce the undecided count: 46 operations reuse an existing capability owner and 6 new capabilities own the other 54.

| Domain | Operations |
| --- | --- |
| Education and content library | 31 |
| Employer relations, payroll and remittance | 21 |
| Compliance, contracts, political action and dispatch | 27 |
| System, webhooks, cron and continuity | 21 |

### New capabilities (6)

All have primary gate 14, status `PARTIAL`, and a route owner. Each is an engineering owner for existing source and not an adoption of a business scope.

| Capability | Operations |
| --- | --- |
| `UE-OMIT-EDUCATION-AND-TRAINING-RECORDS` | 28 |
| `UE-OMIT-CONTENT-LIBRARY-EDITORIAL` | 3 |
| `UE-OMIT-EMPLOYER-RELATIONS-RECORDS` | 9 |
| `UE-OMIT-COMPLIANCE-ASSURANCE` | 5 |
| `UE-OMIT-COPE-POLITICAL-ACTION` | 6 |
| `UE-OMIT-DISPATCH-HALL` | 3 |

### Institutional decisions

Six new outstanding decisions, none adopted: `UE-INST-EDUCATION-TRAINING-RECORD-READERS`, `UE-INST-EDUCATION-CERTIFICATION-ISSUING-AUTHORITY`, `UE-INST-DISPATCH-AUTHORITY`, `UE-INST-COMPLIANCE-DETERMINATION-AUTHORITY`, `UE-INST-POLITICAL-DATA-HANDLING` and `UE-INST-BUSINESS-CONTINUITY-RECORDS-OWNER`. The 14 decisions are all `OUTSTANDING`. A missing mandate did not prevent an engineering owner; each decision keeps its software owner candidates.

### Defects

The 178 earlier defects are preserved verbatim. Gate 0B.6 adds 98 (14 high, 62 medium, 22 low), 276 in total, each with one responsible capability whose primary gate equals the repair gate, and none repaired. By repair gate: Gate 14 holds 63, Gate 5 holds 14, Gate 6 holds 7, Gate 11 holds 6, Gate 9 holds 3, Gate 10 holds 3, Gate 1 holds 1 and Gate 13 holds 1. The 14 high defects:

- Education: item facades rewrite or hard-delete a course by path id; completions POST skips registration checks; a member sets completion, fee and approval fields on a registration; a certification is issued without completion or verification; cron queries reference columns absent from the schema.
- Employer: remittance detail exposes pay at the member floor; replay has no financial mandate.
- Compliance: contract creation accepts unverified references; `compliance/validate` attests from caller-supplied data; dispatch assignment inserts unverified ids.
- System: inheritance organization scoping is a no-op over `pending_profiles`; location retention has no scheduler in the repository; the observability sweep records email success without sending; the SLA watchdog emits events no one subscribes to.

Other findings recorded as defects: a debug route ships to production, stats and alerts return zeros or an empty list when a read fails, the resend webhook drops events with no delivery-log row, `contact` stores nothing and answers success, cron GET aliases run state-changing jobs, and the edge cron secret check differs from the route check. No operation records `crossTenantExposure`, and no new defect is release blocking. The three unjustified exposures keep their registered release-blocking mark and contract hashes.

### Evidence provenance

The Gate 0B.4 provenance rules apply to every record. The 1,354 evidence items are 480 `ROUTE_HANDLER_DIRECT`, 442 `ROUTE_IMPORTED_HELPER`, 185 `SERVICE_IMPLEMENTATION` and 247 `SCHEMA_OR_POLICY`; 138 non-material inferences are recorded apart from the evidence list. A quote tagged for the wrong method is refused.

### Capability lock integrity

The lock holds 86 ids and 18 addition records (the six new Gate 0B.6 capabilities each name the frozen tranche, its operations hash and the count of operations owned). `lockVersion` is derived (now 5) and only `ue-gate0-update-lock.mjs` writes the lock.

### New validator checks

`validateClassification6` and `validateDecisionBoundExceptions` are part of `validateGate0`. They add the tranche freeze against the anchored register, rejection of earlier-examined and decision-bound operations, preservation of every earlier classification, decision and defect, the six-way inventory total, and the exception register pins. The matrix pins the sha256 of the Gate 0B.6 files and the exception register.

### Historical tests

The Gate 0B.5 suite is anchored to its accepted commit. `ue-gate0-cumulative.test.mjs` asserts the moving totals.

## Gate 0B.7: seventh route-classification tranche

Inventory only. No application source, migration, allowlist or census change. The 0B.1 to 0B.6 manifests, classifications and decision-bound exception register are byte-identical to the commits that accepted them.

### Inventory totals

| Class | Operations |
| --- | --- |
| `OWNED` | 1026 |
| `SCOPE_UNDECIDED`, awaiting source classification | 477 |
| `DECISION_BOUND_SCOPE_EXCEPTION` | 4 |
| `RETIRED_501` | 97 |
| `STUB_501` | 31 |
| `SYSTEM` | 9 |

The six classes sum to 1,644 and no class was added. The raw `SCOPE_UNDECIDED` count in the ownership register is 481 (477 awaiting classification plus the 4 exceptions). 671 operations are classified.

### Tranche freeze

Tranche `GATE-0B.7`, version 1, frozen in `ue-route-tranche-0b7-manifest.json` with operations hash `537d1362228dfe64c29e96f531652f2de7a4c8c19a8d10be632d96a633c52f03` and a `versionLog`. Anchor commit `cab380c61301152b604f4161d00d14ce81584045` (the accepted Gate 0B.6 state). It holds exactly 100 previously unexamined operations in ascending code-unit order of `<route>|<METHOD>`, `enterprise/integrations/route.ts|POST` through `external/documents/[id]/download/route.ts|GET`, and records the provenance of all six earlier tranches. It carries nothing forward. The GET of `enterprise/integrations` was classified in Gate 0B.6, so only its POST is selected here. No selected operation appears in an earlier tranche or in the decision-bound exception register; the validator recomputes the selection from the anchored register.

### Decision-bound exceptions (4)

Unchanged. The four carbon operations stay `DECISION_BOUND_SCOPE_EXCEPTION`, tied to the outstanding `UE-INST-CARBON-ACCOUNTING-SCOPE`. They were not selected, not re-examined and not converted to `OWNED`; none is adopted, authorized, operationally approved or production ready. `ue-route-decision-bound-exceptions.json` is byte-identical to the Gate 0B.6 acceptance.

### The 100 operations

All 100 are classified with a handler, method, domain, canonical engineering capability, ownership, actual and required authentication and authorization, tenant boundary, privacy, mutation and audit behavior, dependencies, caller evidence and a repair gate. None is unresolved. No capability was invented to reduce the undecided count: 33 operations reuse an existing capability owner and 4 new capabilities own the other 67.

| Area | Operations |
| --- | --- |
| Exit interviews and the cognition analytics under them | 64 |
| Export suite, evidence pack and external representative documents | 17 |
| Enterprise integrations, SSO, entitlements, equity and calendar events | 19 |

Mutation and audit characterization of the 100: 68 not mutating, 28 atomic audit in the transaction, 3 writes refused by CRUD governance, 1 separate audit event that is not atomic (`external/documents/[id]/download` GET, which also corrects the manifest `mutating` field). No operation records `crossTenantExposure`.

### New capabilities (4)

All have primary gate 14, status `PARTIAL` and a route owner. Each is an engineering owner for existing source and not an adoption of a business scope.

| Capability | Operations | Why the catalog could not own the work |
| --- | --- | --- |
| `UE-OMIT-EXIT-INTERVIEW-KNOWLEDGE-TRANSFER` | 13 | No existing capability holds the exit-interview record, document, governance, publication, search and template tables. |
| `UE-OMIT-EXIT-INTERVIEW-COGNITION-ANALYTICS` | 46 | The derived analytics, memory profiles, graphs and forecasts read exit-interview text and no existing capability owns derived analytics. |
| `UE-OMIT-ENTERPRISE-SSO-IDENTITY-PROVIDERS` | 2 | No capability owns identity-provider registration and its stored configuration. |
| `UE-OMIT-EQUITY-SELF-IDENTIFICATION` | 6 | No capability owns member self-identification and equity monitoring. |

The other 33 operations reuse `UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS` (14), `UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION` (12), `UE-OMIT-AI-ADVISORY-GOVERNANCE` (5), `UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING` (1) and `UE-CAP-F-002` (1).

### Institutional decisions

Six new outstanding decisions, none adopted: `UE-INST-EXIT-INTERVIEW-RECORD-READERS`, `UE-INST-EXIT-INTERVIEW-DERIVED-ANALYTICS-READERS`, `UE-INST-EXIT-INTERVIEW-DERIVED-ANALYTICS-AUDIENCE`, `UE-INST-EXIT-INTERVIEW-MODEL-PROCESSING-CONSENT`, `UE-INST-EQUITY-DATA-STEWARD` and `UE-INST-IDENTITY-FEDERATION-ADMINISTRATOR`. The 20 decisions are all `OUTSTANDING`.

### Defects

The 276 earlier defects are preserved verbatim. Gate 0B.7 adds 93 (13 high, 61 medium, 19 low), 369 in total, each with one responsible capability whose primary gate equals the repair gate, and none repaired. By repair gate: Gate 14 holds 91 and Gate 6 holds 2.

### Release dispositions for HIGH defects

Severity says how bad a defect is. A release disposition says whether the product may ship with it, and depends on actual exposure, potential impact, activation state and existing containment. From Gate 0B.7 on, every HIGH defect records one of `RELEASE_BLOCKING`, `CONDITIONALLY_BLOCKING` or `NON_BLOCKING_WITH_JUSTIFICATION`, and the validator checks it against the source: the activation evidence and any containment must quote real lines, a `NON_BLOCKING_WITH_JUSTIFICATION` needs a verified containment and cannot cover cross-tenant impact, unauthenticated reach, or wide authenticated reach with a mutation, financial, false-attestation or privacy impact, and a justification that rests on the inventory phase is refused. Being found in an inventory-only phase is never a ground for a lower disposition.

The 13 new HIGH defects: 4 `RELEASE_BLOCKING`, 9 `CONDITIONALLY_BLOCKING`, 0 `NON_BLOCKING_WITH_JUSTIFICATION`.

- `RELEASE_BLOCKING`: `DEF-0B7-EXC-READS-IGNORE-SENSITIVITY-LEVEL`, `DEF-0B7-EXC-PUBLISH-AND-INDEX-COPY-INTERVIEW-TEXT-TO-ORG-WIDE-KNOWLEDGE-BASE`, `DEF-0B7-COGA-CROSS-DOMAIN-CORRELATIONS-ARE-FIXED-LITERALS`, `DEF-0B7-COGB-PRECEDENT-AND-PROCEDURAL-ENGINES-RETURN-CONSTANT-CONTENT-AS-ORGANIZATION-ANALYSIS`.
- `CONDITIONALLY_BLOCKING`: consent withdrawal that withdraws nothing derived, publish sending interviews to the model without a consent gate or audit, canned scenario simulation, derived aggregates and graphs that ignore interview sensitivity, fixed-rate forecasts, succession sending every published interview to the model, hard-coded evidence-pack attestations, and the extensions item read that returns credentials. Each states its blocking condition.

The four `RELEASE_BLOCKING` dispositions enter gate-acceptance debt as kind `RELEASE_BLOCKING_DEFECT_DISPOSITION`, next to the three release-blocking route exposures. Each disposition is hand-authored from the source and is a judgment that the independent review should test; none depends on an operation's `crossTenantExposure` flag.

### HIGH defects of Gate 0B.1 to Gate 0B.6: review queue

The 71 HIGH defects found by the earlier tranches carry no disposition and are frozen. They are not rewritten. `ue-release-disposition-review-queue.json` lists all 71, each with its original severity, its original release-blocking mark and the sha256 of the frozen record, and leaves the disposition empty until an independent qualification records one. None of the 71 was recorded as release blocking and none is relabelled or downgraded here. The queue is not a disposition and does not say that any of them is non-blocking. The validator refuses a missing entry, a changed hash, a changed severity or mark, a pre-assigned disposition, and a disposition written into a frozen defect.

### Evidence provenance

The Gate 0B.4 provenance rules apply to every record. The 1,493 evidence items are 408 `ROUTE_HANDLER_DIRECT`, 444 `ROUTE_IMPORTED_HELPER`, 377 `SERVICE_IMPLEMENTATION` and 264 `SCHEMA_OR_POLICY`; 145 non-material inferences are recorded apart from the evidence list.

### Capability lock integrity

The lock holds 90 ids and 22 addition records (the four new Gate 0B.7 capabilities each name the frozen tranche, its operations hash and the count of operations owned). `lockVersion` is derived (now 6) and only `ue-gate0-update-lock.mjs` writes the lock. The provenance check recognizes the seventh tranche.

### New validator checks

`validateClassification7` is part of `validateGate0`. It adds the tranche freeze against the anchored register, the shared record rules, preservation of every earlier classification, decision and defect, the release-disposition control, and the review-queue check. The matrix pins the sha256 of the Gate 0B.7 manifest, classification and review queue. The Gate 0B.4 provenance check now also recognizes a plain `export function` as a function boundary.

### Historical tests

The Gate 0B.6 suite is anchored to the Gate 0B.6 acceptance commit for every moving total. `ue-gate0-cumulative.test.mjs` asserts the moving totals.

## Gate 0B.8: eighth route-classification tranche

Inventory only. No application source, migration, allowlist or census change. The 0B.1 to 0B.7 manifests, classifications, the review queue and the decision-bound exception register are byte-identical to the commits that accepted them.

### Inventory totals

| Class | Operations |
| --- | --- |
| `OWNED` | 1126 |
| `SCOPE_UNDECIDED`, awaiting source classification | 377 |
| `DECISION_BOUND_SCOPE_EXCEPTION` | 4 |
| `RETIRED_501` | 97 |
| `STUB_501` | 31 |
| `SYSTEM` | 9 |

The six classes sum to 1,644 and no class was added. The raw `SCOPE_UNDECIDED` count in the ownership register is 381 (377 awaiting classification plus the 4 exceptions). 771 operations are classified. Exactly 100 operations moved from awaiting to owned: `meeting-rooms/[id]/bookings/route.ts` is split, so its group names only `DELETE` and `GET` and its `PATCH` stays awaiting; the validator now refuses any Gate 0B.8 ownership rule that owns an operation outside the frozen hundred.

### Tranche freeze

Tranche `GATE-0B.8`, version 1, frozen in `ue-route-tranche-0b8-manifest.json` with operations hash `6b878d9c7abb599f60eae09713099d0e8f6b52aaaae6bdd3c0b1a6c3bcb136af` and a `versionLog`. Anchor commit `32ae5951ef08eefecae73c0e08c88a70f184026d` (the accepted Gate 0B.7 state). It holds exactly 100 never-examined operations in ascending code-unit order of `<route>|<METHOD>`, `external/documents/[id]/route.ts|GET` through `meeting-rooms/[id]/bookings/route.ts|GET`, and records the provenance of all seven earlier tranches. It carries nothing forward and excludes the four decision-bound exceptions. No selected operation appears in an earlier tranche; the validator recomputes the selection from the anchored register.

### Decision-bound exceptions (4)

Unchanged. The four carbon operations stay `DECISION_BOUND_SCOPE_EXCEPTION`, tied to the outstanding `UE-INST-CARBON-ACCOUNTING-SCOPE`. None was selected, re-examined or converted to `OWNED`, and none is adopted, authorized, operationally approved or production ready.

### The 100 operations

All 100 are classified. None is unresolved. No capability was invented to reduce the undecided count: 60 operations reuse an existing capability and 3 new capabilities own the other 40.

| Area | Operations |
| --- | --- |
| Health and safety records, statistics and dashboard | 24 |
| ICRA public assessment, rewards redemption and the integration control plane | 22 |
| Federations, locals, external representative access and feature flags | 29 |
| Jurisdiction rules, labour standards, knowledge base, location, health and welfare, meeting rooms | 25 |

Mutation and audit characterization of the 100: 44 not mutating, 25 atomic audit in the transaction, 14 writes refused by CRUD governance, 11 with no audit, 3 separate audit events that are not atomic (the three external-representative GETs, which also correct the manifest `mutating` field), 2 atomic for the local part only (the ICRA report review and the Shopify webhook) and 1 intent and outcome audit that is not atomic (the integration sync). Authorization: 72 role floors, 11 session only, 11 external trust and 6 public. No operation records kernel authorization.

Two operations record `crossTenantExposure` (the knowledge-base list and item reads, which return organization-wide copies of exit-interview text and ignore the access columns). Both are unauthorized, each carries the Gate 0B.7 publication defect and a Gate 0B.8 defect, and neither is recorded as authorized.

### New capabilities (3)

All have primary gate 14, status `PARTIAL` and a route owner. Each is an engineering owner for existing source and not an adoption of a business scope.

| Capability | Operations | Why the catalog could not own the work |
| --- | --- | --- |
| `UE-OMIT-FEDERATION-LOCAL-HIERARCHY` | 24 | No existing capability owns federation or local structure; the routes are facades over the federations and bargaining-unit tables. |
| `UE-OMIT-ICRA-PUBLIC-ASSESSMENT` | 14 | No existing capability names the pseudonymous ICRA product, its capability exchange, claim, checkout and report. |
| `UE-OMIT-REWARDS-REDEMPTION-FULFILMENT` | 2 | No existing capability names reward redemptions or the Shopify provider webhook. |

The other 60 operations reuse `UE-OMIT-OHS-REGULATORY-RECORDS` (24), `UE-OMIT-COMPLIANCE-ASSURANCE` (8), `UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS` (8), `UE-OMIT-PRIVACY-RIGHTS` (6), `UE-CAP-F-002` (4), `UE-OMIT-FINANCE-UNAVAILABLE` (2), `UE-OMIT-AI-ADVISORY-GOVERNANCE` (2), `UE-CAP-K-010` (2), `UE-OMIT-EXIT-INTERVIEW-KNOWLEDGE-TRANSFER` (2), `UE-OMIT-PLATFORM-OPERATOR-CONTROLS` (1) and `UE-OMIT-AUDIT-LOG-VISIBILITY` (1).

### Institutional decisions

Ten new outstanding decisions, none adopted: `UE-INST-OHS-INCIDENT-RECORD-READERS`, `UE-INST-OHS-ANONYMOUS-REPORT-IDENTITY`, `UE-INST-ICRA-PSEUDONYMOUS-DATA-LIFECYCLE`, `UE-INST-ICRA-REPORT-REVIEW-AUTHORITY`, `UE-INST-ICRA-PAID-ASSESSMENT-CLAIM-AUTHORITY`, `UE-INST-INTEGRATION-CONTROL-PLANE-AUTHORITY`, `UE-INST-REWARDS-REDEMPTION-PROVIDER-AUTHORITY`, `UE-INST-FEDERATION-AFFILIATE-DATA-SHARING`, `UE-INST-EXTERNAL-REPRESENTATIVE-DOCUMENT-DEPOSIT` and `UE-INST-MEMBER-LOCATION-PROCESSING`. The 30 decisions are all `OUTSTANDING`.

### Defects

The 369 earlier defects are preserved verbatim. Gate 0B.8 adds 82 (12 high, 50 medium, 20 low), 451 in total, each with one responsible capability whose primary gate equals the repair gate, and none repaired. By repair gate: Gate 14 holds 46, Gate 6 holds 31, Gate 9 holds 2 and Gates 4, 5 and 13 hold 1 each.

### Release dispositions for HIGH defects

The 12 new HIGH defects: 4 `RELEASE_BLOCKING`, 8 `CONDITIONALLY_BLOCKING`, 0 `NON_BLOCKING_WITH_JUSTIFICATION`. The same control as Gate 0B.7 applies: activation evidence and containment must quote real lines, a phase excuse is refused, and `NON_BLOCKING_WITH_JUSTIFICATION` cannot cover cross-tenant, unauthenticated or wide authenticated harm.

- `RELEASE_BLOCKING`: `DEF-0B8-HS-INCIDENT-ITEM-READ-MEMBER-FLOOR-WHOLE-ROW` (any member reads the whole incident row, including injured-person detail), `DEF-0B8-HS-ANONYMOUS-REPORTER-STAMPED-IN-CREATED-BY` (an anonymous report is attributed to the session user), `DEF-0B8-HS-DASHBOARD-TRAINING-COMPLIANCE-IS-A-CONSTANT` (a constant presented as a compliance rate), `DEF-0B8-ICRA-PAID-PDF-REPORT-GATE-REQUIRES-STATUS-COMPLETED-NO-WRITER` (a sold report that no code path can deliver).
- `CONDITIONALLY_BLOCKING`: the incident create normalization, the dashboard that answers success with clean metrics on failure, the trends route that takes the organization from the query, the Shopify discount code that cannot match its extractor (`SHOPIFY_ENABLED` defaults to false), the external upload that attaches any organization blob, the workers' compensation deadline served as an arbitration deadline, the British Columbia termination schedule with no tier above eight years, and the geofence GET that stores coordinates with no consent check. Each states its blocking condition.

The four Gate 0B.7 `RELEASE_BLOCKING` dispositions are preserved and the four above join them: gate-acceptance debt now carries eight `RELEASE_BLOCKING_DEFECT_DISPOSITION` entries. The validator refuses a Gate 0B.7 disposition that is altered, removed or downgraded, and a disposition written into a frozen earlier defect. The 71 HIGH defects of Gate 0B.1 to Gate 0B.6 stay in the independent review queue, byte-identical to the Gate 0B.7 acceptance, with no disposition.

### Risk-category screen

Eight recurring defect classes are screened on every operation: sensitive source data reproduced in derived outputs, publication bypassing classification or consent, analytics crossing a parent, child or organizational boundary, row-level security assumed from a plain db client, an audit written outside the data transaction, a GET with side effects, a fabricated institutional finding, and an external system receiving protected information without a disclosure decision. `ue-gate0b8-risk-screen.mjs` computes each trigger from the source (the GET handler text and the recorded mutation, the recorded audit characterization, a shared db import with no context wrapper, an outbound client, and the route path) and requires a defect that carries the category in `riskCategories`, or, for the non-structural categories, a recorded `riskScreen` whose reason is backed by a quote that exists in the cited file. A GET that writes and an audit outside the transaction can be satisfied only by a defect. Defects carrying each category: derived output 3, publication 1, analytics 4, row-level security 4, audit outside the transaction 4, GET side effect 4, fabricated finding 17, external disclosure 1. Six screens record why a triggered category does not apply. A screen is not a security qualification: it says the source shows no harm of that class on that route, not that the route is safe.

### Evidence provenance

The 1,379 evidence items are 462 `ROUTE_HANDLER_DIRECT`, 402 `ROUTE_IMPORTED_HELPER`, 130 `SERVICE_IMPLEMENTATION` and 385 `SCHEMA_OR_POLICY`; 125 non-material inferences are recorded apart from the evidence list. Evidence gaps that stay open: no `icra_events` schema was found by repository search, the shop-domain and edge-header behavior is unproven, whether the row-level-security policy reaches the runtime role is not established, the Django location-tracking viewset is not reachable from the TypeScript import graph, and no application caller of the external-representative routes was found.

### Capability lock integrity

The lock holds 93 ids and 25 addition records (the three new Gate 0B.8 capabilities each name the frozen tranche, its operations hash and the count of operations owned). `lockVersion` is derived (now 7) and only `ue-gate0-update-lock.mjs` writes the lock.

### New validator checks

`validateClassification8` is part of `validateGate0`. It adds the tranche freeze against the anchored register, the shared record rules, preservation of every earlier classification, decision and defect (including the Gate 0B.7 dispositions), the release-disposition control for the new HIGH defects, the review-queue check, the risk-category screen, and the refusal of an ownership rule that owns an operation outside the frozen tranche. The matrix pins the sha256 of the Gate 0B.8 manifest and classification.

### Historical tests

The Gate 0B.7 suite is anchored to the Gate 0B.7 acceptance commit for every moving total (the ownership register, ledger, matrix and lock at that commit). `ue-gate0-cumulative.test.mjs`, `ue-gate0-lock-provenance.test.mjs` and `ue-gate0-scope-lock.test.mjs` assert the moving totals. `ue-gate0b4-classification.test.mjs` changed its drift probe to an owner that no register names.

## Gate 0B.9: ninth route-classification tranche

Inventory only. No application source, migration, allowlist or census change. The 0B.1 to 0B.8 manifests, classifications, the review queue and the decision-bound exception register are byte-identical to the commits that accepted them.

### Inventory totals

| Class | Operations |
| --- | --- |
| `OWNED` | 1226 |
| `SCOPE_UNDECIDED`, awaiting source classification | 277 |
| `DECISION_BOUND_SCOPE_EXCEPTION` | 4 |
| `RETIRED_501` | 97 |
| `STUB_501` | 31 |
| `SYSTEM` | 9 |

The six classes sum to 1,644 and no class was added. The raw `SCOPE_UNDECIDED` count in the ownership register is 281 (277 awaiting classification plus the 4 exceptions). 871 operations are classified. Exactly 100 operations moved from awaiting to owned. The `PATCH` of `meeting-rooms/[id]/bookings/route.ts`, left awaiting by Gate 0B.8, is the first operation of this tranche; the validator keeps refusing any ownership rule that owns an operation outside the frozen hundred.

### Tranche freeze

Tranche `GATE-0B.9`, version 1, frozen in `ue-route-tranche-0b9-manifest.json` with operations hash `eafe16b5f25727c021f48057d0a164dccc0796ca382183008d8d43d65f5cbcc9` and a `versionLog`. Anchor commit `f3d6262b6cbda002b08b06201e6da68e52c9bf21` (the accepted Gate 0B.8 state). It holds exactly 100 never-examined operations in ascending code-unit order of `<route>|<METHOD>`, `meeting-rooms/[id]/bookings/route.ts|PATCH` through `organizations/hierarchy/route.ts|GET`, and records the provenance of all eight earlier tranches. It carries nothing forward and excludes the four decision-bound exceptions. No selected operation appears in an earlier tranche; the validator recomputes the selection from the anchored register.

### Decision-bound exceptions (4)

Unchanged. The four carbon operations stay `DECISION_BOUND_SCOPE_EXCEPTION`, tied to the outstanding `UE-INST-CARBON-ACCOUNTING-SCOPE`. None was selected, re-examined or converted to `OWNED`, and none is adopted, authorized, operationally approved or production ready.

### The 100 operations

All 100 are classified. None is unresolved. No capability was invented to reduce the undecided count: 67 operations reuse an existing capability and 3 new capabilities own the other 33.

| Area | Operations |
| --- | --- |
| Analytics metrics, ML predictions, monitoring, drift, model feedback and the external query, movement insights and bargaining benchmarks | 29 |
| Meeting rooms, member AI feedback, mobile device and push registration, mobile sync and in-app notifications | 23 |
| ICRA assessment aliases (`oci`, `ocra`) and organization onboarding assistance | 27 |
| Organization record, roster, hierarchy, sharing settings and access logs | 21 |

Mutation and audit characterization of the 100: 51 not mutating, 30 atomic audit in the transaction, 9 with no audit, 7 writes refused by CRUD governance, 1 separate audit event that is not atomic (the churn-risk GET, which also writes and corrects the manifest `mutating` field), 1 atomic for the local part only (the SLA breach feedback) and 1 log only (the external natural-language query). Authorization: 73 role floors, 11 session only, 11 external trust and 5 public. No operation records kernel authorization. 63 operations have no caller in tracked product source.

Nine operations record `crossTenantExposure`: `metrics/operational`, `onboarding/peer-benchmarks`, `onboarding/suggest-clauses`, and the organization `analytics`, `children`, `descendants`, `path`, item `GET` and `hierarchy` reads. All nine are unauthorized, each cites a defect that records the cross-tenant impact, and none is recorded as authorized. A new validator control (see below) refuses a record that cites such a defect without setting the flag.

### New capabilities (3)

Each has status `PARTIAL` and a route owner, and is an engineering owner for existing source and not an adoption of a business scope.

| Capability | Primary gate | Operations | Why the catalog could not own the work |
| --- | --- | --- | --- |
| `UE-OMIT-MOBILE-DEVICES-AND-IN-APP-NOTIFICATIONS` | 11 | 18 | No existing capability names the member notification inbox or the device registry. |
| `UE-OMIT-ORGANIZATION-ONBOARDING` | 14 | 6 | No existing capability names the onboarding assistance routes. |
| `UE-OMIT-ORGANIZATION-ADMINISTRATION` | 14 | 9 | No existing capability owns the organization record or the roster. |

The other 67 operations reuse `UE-OMIT-AI-ADVISORY-GOVERNANCE` (20), `UE-OMIT-ICRA-PUBLIC-ASSESSMENT` (17), `UE-OMIT-CLAUSE-LIBRARY-SHARING` (6), `UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION` (5), `UE-OMIT-FEDERATION-LOCAL-HIERARCHY` (5), `UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING` (4), `UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS` (3), `UE-CAP-K-007` (2), `UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY` (2), `UE-OMIT-BARGAINING-RECORDS` (2) and `UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION` (1).

### Institutional decisions

Nine new outstanding decisions, none adopted: `UE-INST-ML-MEMBER-RISK-SCORING`, `UE-INST-ML-EXTERNAL-QUERY-DISCLOSURE`, `UE-INST-MEMBER-NOTIFICATION-SENDERS-AND-DEVICES`, `UE-INST-ONBOARDING-CROSS-ORGANIZATION-DISCLOSURE`, `UE-INST-ONBOARDING-RECOMMENDATION-BASIS`, `UE-INST-ONBOARDING-EVENT-AUTHORITY`, `UE-INST-ORGANIZATION-RECORD-AUTHORITY`, `UE-INST-ORGANIZATION-ROSTER-AND-ROLE-GRANT-AUTHORITY` and `UE-INST-ORGANIZATION-SHARING-SETTINGS-AUTHORITY`. The 39 decisions are all `OUTSTANDING`.

### Defects

The 451 earlier defects are preserved verbatim. Gate 0B.9 adds 91 (14 high, 65 medium, 12 low), 542 in total, each with one responsible capability whose primary gate equals the repair gate, and none repaired. By repair gate: Gate 14 holds 77 and Gate 11 holds 14.

### Release dispositions for HIGH defects

The 14 new HIGH defects: 8 `RELEASE_BLOCKING`, 6 `CONDITIONALLY_BLOCKING`, 0 `NON_BLOCKING_WITH_JUSTIFICATION`. The same control as Gate 0B.7 and Gate 0B.8 applies: activation evidence and containment must quote real lines, a phase excuse is refused, and `NON_BLOCKING_WITH_JUSTIFICATION` cannot cover cross-tenant, unauthenticated or wide authenticated harm.

- `RELEASE_BLOCKING`: the operational metrics counts of every organization's claims for any signed-in caller (or the service key), the organization item `GET` that reads any organization record as the system, the roster `GET` that returns the full roster with contact details to any member of the organization, the roster `POST` through which a steward grants any organization role to any user id without acceptance, and the hierarchy list, children, descendants and analytics reads that let any signed-in user enumerate or read other organizations as the system.
- `CONDITIONALLY_BLOCKING`: the churn scores that come from a randomly initialised network fitted on generated examples and are presented as machine learning, the peer-benchmark and clause-suggestion routes that take the target organization from the request and never compare it to the session, the onboarding root-organization scope that is a no-op on pending profiles, the organization `DELETE` that archives with no status governance, the membership guard that ignores member status and the removal flag, and the legacy path branch that reads organizations on a bare db client. Each states its blocking condition.

The four Gate 0B.7 and four Gate 0B.8 `RELEASE_BLOCKING` dispositions are preserved and the eight above join them: gate-acceptance debt now carries sixteen `RELEASE_BLOCKING_DEFECT_DISPOSITION` entries. The validator refuses a Gate 0B.7 or Gate 0B.8 disposition that is altered, removed or downgraded, and a disposition written into a frozen earlier defect. The 71 HIGH defects of Gate 0B.1 to Gate 0B.6 stay in the independent review queue, byte-identical to the Gate 0B.7 acceptance, with no disposition.

### Risk-category screen

The eight categories of Gate 0B.8 are screened on every operation. Defects carrying each category: derived output 1, publication 0, analytics 8, row-level security 8, audit outside the transaction 3, GET side effect 1, fabricated finding 14, external disclosure 2. No operation of this tranche publishes, so the publication category has no instance and none was invented. Eleven screens record why a triggered category does not apply, each backed by a quote that exists in the cited file. A screen is not a security qualification: it says the source shows no harm of that class on that route, not that the route is safe.

### Cross-tenant consistency control

Gate 0B.9 adds `ue-gate0b9-exposure.mjs`. A defect whose disposition records a cross-tenant disclosure impact with an unauthenticated or any-authenticated activation forces every operation that cites it to set `crossTenantExposure` with an exposure contract and `crossTenantAuthorized` false. The control found that the first draft of the organization and onboarding records cited such defects without the flag; the flag count went from 1 to 9.

### Evidence provenance

The 1,436 evidence items are 492 `ROUTE_HANDLER_DIRECT`, 288 `ROUTE_IMPORTED_HELPER`, 338 `SERVICE_IMPLEMENTATION` and 318 `SCHEMA_OR_POLICY`; 122 non-material inferences are recorded apart from the evidence list. The twelve OCRA alias routes re-export the ICRA handlers, so the provenance reader now resolves `export { GET, POST } from '...'` to the target handler. Evidence gaps that stay open: no caller was found for 63 operations, whether the row-level-security policy reaches the runtime role is not established for any route that uses the shared db client, and the Shopify, PDF, credential and production-runtime assumptions of earlier tranches are not promoted.

### Capability lock integrity

The lock holds 96 ids and 28 addition records (the three new Gate 0B.9 capabilities each name the frozen tranche, its operations hash and the count of operations owned). `lockVersion` is derived (now 8) and only `ue-gate0-update-lock.mjs` writes the lock.

### New validator checks

`validateClassification9` is part of `validateGate0`. It adds the tranche freeze against the anchored register, the shared record rules, preservation of every earlier classification, decision and defect (including the Gate 0B.7 and Gate 0B.8 dispositions), the release-disposition control for the new HIGH defects, the review-queue check, the risk-category screen, the cross-tenant consistency control, and the refusal of an ownership rule that owns an operation outside the frozen tranche. The matrix pins the sha256 of the Gate 0B.9 manifest and classification.

### Historical tests

The Gate 0B.8 suite is anchored to the Gate 0B.8 acceptance commit for every moving total (the ownership register, ledger, matrix and lock at that commit). `ue-gate0-cumulative.test.mjs`, `ue-gate0-lock-provenance.test.mjs`, `ue-gate0-scope-lock.test.mjs` and `ue-gate0b7-classification.test.mjs` assert the live moving totals.

## Capabilities

96 capabilities: 52 preserved plus 4 records from Gate 0B.1 and Gate 0A.2R (`UE-OMIT-STEWARD-CANONICAL-ABSENT`, `UE-OMIT-REP-CORRESPONDENCE`, `UE-OMIT-REP-TRANSITION-REASON-LEAK`, `UE-OMIT-ROUTE-DOMAIN-SCOPE`) plus 7 records from Gate 0B.2 plus 5 records from Gate 0B.3 plus 6 records from Gate 0B.4 plus 6 records from Gate 0B.5 plus 6 records from Gate 0B.6 plus 4 records from Gate 0B.7 plus 3 records from Gate 0B.8 plus 3 records from Gate 0B.9. The four earlier records are `UE-OMIT-STEWARD-CANONICAL-ABSENT`, `UE-OMIT-REP-CORRESPONDENCE`, `UE-OMIT-REP-TRANSITION-REASON-LEAK`, and `UE-OMIT-ROUTE-DOMAIN-SCOPE`.

| Status | Count |
| --- | --- |
| `NOT_IMPLEMENTED` | 13 |
| `PARTIAL` | 66 |
| `SOURCE_IMPLEMENTED` | 2 |
| `SOURCE_VERIFIED` | 5 |
| `NATIVE_PENDING` | 2 |
| `EXTERNAL_GATE` | 4 |
| `SOURCE_UNSPECIFIED` | 4 |

By primary gate: 1:7, 2:2, 3:1, 4:2, 5:5, 6:7, 7:3, 8:3, 9:6, 10:8, 11:8, 12:2, 13:3, 14:33, 15:5, schema-census:1.

No capability has a native or browser qualification of `PASS`.

## Source-verification evidence

`SOURCE_VERIFIED` now requires an executed record in `evidence/gate0-source-verification.json` with the command, the tested revision, the suite and assertion family, the executed result, the capability, the exclusions, the blob hashes of the cited test and source files, and a log hash. The validator rejects a record whose cited blobs changed, whose run failed, skipped tests, or ran no tests, whose tested revision is not a commit, or whose recorded output does not match its hash. A test file that exists but has no execution record no longer qualifies.

Tested revision for every record: `8c40e84d6`.

| Capability | Suite | Result | Status |
| --- | --- | --- | --- |
| `UE-CAP-F-001` | authority kernel resources and lifecycle PGlite | 69 passed | `SOURCE_VERIFIED` |
| `UE-CAP-G-001` | counsel boundary, resources, counsel PGlite | exit 1, 53 passed, 13 skipped | `PARTIAL` (downgraded from `SOURCE_VERIFIED`) |
| `UE-CAP-H-001` | anti-theatre scan | 33 passed | `SOURCE_VERIFIED` |
| `UE-CAP-K-002` | anti-theatre scan | 33 passed | `SOURCE_VERIFIED` |
| `UE-CAP-H-005` | admin seed route | 2 passed | `SOURCE_VERIFIED` |
| `UE-CAP-K-001` | migration lineage certification | 9 passed | `SOURCE_VERIFIED` |
| `UE-CAP-K-003` | convergence checker | 12 passed | `PARTIAL` (evidence recorded, status not raised) |
| `UE-CAP-REVIEW-INTAKE` | review-intake PGlite, route, component | 12 passed | `PARTIAL` (evidence recorded, status not raised) |
| `UE-OMIT-DELIVERY-EVIDENCE` | delivery reconciliation | 9 passed | `NATIVE_PENDING` |

`UE-CAP-G-001` was `SOURCE_VERIFIED` on the strength of a referenced test file. Executing the counsel PGlite suite fails at setup with `REFERRAL_SCOPE_REQUIRED`, raised by a migration 0037 trigger, so 13 tests skip. The capability is downgraded to `PARTIAL` and the suite is tracked as a defect blocking Gate 7. No test or migration was changed.

Recorded exclusions: PGlite results are not native PostgreSQL proof, anti-theatre scans do not prove runtime behaviour, and none of these runs is a credentialed browser run. Counsel execution stays `UE-CONV-G-003` (`EXTERNAL_GATE`) and has no HTTP route.

## Independent capability lock

`ue-gate0-capability-lock.json` is a second list of the mandatory capability IDs. It carries `anchorCommit` `2247978bd642a89a7d4f8bd720b978f789cb4437`, and the validator reads that commit's matrix with `git show`. Deleting a capability from both the matrix `capabilities` array and the matrix's own `lockedCapabilityIds` array still fails, because the anchored matrix and the lock file still name it. A capability leaves the lock only through a `retirements` entry with `schemaVersion` 2 or later, a reason of at least 20 characters, and an evidence file that exists. A capability in the matrix without a lock entry also fails. Each id is also justified by an anchor, a checkpoint or an addition record (see Gate 0B.4, capability lock integrity). The lock holds 74 IDs.

## Ratchet defects

`node tooling/scripts/check-ue-convergence.mjs` exits 1 on two ratchets that fail on this branch. Neither implementation file and neither allowlist was changed. Each defect has one owning capability, and the validator fails when a live ratchet failure is untracked or when a tracked defect no longer reproduces and is not recorded as resolved.

| Defect | File | Owner | Blocks acceptance of |
| --- | --- | --- | --- |
| `MUTABLE-REP-IDENTIFIER` | `apps/union-eyes/lib/authority/store/case-ownership-backfill.ts` | `UE-CAP-B-001` | Gate 2 |
| `DIRECT-MANDATORY-AUDIT-IMPORT` | `apps/union-eyes/lib/voting/election-succession.ts` | `UE-CAP-K-005` | Gates 14 and 12 |
| `COUNSEL-PGLITE-SUITE-FAILS-AT-SETUP` | `apps/union-eyes/db/__tests__/authority-kernel-counsel.pglite.test.ts` | `UE-CAP-G-001` | Gate 7 |
| `P0-F2-TRANSITION-REASON-LEAK` | `apps/union-eyes/app/api/cases/[caseId]/transition/route.ts` | `UE-OMIT-REP-TRANSITION-REASON-LEAK` | Gate 10 |

The checker's global failure is unresolved debt, not a pass. The stale allowlist note for `apps/union-eyes/app/api/grievances/[id]/convert/route.ts` is non-failing and was not edited.

## Tests

Run from `/home/ubuntu/ue-cursor-final-closure` on Monday, October 26, 2026, America/Toronto, against the tree at `66eac06d7`.

| Command | Result |
| --- | --- |
| `node --test tooling/scripts/lib/ue-gate0-scope-lock.test.mjs` | 33 passed, 0 failed |
| `node --test tooling/scripts/lib/ue-gate0a-persona-recovery.test.mjs` | 10 passed, 0 failed |
| `node --test tooling/scripts/lib/ue-convergence-check.test.mjs` | 12 passed, 0 failed |
| `node --test tooling/scripts/lib/ue-gate0a2-baselines.test.mjs` | 45 passed, 0 failed (21 Gate 0A.2 tests and 24 Gate 0A.2R tests) |
| `node tooling/scripts/check-ue-convergence.mjs` | exit 1. Register valid (41 entries). Migration lineage verified. Two ratchet failures, above. |

The 33 Gate 0 tests are the 14 original tests plus 19 new tests. The new negative tests cover: a missing Steward, a missing Representative, a Financial Officer marked complete while specs are unresolved, an existing route with no capability owner, an unrelated or invalid owner, deleted ownership with an unchanged route hash, `SOURCE_VERIFIED` backed by a test file with no execution evidence, a capability removed from both the matrix and its in-matrix lock array, and global convergence failures omitted from tracked debt. Further cases cover orphan, conflicting, and unclassified entries, an uninventoried route, stale or tampered evidence, a lock retirement without a reason, a capability added without a lock entry, a single owner per ratchet defect, and a verdict that disagrees with the blockers.

The 10 Gate 0A tests cover: exact recovered counts and provenance; a missing persona specification marked resolved, and loss of the recovery file; a grouped-only identifier promoted without a solitary quote; an executable-only, inferred, or steward-evidence item presented as a requirement; the Financial Officer range completed by endpoint counting, by an invented identifier, or by an unsupported quote; a hidden or settled source conflict; an identifier removed from the previously recorded universe in the matrix and in the source; a tampered quote, blob, short commit, or kind; a dropped reference with no identifier; and a canonical claimed without a canonical-class source. The Gate 0A suite does not run any application test.

The 24 Gate 0A.2R tests are negative tests. They prove that a Steward interface persona, union office or platform role does not grant authority; that a linear intake-to-grievance sequence is not mandatory and the claims versus grievances decision stays at Gate 4; that member disclosure needs an independently authorized server-side classification and decision and a client flag is refused; that no universal different-person rule is invented, that an actor slot cannot hold duties a listed rule separates, and that technical protections, software rules and proposed rules stay distinct; that platform billing is not union finance; that reports and exports are authorized apart from a view duty; that product acceptance activates no institutional mandate and all 32 institutional decisions stay outstanding and inactive; and that historical provenance, the 182 identifiers, the 46 decisions and the R18 record are unchanged from the anchor commit.

The 13 Gate 0B.1 tests in `ue-gate0b1-classification.test.mjs` cover the eight required negative cases, the positive tranche selection, the 42 dispositions, the open exposure blocker, and an end-to-end tamper rejection. The 32 Gate 0B.2 tests in `ue-gate0b2-classification.test.mjs` cover tranche freezing and versioning, the 19 carry-forward resolutions, the 81 new classifications, and the rejection cases listed under Gate 0B.2. The 0B.1 exposure test now asserts the Gate 14 release-blocking move, and a second test confirms the standalone 0B.1 validator still reports the blocker. The 27 Gate 0B.3 tests in `ue-gate0b3-classification.test.mjs` cover the tranche freeze (1 carry-forward plus 99 new at the Gate 0B.2 commit), the alert visibility classification, the one unresolved operation, the five capabilities and the lock, the 36 new defects and the preserved 40, the byte-identical earlier tranches, the cumulative counts, the Gate 0 validation and pins, and 17 negative cases: a tranche operation dropped or added, membership, order or hash changed without a version, the carry-forward operation dropped or an examined operation re-examined, an earlier classification reverted, an earlier defect dropped or altered or a defect without an owner at its repair gate, a quote not in the file, cross-tenant reachability recorded as authorization, a role floor recorded as kernel authorization or an institutional decision adopted, an atomic audit claimed by declaration or a refused write recorded as audited, a read recorded as not mutating while citing a write, a capability outside its domain, a caller that does not exist, missing required audit or invalid dependency gates, an unresolved operation without its evidence gap or silently assigned, a release-blocking exposure that loses its contract, a summary or ledger that disagrees with the records, and a claimed owner column the route does not declare. The cumulative-count expectations in the Gate 0B.1, Gate 0B.2 and scope-lock tests were updated to the post-0B.3 totals. All `ue-*.test.mjs` suites under `tooling/scripts/lib` ran 242 tests: 236 passed, 0 failed, 6 skipped (pre-existing). The Gate 0B.1 builder was patched so unresolved records use the catch-all owner and the ledger merges the prior ledger; its output is byte-identical to the accepted commit. `pnpm test:fast` was not run, by instruction.

The 25 Gate 0B.6 tests in `ue-gate0b6-classification.test.mjs` cover the tranche freeze (100 new, nothing carried forward, four exceptions excluded), the exception register and its pinned 0B.4 and 0B.5 record hashes, the six-way inventory total, the six new capabilities with their lock additions, handler-specific provenance, the 98 new defects and the preserved 178, byte-identical earlier tranches and the matrix pins. Twelve negative cases refuse: a changed membership, order or hash; an earlier-examined, duplicated or carried-forward operation; a quote with no handler-specific provenance, one tagged for a sibling method, or a missing caller; an invented, catch-all or unnamed capability owner; a role floor recorded as a kernel decision or an undeclared atomic audit; reachable cross-tenant data recorded as authorized; a decision-bound exception represented as approved scope, an owner or a classification; a silently closed, altered or adopted institutional decision; a mutated, reverted or re-owned historical tranche; a defect with no owner, a wrong owner gate or no citation, and a lock without provenance; a duplicated, omitted or reclassified route-method identity; and cumulative counts that double count the exceptions or omit an operation. The cumulative suite now holds 1644 operations, 926 owned, 577 awaiting classification, 4 exceptions, 571 classified, 276 defects and 86 capabilities. All `ue-*.test.mjs` suites under `tooling/scripts/lib` ran 379 tests: 373 passed, 0 failed, 6 skipped (pre-existing). Running the build order (ownership, matrix, Gate 0B.6 builder, lock updater, matrix) a second time leaves the tree unchanged.

The 29 Gate 0B.4 tests in `ue-gate0b4-classification.test.mjs` cover the tranche freeze (1 carry-forward plus 99 new at the Gate 0B.3 commit), the newsletter batch-status classification with its decision still outstanding, the four carbon operations and their evidence gaps, the six capabilities with their lock addition records, the provenance of every record, the 60 new defects and the preserved 76, the byte-identical earlier tranches, the cumulative counts, the Gate 0 validation and pins, and 17 negative cases (frozen membership, order and hash; the carry-forward operation; reverted classifications; dropped or altered defects; a quote that is absent or has no provenance; a quote from a sibling method, a module-scope declaration, a sibling route or a mis-tagged method; an authentication claim resting on an inference; cross-tenant reachability recorded as authorization; a role floor recorded as kernel authorization or a decision adopted or dropped; an atomic audit claimed by declaration, a read that cites a mutation, and a silent mutation; a capability outside its domain; missing audit, gates or callers; an unresolved operation without its evidence gap or silently assigned; a summary or ledger that disagrees; a lost release-blocking contract). The 27 tests in `ue-gate0b4-provenance.test.mjs` use an in-memory source tree to prove each provenance rule, including a sibling-route quote, a quote in another method's handler, a local helper the handler never calls, a helper the route does not import, an import the method does not use, a quote from another function of the imported module, an unreachable service, an ambiguous schema export, an `absentColumns` violation, class-member regions and an inference supporting a material claim, and then run the committed records against the live source. The 13 tests in `ue-gate0-lock-provenance.test.mjs` cover a hand-added id, a missing, orphan or duplicate addition, a wrong operations hash or count, an addition with no classified operation, a dropped checkpoint id, an invalid checkpoint, a wrong `lockVersion`, an updater that refuses to invent a justification, and an end-to-end hand edit rejected by `validateGate0`. The 6 tests in `ue-gate0-cumulative.test.mjs` hold the moving totals (1644 operations, 730 owned, 777 undecided, 375 classified, 136 defects, 74 capabilities), the four pins and the byte identity of the accepted tranche files. The Gate 0B.1, 0B.2 and 0B.3 suites are anchored to their accepted commits (see Historical tests) and still pass 14, 32 and 27 tests; the scope-lock suite passes 33 tests with the capability count updated to 74. All `ue-*.test.mjs` suites under `tooling/scripts/lib` ran 317 tests: 311 passed, 0 failed, 6 skipped (pre-existing). Running the build order (matrix, Gate 0B.4 builder, lock updater, matrix) twice leaves the tree unchanged. `pnpm test:fast` was not run, by instruction.

The 36 Gate 0B.5 tests in `ue-gate0b5-classification.test.mjs` cover the tranche freeze (4 carry-forward plus 96 new at the Gate 0B.4 commit), the four carbon operations with their scope disposition and gate 8 obligation, the six new capabilities with their lock addition records, the provenance of every record, the 42 new defects and the preserved 136, the byte-identical earlier tranches, the cumulative counts, the Gate 0 validation and pins, and 22 negative cases (frozen membership, order and hash; a carry-forward operation dropped or silently assigned; an adopted, option-less, chosen, access-justifying or obligation-less carbon disposition; a disposition on a classified record; reverted classifications; dropped or altered defects; a defect without an owner at its repair gate; a quote that is absent or has no provenance; a software owner dropped from a preserved decision; a decision adopted; cross-tenant reachability recorded as authorization; a read that writes with no audit record; a capability outside its domain; missing audit, gates or callers; a summary or ledger that disagrees; a lost release-blocking contract). The 0B.2 and 0B.4 suites were anchored to their accepted commits, and the cumulative suite now holds 1644 operations, 826 owned, 681 undecided, 471 classified, 178 defects and 80 capabilities. All `ue-*.test.mjs` suites under `tooling/scripts/lib` ran 353 tests: 347 passed, 0 failed, 6 skipped (pre-existing). Running the build order (ownership, matrix, Gate 0B.5 builder, lock updater, matrix) a second time leaves the tree unchanged. `pnpm test:fast` was not run, by instruction.

The 24 Gate 0B.7 tests in `ue-gate0b7-classification.test.mjs` cover the tranche freeze (100 new at the Gate 0B.6 commit, nothing carried forward, hash pinned), the preserved carbon exceptions, the four new capabilities with their lock additions, handler-specific provenance, the 93 new defects and the preserved 276, the 13 new HIGH dispositions (4 release blocking, 9 conditionally blocking), the 71-entry review queue, byte-identical 0B.1 to 0B.6 files, the six-class inventory and the matrix pins. Eleven negative cases refuse: a dropped, duplicated, extra, reordered, re-hashed, re-anchored or already-examined operation; missing, invented, wrong-method or unprovenanced evidence and an unreal caller; an invented, catch-all or unnamed capability owner; a role floor recorded as a kernel decision and reachable cross-tenant data recorded as authorized; a mutation or audit the source does not support; a HIGH defect with no disposition, a phase excuse, a hollow exposure, a fake activation or containment quote, a blocking-mark mismatch or a conditional with no condition; a `NON_BLOCKING_WITH_JUSTIFICATION` for uncontained, cross-tenant, unauthenticated or widely reachable harm; a deleted, downgraded, relabelled or in-place-dispositioned accepted defect and a review-queue entry removed, re-hashed, pre-assigned or relabelled; a carbon exception converted to owned, classified, adopted or approved; a mutated, reverted or re-owned historical tranche and a lock capability without provenance; and forged inventory counts. The cumulative suite now holds 1644 operations, 1026 owned, 477 awaiting classification, 4 exceptions, 671 classified, 369 defects and 90 capabilities. All 18 `ue-*.test.mjs` suites under `tooling/scripts/lib` ran 403 tests: 397 passed, 0 failed, 6 skipped (pre-existing). Running the build order (ownership, matrix, Gate 0B.7 builder, lock updater, matrix) a second time leaves every register byte-identical. `pnpm validate:docs` reports 0 errors. `node tooling/scripts/check-ue-convergence.mjs` exits 1 on the same two ratchets as before.

The 27 Gate 0B.8 tests in `ue-gate0b8-classification.test.mjs` cover the tranche freeze (100 new at the Gate 0B.7 commit, nothing carried forward, hash pinned, the split `meeting-rooms/[id]/bookings` file owning only its two selected methods), the preserved carbon exceptions, the three new capabilities with their lock additions, handler-specific provenance, the 82 new defects and the preserved 369, the 12 new HIGH dispositions (4 release blocking, 8 conditionally blocking) and the preserved Gate 0B.7 dispositions, the 71-entry review queue (byte-identical to the Gate 0B.7 acceptance), byte-identical 0B.1 to 0B.7 files, the six-class inventory, the two cross-tenant exposures, the risk-category screen and the matrix pins. Thirteen negative cases refuse: a dropped, duplicated, extra, reordered, re-hashed, re-anchored or already-examined operation; missing, invented, wrong-method or unprovenanced evidence and an unreal caller; an invented, catch-all or unnamed capability owner; a role floor recorded as a kernel decision and reachable cross-tenant data recorded as authorized; a mutation or audit the source does not support; a HIGH defect with no disposition, a phase excuse, a hollow exposure or a fake activation or containment quote; a `NON_BLOCKING_WITH_JUSTIFICATION` for uncontained, cross-tenant, unauthenticated or widely reachable harm; a deleted, downgraded, relabelled or in-place-dispositioned accepted defect and a review-queue entry removed, re-hashed or pre-assigned; a carbon exception converted to owned, classified, adopted or approved; a mutated, reverted or re-owned historical tranche and a lock capability without provenance; forged inventory counts; each of the eight risk categories raised by the source with no defect or verified screen, a screen on a structural trigger, a hollow, invented or unquoted screen, and a frozen defect that gains risk categories; and a Gate 0B.7 disposition altered, removed or downgraded, or an ownership rule that owns an operation outside the frozen tranche. The cumulative suite now holds 1644 operations, 1126 owned, 377 awaiting classification, 4 exceptions, 771 classified, 451 defects and 93 capabilities. All 19 `ue-*.test.mjs` suites under `tooling/scripts/lib` ran 430 tests: 424 passed, 0 failed, 6 skipped (pre-existing). Running the build order (ownership, matrix, Gate 0B.8 builder, lock updater, matrix) a second time leaves every register byte-identical. `pnpm validate:docs` reports 0 errors. `node tooling/scripts/check-ue-convergence.mjs` exits 1 on the same two ratchets as before.

The 28 Gate 0B.9 tests in `ue-gate0b9-classification.test.mjs` cover the tranche freeze (100 new at the Gate 0B.8 commit, nothing carried forward, hash pinned, `meeting-rooms/[id]/bookings/route.ts|PATCH` through `organizations/hierarchy/route.ts|GET`), the preserved carbon exceptions, the three new capabilities with their lock additions and primary gates, handler-specific provenance, the 91 new defects and the preserved 451, the 14 new HIGH dispositions (8 release blocking, 6 conditionally blocking) and the preserved Gate 0B.7 and Gate 0B.8 dispositions, the 71-entry review queue, byte-identical 0B.1 to 0B.8 files, the six-class inventory, the nine cross-tenant exposures, the risk-category screen and the matrix pins. Fourteen negative cases refuse: a dropped, duplicated, extra, reordered, re-hashed, re-anchored or already-examined operation; missing, invented, wrong-method or unprovenanced evidence and an unreal caller; an invented, catch-all or unnamed capability owner; a role floor recorded as a kernel decision and reachable cross-tenant data recorded as authorized; a mutation or audit the source does not support; a HIGH defect with no disposition, a phase excuse, a hollow exposure or a fake activation or containment quote; a `NON_BLOCKING_WITH_JUSTIFICATION` for uncontained, cross-tenant, unauthenticated or widely reachable harm; a deleted, downgraded, relabelled or in-place-dispositioned accepted defect and a review-queue entry removed, re-hashed or pre-assigned; a carbon exception converted to owned, classified, adopted or approved; a mutated, reverted or re-owned historical tranche and a lock capability without provenance; forged inventory counts; each risk category raised by the source with no defect or verified screen, a screen on a structural trigger, and a hollow, invented or unquoted screen; a Gate 0B.7 or Gate 0B.8 disposition altered, removed or downgraded, or an ownership rule that owns an operation outside the frozen tranche; and a cross-tenant defect cited by an operation that drops the exposure flag, hides the defect or is downgraded to non-blocking. The cumulative suite now holds 1644 operations, 1226 owned, 277 awaiting classification, 4 exceptions, 871 classified, 542 defects and 96 capabilities. All 20 `ue-*.test.mjs` suites under `tooling/scripts/lib` ran 458 tests: 452 passed, 0 failed, 6 skipped (pre-existing). Running the build order (ownership, matrix, Gate 0B.9 builder, lock updater, matrix) a second time leaves every register byte-identical. `pnpm validate:docs` reports 0 errors. `node tooling/scripts/check-ue-convergence.mjs` exits 1 on the same two ratchets as before.

The matrix validator returns 0 problems and 6 blockers (3 persona, route scope undecided, decision-bound exceptions, uninventoried route). The three unjustified exposures are Gate 14 release-blocking defects, carried in the defect register and counted in gate-acceptance debt. A problem is a rule violation. A blocker is unfinished Gate 0 scope.

## Remaining Gate 0 blockers

1. Steward: no canonical and no action universe. Open decision: distinct persona or the level-1 role in Representative 2.2.
2. Representative: canonical 2.2 file absent. 17 identifiers grouped only, `R18` in source conflict, 2 references with no identifier.
3. Financial Officer: canonical file absent. 28 identifiers unspecified, 6 grouped only, 3 references with no identifier.
4. 277 route operations are `SCOPE_UNDECIDED` and await source classification, and 4 are `DECISION_BOUND_SCOPE_EXCEPTION` (carbon) that wait on `UE-INST-CARBON-ACCOUNTING-SCOPE`. 39 institutional decisions are outstanding.
5. `reviews/route.ts` is on disk and not in the route-coverage manifest.
6. Not a Gate 0 blocker: three unauthenticated system operations (`docs`, `docs/openapi`, `version`) are unjustified exposure and Gate 14 release-blocking implementation defects (`DEF-0B1-DOCS-UNAUTH-API-SURFACE`, `DEF-0B1-VERSION-UNAUTH-TOPOLOGY`). Their exposure contracts and remediation obligations are preserved. The repair is owned by Gate 14 and was not made here.

Gate acceptance debt that is tracked and not a Gate 0 blocker: the four ratchet defects above, the three release-blocking exposures and the sixteen `RELEASE_BLOCKING` defect dispositions of Gate 0B.7, Gate 0B.8 and Gate 0B.9 (four, four and eight). The release dispositions of the 71 earlier HIGH defects are queued for independent qualification.

## Not done

No runtime migration, application source, security allowlist, or census change. No Docker, native PostgreSQL, or Next server run. Migrations 0031–0037 and cache 0028 are not applied. Gate 1 does not start. The next action is an independent adversarial review of the Gate 0B.9 artifacts. No further tranche, no Gate 0C work and no Phase 3B work was started.
