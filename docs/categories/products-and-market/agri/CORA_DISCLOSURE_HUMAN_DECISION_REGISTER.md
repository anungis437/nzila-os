# CORA Disclosure Human Decision Register

**Register ID:** `CORA-DISCLOSURE-HDR-001`  
**Version:** `1.0.0`  
**Prepared:** 2026-10-07  
**CORA_HUMAN_GOVERNANCE_CLOSURE:** `READY_FOR_DECISIONS`  
**CORA_PREACTIVATION_ENGINEERING:** `PASS`  
**CORA_DISCLOSURE_ACTIVATION:** `BLOCKED_HUMAN_CONDITIONS`  
**CORA_FARMER_360:** `BLOCKED_GOVERNANCE_CONDITIONS`  
**Capability truth:** `DESIGN_ONLY`

This is the canonical index of human decisions, not a grant. Candidate
`cora-farmer360-agrimo-producer-status-same-org-viewer` version `1.0.0`
remains `PROPOSED_NOT_ACTIVE`. All four runtime registries remain empty and
real Agrimo status remains `WITHHOLD`. The conditional direction recorded in
the [decision record](CORA_SOURCE_DISCLOSURE_APPROVAL_RECORD_TEMPLATE.md)
does not establish delegation, source concurrence, or legal approval.

## 1. Use in a decision meeting

Evidence E1-E14 refers to the exact sources in the existing
[authorization packet evidence catalogue](CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md#2-canonical-repository-evidence).
The [condition ledger](CORA_SOURCE_DISCLOSURE_CONDITION_LEDGER.md) retains
certified engineering and human states. This register adds workflow states;
it does not replace either kind of state.

| Lane              | Decision rights                                                                                                                          | Boundary                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A - Product       | Accountable CORA product/Surface Owner: purpose, proposed recipient scope, history/export exclusions, correction and cadence preferences | Cannot approve source disclosure, lawful basis, or institutional activation                                    |
| B - Source        | Delegated source institution/data owner: authority, status meanings/allowlist, freshness and correction                                  | Agrimo engineering/business aliases route the request; they do not prove delegation                            |
| C - Privacy/legal | Privacy Lead/DPO with qualified legal authority and identified controller                                                                | Determines jurisdiction, classification, lawful basis, consent, rights, retention and residual-use obligations |
| D - Institutional | Evidenced delegated disclosure approver/body                                                                                             | Establishes approval chain, accountable owners, dates, conditions and suspension/revocation authority          |

Authority is origin- and relationship-scoped; the decision-maker must be
identified for the particular fact, source origin, producer/institution
relationship, recipient, purpose and governing instrument. This does not
assume one universal Agrimo controller. See the [C1 intake authority model](CORA_C1_SOURCE_AUTHORITY_INTAKE.md#1a-authority-classes-and-evidence-boundary).
The model's `ORIGIN_SCOPED_READY` disposition is preparation status only.

Workflow states: `READY_FOR_DECISION`, `AWAITING_SOURCE_AUTHORITY`,
`AWAITING_PRIVACY_LEGAL`, `AWAITING_PRODUCT_DECISION`,
`AWAITING_INSTITUTIONAL_APPROVER`, `APPROVED`, `APPROVED_WITH_CONDITIONS`,
`REJECTED`. Preparation readiness is not approval. A conditional approval
cannot close a condition until its executable obligations and required
concurrences are evidenced; otherwise it remains an activation blocker.

## 2. Decision register

Each row is a decision record with stable proposed ID `CORA-DISCLOSURE-Cn-001`,
record version `1.0.0`, candidate binding as above, and the following fields:
**decision date = UNSET; review/expiry date = UNSET; approval evidence reference
= UNSET; named accountable person and mandate reference = UNSET**.
These fields apply to every C1-C9 row; no date or approval is implied.
Repository references below are technical/doctrinal evidence, not approval evidence.
Actual evidence IDs are assigned on ingestion and never overwritten.

| ID / lane / decision type                      | Exact decision required                                                                                                       | Accountable authority / consulted authority                                                                    | Workflow status                   | Existing evidence                                                | Required missing evidence                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 / B / source delegation                     | Identify each institution with authority over this fact's disclosure and the mandate for this exact origin-to-recipient scope | Evidenced delegated source data authority / Agrimo business owner routes; Privacy/Legal determines legal roles | `AWAITING_SOURCE_AUTHORITY`       | E6-E8: operational origin and routing only                       | Fact-origin and producer/source relationships; authority chain/delegation; upstream restrictions; exact recipient/purpose scope; durable decision evidence |
| C2 / B / semantic contract                     | Ratify meanings, display interpretation and allowed status values, including future/deprecated values                         | Source data owner / Agrimo technical owner, CORA Surface Owner                                                 | `AWAITING_SOURCE_AUTHORITY`       | E1, E6: enum and contract enforcement                            | Signed value-by-value table; approved contract version and evidence                                                                                        |
| C3 / C / privacy determination                 | Determine jurisdiction, personal/linked-data classification, basis, consent, rights and assessment need                       | Privacy Lead/DPO and qualified legal authority / source controller, CORA Surface Owner, Security Lead          | `AWAITING_PRIVACY_LEGAL`          | E9-E10: roles and classification doctrine                        | Flow-specific determination/assessment with conditions and concurrence                                                                                     |
| C4 / A with B concurrence / recipient scope    | Choose intended canonical roles and ratify the actual policy-role scope                                                       | CORA product/Surface Owner / source authority, platform authorization custodian, Privacy Lead                  | `AWAITING_PRODUCT_DECISION`       | E1, E4: canonical eligibility and mapping                        | Signed role table, source concurrence and resolution of any broader mapped-category scope                                                                  |
| C5 / B with A input / freshness and correction | Approve usable age, status-specific handling, correction SLA, propagation and history exclusion                               | Source data owner / CORA Surface Owner, Privacy Lead                                                           | `AWAITING_SOURCE_AUTHORITY`       | E1-E2: repaired timestamps and versioned freshness enforcement   | Approved finite maximum age, withheld-value handling, timestamp semantics and correction obligations                                                       |
| C6 / C with A input / cache and retention      | Decide copies/cache, source-reference and decision retention, deletion, holds and operational logs                            | Privacy Lead / source controller, CORA Surface Owner, legal authority, Platform Lead                           | `AWAITING_PRIVACY_LEGAL`          | E4, E11, E13: no-store/no domain copy and retention doctrine     | Approved store-by-store disposition, implementation/process ownership and exceptions                                                                       |
| C7 / A with B/C concurrence / onward use       | Confirm product exclusions and source/privacy obligations for manual copying and redistribution                               | CORA product/Surface Owner / source data owner, Privacy/Legal                                                  | `AWAITING_PRODUCT_DECISION`       | E14: no alternate exposure path; conditional product direction   | Signed prohibited-use matrix, residual-use obligations and source/privacy concurrence                                                                      |
| C8 / D / final policy governance               | Establish delegation, owners, dates, evidence, review and suspension/revocation process                                       | Institutional delegated disclosure approver / source, CORA product, Privacy/Legal, Security and Platform Leads | `AWAITING_INSTITUTIONAL_APPROVER` | E1, E8, E12: preflight and routing, not delegation               | Final approval instrument, conditions attestation, authority/owner identities and dated processes                                                          |
| C9 / C / audit doctrine                        | Resolve personal-data log cap versus generic security-audit schedule for this audit                                           | Privacy Lead/DPO and qualified legal authority / CORA Surface Owner, Security and Platform Leads               | `AWAITING_PRIVACY_LEGAL`          | E5, E11: actor-bearing minimized audit and conflicting schedules | Flow-specific schedule or approved exception, legal basis, period, disposal/hold process                                                                   |

| ID  | Decision options                                                      | Conservative recommendation, not approval                                                 | Implementation dependency / activation effect                                                        | Human closure criterion                                                   |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| C1  | Authorize narrow scope with evidenced mandate; restrict; reject/defer | Withhold until authority is established                                                   | Prerequisite for source approvals and final C8; no runtime change from document approval             | `APPROVED_SOURCE_AUTHORITY` only on delegation evidence                   |
| C2  | Approve a subset with meanings; approve none; request clarification   | Unlisted, unknown and future values withheld; do not select any now                       | Supplies versioned fact contract; empty allowlist blocks materialization                             | `APPROVED_STATUS_ALLOWLIST` with source-signed table                      |
| C3  | Pass; pass with enforceable conditions; reject                        | No assumed basis/consent exemption; continue withholding                                  | Conditions constrain C4-C9; rejection stops proposal                                                 | `PRIVACY_LEGAL_PASS`, `PRIVACY_LEGAL_PASS_WITH_CONDITIONS`, or `REJECTED` |
| C4  | Ratify narrow enforceable scope; revise candidate; reject             | Smallest task-justified same-org cohort; no automatic viewer entitlement                  | Supplies exact policy `roles`; narrower-than-mapped scope needs a separate implementation/proof gate | `APPROVED_RECIPIENT_ROLES` with concurrence and enforceability            |
| C5  | Approve finite age and conditions; revise; reject/defer               | Unknown/invalid/future/stale withheld; no creation-time substitution or historical status | Supplies freshness policy and correction obligations; unsupported rules require later implementation | `APPROVED_FRESHNESS_CORRECTION_POLICY` with source evidence               |
| C6  | Approve no-copy posture and explicit retention; condition; reject     | No durable status copy or cache; no engineering-selected period                           | Constrains stores/processes and C9; unsupported obligations block activation                         | `APPROVED_RETENTION_CACHE_POLICY` with retention approval                 |
| C7  | Ratify exclusions and obligations; narrower restriction; reject       | No export/bulk/redistribution/secondary use; manual-copy obligations must be explicit     | Supplies onward-use evidence; any expanded surface requires new review                               | `APPROVED_ONWARD_USE_POLICY` with B/C concurrence                         |
| C8  | Approve; approve with closed conditions; reject/defer                 | No activation until all evidence and delegation are complete                              | Final gate after C1-C7/C9; later explicit activation mission still required                          | `POLICY_GOVERNANCE_COMPLETE` with final instrument                        |
| C9  | Apply justified schedule; approved exception; reject/defer            | Choose no interval in engineering; escalate doctrine conflict                             | Supplies audit evidence; process proof required before activation                                    | `APPROVED_AUDIT_RETENTION_DOCTRINE` with schedule/exception               |

## 3. Decision packets

- [C1 source-authority intake](CORA_C1_SOURCE_AUTHORITY_INTAKE.md): repository
  discovery, authority routing and unresolved decision record.
  `READY_FOR_HUMAN_DECISION` is preparation, not approval; C1 remains pending.
- [Source authority packet](CORA_DISCLOSURE_SOURCE_AUTHORITY_PACKET.md): C1, C2, C5.
- [Product boundary packet](CORA_DISCLOSURE_PRODUCT_BOUNDARY_PACKET.md): Lane A purpose/history/cadence inputs, C4, C7 and correction preference.
- [Privacy/legal packet](CORA_DISCLOSURE_PRIVACY_LEGAL_PACKET.md): C3, C6, C9 and onward-use concurrence.
- [Final institutional checklist](CORA_DISCLOSURE_INSTITUTIONAL_ACTIVATION_CHECKLIST.md): C8, evidence ingestion, all-condition closure and stop gate.

## 4. Recommended decision sequence

This dependency graph is a planning recommendation from the actual required
inputs, not a repository-established quorum or meeting mandate. E9/E11
establish privacy/retention responsibilities; E12 does not establish a
flow-specific approval sequence or delegated quorum.

1. **Authority intake:** establish C1 controller and delegate, and appoint
   accountable product/privacy reviewers. Prepare Lane A boundaries and C3
   scoping in parallel; do not wait for nine independent meetings.
2. **Source working session:** after C1, resolve C2 meanings/allowlist, then C5
   status-sensitive freshness/correction. C2 feeds C5; C1 and product purpose
   feed C3. Record unknowns instead of approving by silence.
3. **Product boundary session:** prepare C4 before C7 (recipient scope affects
   onward-use risk), with source/privacy concurrence. Drafts may precede C1;
   final ratification needs C1/C2 and applicable C3 restrictions. Confirm
   purpose, no history/export and preferred cadence in the same session.
4. **Privacy/legal session:** conclude C3 using C1/C2/C4/C5/C7 scope; approve C6
   cache/store/rights boundaries, then C9 audit-specific schedule. C9 depends
   on C3 classification and C6 inventory. Revisit C4/C5/C7 only if the
   assessment imposes different boundaries.
5. **Institutional closure:** C8 after C1-C7 and C9 evidence/concurrences, with
   explicit delegated authority and resolution of implementation gaps.
   Approver assignment can be prepared earlier; final sign-off cannot.

Cadence recommendation: one intake, one joint source/product working session
with separate decision records, one privacy/legal review, then one final
institutional review. Schedule only after documents and delegated attendees
are supplied; no artificial deadlines or source-correction SLA are imposed.
Scope changes invalidate affected downstream concurrences. Rejection stops
the dependent decisions; deferral retains `WITHHOLD`.

## 5. Validation and repository boundary

Documentation-only mission. Run formatting, local link/evidence-reference
checks, `pnpm validate:docs`, `pnpm governance:audit`, and `git diff --check`.
No engineering suite or disposable DB rerun is required without runtime changes.
Validation results for this documentary mission:

| Check                                                       | Result                                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Prettier on the five new artifacts and two linked documents | PASS                                                                                                             |
| Local link/heading checks                                   | PASS: all 31 references in the five packets resolve; both incoming register links resolve                        |
| `pnpm validate:docs`                                        | PASS: 2,470 files scanned; 0 errors, 1,215 warnings, 1,673 informational findings                                |
| `pnpm governance:audit`                                     | PASS: audit's financial-service health check ran 553 tests across 29 files; lint reported 351 warnings, 0 errors |
| `git diff --check`                                          | PASS                                                                                                             |
| Runtime tests / DB acceptance / authenticated HTTP          | Not run: no runtime file changes; HTTP acceptance prohibited                                                     |

Baseline: `main`, HEAD `1c337567635bb86ea0df7831557d8d2d22df1e6f`,
upstream `origin/main`, local ahead/behind `0/0` without fetching; extensive
dirty/untracked work preserved. No activation, allowlist, freshness threshold,
HTTP acceptance, deployment, database access or capability promotion is authorized.
Final inspection retained the same branch/HEAD/upstream relationship with 124
worktree status entries (119 on task rebaseline, plus five new artifacts).
Changes in this mission are those five documents and navigation additions in
the existing packet/ledger; validation regenerated documentation/audit reports.
Other prior changes are not attributed to this mission. No commit or push.
