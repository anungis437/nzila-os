# Gate 0 scope lock (adversarial rework, Gate 0A, Gate 0A.2, and Gate 0B.1)

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
| `OWNED` | 436 |
| `RETIRED_501` | 97 |
| `STUB_501` | 31 |
| `SYSTEM` | 9 |
| `SCOPE_UNDECIDED` | 1071 |
| Total | 1644 |

The validator rejects an operation without an entry, an entry without a capability, an owner that is not a capability, an owner that differs from the rule-derived owner, two owners for one operation, an entry for a route that is not in the manifest, a route that matches no rule, and a route file on disk that is neither in the manifest nor recorded as uninventoried.

Exceptions:

- `SCOPE_UNDECIDED` is 1071 operations, owned by `UE-OMIT-ROUTE-DOMAIN-SCOPE` (gate 13, `SOURCE_UNSPECIFIED`). Their control owner stays the guard-class owner. No register entry, persona source, or registry record names a business owner for those domains, and none was guessed. This blocks Gate 0 until each domain is decided.
- `reviews/route.ts` (GET, POST) exists on disk and is absent from the manifest. It is recorded as uninventoried and owned by `UE-CAP-REVIEW-INTAKE`. Regenerating the manifest belongs to `UE-CONV-K-008` and was not done here.
- 0 operations are unauthenticated without a recorded justification. The 42 operations previously counted were each inspected in Gate 0B.1 and carry a disposition. Three supplementary system probes are recorded as unjustified exposure and block Gate 0 (see Gate 0B.1).
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

## Capabilities

56 capabilities: 52 preserved plus 4 new records, `UE-OMIT-STEWARD-CANONICAL-ABSENT`, `UE-OMIT-REP-CORRESPONDENCE`, `UE-OMIT-REP-TRANSITION-REASON-LEAK`, and `UE-OMIT-ROUTE-DOMAIN-SCOPE`.

| Status | Count |
| --- | --- |
| `NOT_IMPLEMENTED` | 12 |
| `PARTIAL` | 27 |
| `SOURCE_IMPLEMENTED` | 2 |
| `SOURCE_VERIFIED` | 5 |
| `NATIVE_PENDING` | 2 |
| `EXTERNAL_GATE` | 4 |
| `SOURCE_UNSPECIFIED` | 4 |

By primary gate: 1:7, 2:1, 3:1, 4:2, 5:5, 6:4, 7:3, 8:3, 9:5, 10:8, 11:3, 12:2, 13:3, 14:3, 15:5, schema-census:1.

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

`ue-gate0-capability-lock.json` is a second list of the mandatory capability IDs. It carries `anchorCommit` `2247978bd642a89a7d4f8bd720b978f789cb4437`, and the validator reads that commit's matrix with `git show`. Deleting a capability from both the matrix `capabilities` array and the matrix's own `lockedCapabilityIds` array still fails, because the anchored matrix and the lock file still name it. A capability leaves the lock only through a `retirements` entry with `schemaVersion` 2 or later, a reason of at least 20 characters, and an evidence file that exists. A capability in the matrix without a lock entry also fails. The lock holds 56 IDs.

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

The 13 Gate 0B.1 tests in `ue-gate0b1-classification.test.mjs` cover the eight required negative cases, the positive tranche selection, the 42 dispositions, the open exposure blocker, and an end-to-end tamper rejection. All `ue-*.test.mjs` suites under `tooling/scripts/lib` ran 182 tests: 176 passed, 0 failed, 6 skipped (pre-existing). `pnpm test:fast` was not run, by instruction.

The matrix validator returns 0 problems and 6 blockers (3 persona, route scope undecided, uninventoried route, unjustified exposure). A problem is a rule violation. A blocker is unfinished Gate 0 scope.

## Remaining Gate 0 blockers

1. Steward: no canonical and no action universe. Open decision: distinct persona or the level-1 role in Representative 2.2.
2. Representative: canonical 2.2 file absent. 17 identifiers grouped only, `R18` in source conflict, 2 references with no identifier.
3. Financial Officer: canonical file absent. 28 identifiers unspecified, 6 grouped only, 3 references with no identifier.
4. 1071 route operations are `SCOPE_UNDECIDED`.
5. `reviews/route.ts` is on disk and not in the route-coverage manifest.
6. Three unauthenticated system operations (`docs`, `docs/openapi`, `version`) are unjustified exposure (`ROUTE_UNJUSTIFIED_EXPOSURE`). The repair is owned by Gate 14 and was not made here.

Gate acceptance debt that is tracked and not a Gate 0 blocker: the four defects above.

## Not done

No runtime migration, application source, security allowlist, or census change. No Docker, native PostgreSQL, or Next server run. Migrations 0031–0037 and cache 0028 are not applied. Gate 1 does not start. The next action is an independent adversarial review of these artifacts.
