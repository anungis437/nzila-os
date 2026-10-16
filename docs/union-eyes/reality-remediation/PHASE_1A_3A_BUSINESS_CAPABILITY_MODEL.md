# Phase 1A.3a — Business Capability Model

**PHASE_1A_3A_GATE = PASS.** This is source-model derivation, not runtime proof. The Phase 1A.2 graph was treated as closed; no application source or runtime was inspected or executed.

## Canonical capability summary

- **CANONICAL_CAPABILITIES = 33**
- **CORE = 11**
- **MATERIAL = 13**
- **SUPPORTING = 9**

- **SOURCE_MODEL_BOUNDED = 2**
- **SOURCE_MODEL_BOUNDED_WITH_DEFECTS = 1**
- **SOURCE_MODEL_HAS_CEILING_OBLIGATIONS = 16**
- **SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS = 14**
- **INTENTIONALLY_DISABLED = 0**
- **SOURCE_MODEL_INSUFFICIENT = 0**
- **SUM = 33 capabilities**

Every capability has `RUNTIME_PROVEN = NO`, `CAPABILITY_AUTHORIZATION_PROVEN = NO`, and `CAPABILITY_PERSISTENCE_PROVEN = NO`. The source-status categories describe evidence coverage and do not imply usability or readiness.

## Capability catalog

| ID | Capability | Domain | Criticality | Source status | Bindings | Defect bindings | Ceiling bindings |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MEMBER_RECORDS | Create and maintain member records | MEMBERSHIP | CORE | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 13 | 2 | 1 |
| ORGANIZATION_STRUCTURE | Maintain organizational and bargaining-unit structure | MEMBERSHIP | CORE | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 59 | 6 | 34 |
| USER_ACCESS | Invite users and administer access | IDENTITY | MATERIAL | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 28 | 2 | 8 |
| CASE_RECORDS | Create and maintain grievance and claim matters | GRIEVANCE_CASE | CORE | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 23 | 1 | 10 |
| CASE_RESPONSIBILITY | Assign and reassign case responsibility | GRIEVANCE_CASE | CORE | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 12 | 1 | 4 |
| CASE_DEADLINES | Calculate and manage matter deadlines | GRIEVANCE_CASE | CORE | SOURCE_MODEL_BOUNDED_WITH_DEFECTS | 2 | 1 | 0 |
| CASE_COMMUNICATIONS | Record and manage communications about a matter | COMMUNICATION | CORE | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 9 | 0 | 1 |
| CASE_EVIDENCE | Capture and retrieve matter evidence | DOCUMENT_EVIDENCE | CORE | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 30 | 0 | 11 |
| COLLECTIVE_BARGAINING | Develop and compare collective-bargaining positions | OTHER_EXPLICIT | MATERIAL | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 11 | 0 | 9 |
| CALENDAR_MEETINGS | Schedule and manage institutional events | GOVERNANCE | MATERIAL | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 46 | 2 | 9 |
| GOVERNANCE_ADMINISTRATION | Administer committees and union governance | GOVERNANCE | CORE | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 28 | 0 | 17 |
| ELECTIONS | Administer elections and ballot participation | ELECTION | MATERIAL | SOURCE_MODEL_BOUNDED | 7 | 0 | 0 |
| HEALTH_SAFETY_CASES | Manage workplace health and safety matters | HEALTH_SAFETY | CORE | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 37 | 6 | 10 |
| ORGANIZING_CAMPAIGNS | Plan and coordinate organizing campaigns | ORGANIZING | CORE | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 25 | 6 | 12 |
| MEMBER_DUES_SELF_SERVICE | Review dues, deductions, and payment records | FINANCE_DUES | MATERIAL | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 11 | 0 | 5 |
| DUES_REMITTANCE_ADMIN | Administer dues and remittance records | FINANCE_DUES | MATERIAL | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 20 | 8 | 9 |
| FINANCIAL_PLANNING | Manage budgets and organizational expenses | FINANCE_DUES | MATERIAL | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 28 | 0 | 4 |
| GENERAL_COMMUNICATIONS | Manage organizational communications | COMMUNICATION | MATERIAL | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 45 | 5 | 19 |
| ARBITRATION_PRECEDENT_KNOWLEDGE | Maintain arbitration precedents and jurisdiction preferences | OTHER_EXPLICIT | MATERIAL | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 26 | 2 | 4 |
| DOCUMENT_LIBRARY | Manage institutional documents and records | DOCUMENT_EVIDENCE | MATERIAL | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 7 | 0 | 5 |
| LEARNING_TRAINING | Manage member learning and training | LEARNING_TRAINING | MATERIAL | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 3 | 0 | 3 |
| KNOWLEDGE_HANDOFF | Preserve and transfer institutional knowledge | KNOWLEDGE_TRANSFER | CORE | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 17 | 0 | 3 |
| INSTITUTIONAL_REPORTING | Generate and export institutional reports | REPORTING_ANALYTICS | MATERIAL | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 62 | 11 | 23 |
| PILOT_ADMINISTRATION | Coordinate pilot onboarding and administration | ADMINISTRATION | SUPPORTING | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 20 | 0 | 11 |
| PUBLIC_INQUIRIES | Receive public inquiries and pilot requests | OTHER_EXPLICIT | SUPPORTING | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 4 | 0 | 2 |
| WORKPLACE_RISK_ASSESSMENT | Complete workplace risk assessments | OTHER_EXPLICIT | MATERIAL | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 10 | 0 | 2 |
| MEMBER_RECOGNITION | Nominate and redeem member recognition | OTHER_EXPLICIT | SUPPORTING | SOURCE_MODEL_BOUNDED | 5 | 0 | 0 |
| TRUSTEE_PENSION_PORTAL | Access trustee and pension workflows | OTHER_EXPLICIT | SUPPORTING | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 1 | 0 | 1 |
| ORGANIZATION_RISK_CONTROLS | Review organizational compliance and risk controls | ADMINISTRATION | SUPPORTING | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 1 | 0 | 1 |
| WORK_COORDINATION | Coordinate operational work queues | OTHER_EXPLICIT | SUPPORTING | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 3 | 0 | 2 |
| APPLICATION_ADMINISTRATION | Configure and administer the application | ADMINISTRATION | SUPPORTING | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 18 | 2 | 6 |
| AI_CASE_ASSISTANCE | AI-assisted case and steward support | GRIEVANCE_CASE | SUPPORTING | SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS | 5 | 2 | 2 |
| AI_COLLECTIVE_AGREEMENT_ASSISTANCE | AI-assisted collective-agreement analysis | OTHER_EXPLICIT | SUPPORTING | SOURCE_MODEL_HAS_CEILING_OBLIGATIONS | 9 | 0 | 7 |

Definitions, persona evidence, source action-family keys, all binding IDs, route-path candidates, defect/root IDs, and obligation IDs are in the JSON capability records. A route candidate denotes source-path association only. There are no intentional-disabled capability claims because the closed closeout does not establish any binding as intentionally disabled; dynamic disabled attributes are not treated as intentional disablement.

## Legacy curated registry reconciliation

**LEGACY_CURATED_CAPABILITIES = 31. UNRECONCILED_LEGACY_CAPABILITIES = 0.** The previous 488 derived UI-label candidates all carry `evidenceClass = UNKNOWN`; they were not used to invent capabilities. The 31 registry rows are reconciled below using their recorded labels/state and closed action evidence, not owner-path existence as proof.

| Legacy capability | Disposition | Canonical capability IDs | Rationale |
| --- | --- | --- | --- |
| UE-CRON-MONTHLY-DUES: Monthly dues cron (main app) | OUTSIDE_CURRENT_SCOPE | — | The legacy item describes a scheduled backend job, not a user/institutional ability represented by the closed UI action graph. |
| UE-CRON-OVERDUE-NOTIFICATIONS: Overdue-notifications cron (main app) | OUTSIDE_CURRENT_SCOPE | — | Scheduled notification processing is a backend mechanism, not a distinct capability established by this user-facing action graph. |
| UE-CRON-PROCESS-MESSAGES: Message-processing cron | OUTSIDE_CURRENT_SCOPE | — | Message processing is a scheduled backend mechanism; no user capability is inferred from the job label. |
| UE-CRON-PROCESS-NOTIFICATIONS: Notification-processing cron | OUTSIDE_CURRENT_SCOPE | — | Notification processing is a scheduled backend mechanism; user-facing notification actions are modeled separately. |
| UE-CRON-SCHEDULED-REPORTS: Scheduled-reports cron | OUTSIDE_CURRENT_SCOPE | — | The registry row describes a cron process, not the separate user-facing ability to inspect or generate reports. |
| UE-ADMIN-PILOT-STATUS: Pilot readiness aggregator (/api/admin/pilot-status) | OUTSIDE_CURRENT_SCOPE | — | An aggregator endpoint is implementation/observability plumbing; pilot-administration UI actions are separate and do not prove this endpoint capability. |
| UE-FIN-BOC-EXCHANGE-RATE: Bank of Canada FX rate resolution | OUTSIDE_CURRENT_SCOPE | — | FX resolution is a service behavior, not an independently evidenced user capability in the closed action graph. |
| UE-DEMO-SEPARATE-PACKAGE: Demo runtime is a separate npm package | OUTSIDE_CURRENT_SCOPE | — | Package separation is a delivery/build property, not a business capability. |
| UE-BUILD-OPERATIONAL-ISOLATION: Operational build carries no customer-specific demo content | OUTSIDE_CURRENT_SCOPE | — | Operational build isolation is a deployment property; sidebar actions do not turn it into a user capability. |
| UE-DASH-REPORTS-INDEX: Reports dashboard index (/dashboard/reports) — REMOVED | NO_SOURCE_SUPPORT | — | The registry explicitly marks the reports-index surface removed; do not retain a capability on its historical label. |
| UE-DASH-DEBUG: Developer debug page (/dashboard/debug) — dev-only | OUTSIDE_CURRENT_SCOPE | — | A dev-only debug page is not a business capability in the current user-facing model. |
| UE-DEV-SENTRY-EXAMPLE: Sentry example page (/sentry-example-page) — dev-only | OUTSIDE_CURRENT_SCOPE | — | A dev-only Sentry example page and its known missing implementation are not a Union Eyes business capability. |
| UE-DEADLINE-CORE: Deadline engine — core outbox schema | OUTSIDE_CURRENT_SCOPE | — | The registry row is a schema/engine implementation item; the closed graph's deadline actions are modeled separately. |
| UE-DEADLINE-REMINDERS: Deadline engine — reminder scheduler | OUTSIDE_CURRENT_SCOPE | — | A reminder scheduler is a backend mechanism; no scheduler runtime capability is inferred. |
| UE-DEADLINE-DELIVERY: Deadline engine — worker + at-least-once delivery | OUTSIDE_CURRENT_SCOPE | — | Worker/provider delivery guarantees are infrastructure properties outside this user-action capability model. |
| UE-DEADLINE-OVERDUE: Deadline engine — overdue detector | OUTSIDE_CURRENT_SCOPE | — | An overdue detector is a backend implementation item, not a separately evidenced user ability. |
| UE-DEADLINE-RECOVERY: Deadline engine — lease recovery + append-only audit | OUTSIDE_CURRENT_SCOPE | — | Lease recovery and append-only worker audit are backend mechanisms outside the closed UI action graph. |
| UE-DEADLINE-WORKER-CLAIM: Deadline engine — worker claim under FOR UPDATE SKIP LOCKED | OUTSIDE_CURRENT_SCOPE | — | Worker locking/claim semantics are technical implementation details, not a business capability. |
| UE-DEADLINE-EXECUTION-PERSISTENCE: Deadline engine — append-only execution rows | OUTSIDE_CURRENT_SCOPE | — | Execution-row persistence is a backend implementation detail; persistence is unproven in this phase. |
| UE-DEADLINE-PROVIDER-ACCEPTANCE: Deadline engine — provider acceptance via Resend | OUTSIDE_CURRENT_SCOPE | — | Provider acceptance is a delivery mechanism, not a user capability established by the action graph. |
| UE-DEADLINE-DIRECT-DEAD-LETTER: Deadline engine — immediate dead-letter on synchronous permanent failure | OUTSIDE_CURRENT_SCOPE | — | Dead-letter handling is a worker failure mechanism outside this source-derived user capability model. |
| UE-DUES-PORTAL-BALANCE: (untitled) | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | The closed graph contains member-facing dues/payment portal bindings; this maps to the broader source-bounded member dues self-service capability without asserting balance correctness. |
| UE-DUES-PORTAL-PAYMENT-HISTORY: Member dues portal — payment history | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | Payment-history action bindings are part of the same member dues self-service job; the inherited source ceiling remains visible. |
| UE-DUES-PORTAL-ISSUE-REPORTING: Member dues portal — deduction issue reporting | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | The source graph has a dues issue-reporting action; keep it within member dues self-service rather than inflate a separate capability. |
| UE-DUES-PORTAL-DEDUCTIONS: Member dues portal — payroll deduction history | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | Deduction-history actions belong to the same member-facing dues self-service ability. |
| UE-DUES-DIRECT-PAYMENT: Member dues portal — direct Stripe payment / autopay / saved payment methods | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | The closed graph contains dues payment-selection actions, but does not prove payment completion; retain the action under member dues self-service with its ceiling obligation. |
| UE-DEADLINE-ASSIGNMENT-CONTINUITY: Deadline engine — recipient continuity across representative reassignment | OUTSIDE_CURRENT_SCOPE | — | The registry row makes a backend recipient-continuity claim that is not established by this closed action graph; case responsibility and deadlines remain separate modeled source actions. |
| UE-CLAIM-DEADLINES-SURFACE: Claim deadlines (claim_deadlines table) — latent, unexposed surface | MERGED_INTO | CASE_DEADLINES | The source graph includes jurisdictional deadline calculation actions; it does not establish the latent claim_deadlines table surface or persistence. |
| UE-FIN-DUES-CALCULATION-WORKFLOW: Monthly dues calculation (financial-service microservice) | OUTSIDE_CURRENT_SCOPE | — | A financial-service calculation workflow is a backend process, not independently established by the user-facing action graph. |
| UE-FIN-DUES-REMINDER-SCHEDULER: Dues payment reminders (7-day / 1-day / overdue) | OUTSIDE_CURRENT_SCOPE | — | A reminder scheduler is a backend process; no runtime reminder capability is asserted. |
| UE-ANALYTICS-SCHEDULED-REPORTS-UI: Scheduled reports admin UI (duplicate surfaces) | MERGED_INTO | INSTITUTIONAL_REPORTING | Scheduled-report UI labels are not a separate capability; any source-supported report actions belong to institutional reporting, with defects/ceilings inherited per binding. |

Disposition totals:

| Disposition | Count |
| --- | --- |
| MERGED_INTO | 7 |
| NO_SOURCE_SUPPORT | 1 |
| OUTSIDE_CURRENT_SCOPE | 23 |

## New capabilities and taxonomy

**NEW_FROM_SOURCE_GRAPH = 30.** The exact IDs and why the earlier owner-path registry missed them are in `newFromSourceGraph` in the JSON.

| Domain | Capabilities |
| --- | --- |
| ADMINISTRATION | 3 |
| COMMUNICATION | 2 |
| DOCUMENT_EVIDENCE | 2 |
| ELECTION | 1 |
| FINANCE_DUES | 3 |
| GOVERNANCE | 2 |
| GRIEVANCE_CASE | 4 |
| HEALTH_SAFETY | 1 |
| IDENTITY | 1 |
| KNOWLEDGE_TRANSFER | 1 |
| LEARNING_TRAINING | 1 |
| MEMBERSHIP | 2 |
| ORGANIZING | 1 |
| OTHER_EXPLICIT | 8 |
| REPORTING_ANALYTICS | 1 |

The supplied finalized domains and source-facing persona taxonomy are used. `OTHER_EXPLICIT` is used only for explicit collective bargaining, arbitration-precedent/jurisdiction, public inquiry, workplace-risk-assessment, recognition, trustee/pension, and work-coordination jobs; each capability record carries a domain justification. No new taxonomy domain is introduced.

Persona capability counts may overlap:

| Persona | Capabilities |
| --- | --- |
| MEMBER | 5 |
| STAFF | 3 |
| EXECUTIVE | 2 |
| GOVERNANCE | 0 |
| ADMIN | 12 |
| PUBLIC | 7 |
| MULTI_PERSONA | 5 |
| OTHER_EXPLICIT | 29 |

## Binding and inherited-evidence coverage

| Coverage class | Bindings |
| --- | --- |
| TOTAL_CANONICAL_BINDINGS | 644 |
| BUSINESS_BINDINGS_MAPPED_TO_CAPABILITY | 614 |
| NON_BUSINESS_OR_INACTIVE_BINDINGS | 30 |
| INTENTIONALLY_DISABLED_BINDINGS | 0 |
| UNMAPPED_BUSINESS_BINDINGS | 0 |

**CAPABILITIES_WITH_SOURCE_CEILING = 30. CAPABILITIES_WITHOUT_SOURCE_CEILING = 3.** All 230 source-ceiling binding IDs retain their obligations in the binding map; 228 business-mapped source-ceiling bindings are inherited into capability records. The 2 non-business/inactive source-ceiling bindings remain binding-level only and are not forced into a business capability.

**CAPABILITIES_WITH_KNOWN_DEFECTS = 15. CAPABILITIES_WITH_BOTH = 14. CAPABILITIES_WITH_NEITHER = 2.** Overlap arithmetic: 15 + 30 - 14 = 31 capabilities with one or both conditions. Defect findings remain scoped to action bindings and do not imply that a parent capability as a whole is unusable.

## Business dependencies

| Capability | Business prerequisites |
| --- | --- |
| MEMBER_RECORDS | None evidenced |
| ORGANIZATION_STRUCTURE | None evidenced |
| USER_ACCESS | ORGANIZATION_STRUCTURE |
| CASE_RECORDS | None evidenced |
| CASE_RESPONSIBILITY | CASE_RECORDS |
| CASE_DEADLINES | CASE_RECORDS |
| CASE_COMMUNICATIONS | CASE_RECORDS |
| CASE_EVIDENCE | CASE_RECORDS |
| COLLECTIVE_BARGAINING | None evidenced |
| CALENDAR_MEETINGS | None evidenced |
| GOVERNANCE_ADMINISTRATION | None evidenced |
| ELECTIONS | None evidenced |
| HEALTH_SAFETY_CASES | None evidenced |
| ORGANIZING_CAMPAIGNS | None evidenced |
| MEMBER_DUES_SELF_SERVICE | None evidenced |
| DUES_REMITTANCE_ADMIN | MEMBER_DUES_SELF_SERVICE |
| FINANCIAL_PLANNING | None evidenced |
| GENERAL_COMMUNICATIONS | None evidenced |
| ARBITRATION_PRECEDENT_KNOWLEDGE | None evidenced |
| DOCUMENT_LIBRARY | None evidenced |
| LEARNING_TRAINING | None evidenced |
| KNOWLEDGE_HANDOFF | None evidenced |
| INSTITUTIONAL_REPORTING | None evidenced |
| PILOT_ADMINISTRATION | None evidenced |
| PUBLIC_INQUIRIES | None evidenced |
| WORKPLACE_RISK_ASSESSMENT | None evidenced |
| MEMBER_RECOGNITION | None evidenced |
| TRUSTEE_PENSION_PORTAL | None evidenced |
| ORGANIZATION_RISK_CONTROLS | None evidenced |
| WORK_COORDINATION | None evidenced |
| APPLICATION_ADMINISTRATION | None evidenced |
| AI_CASE_ASSISTANCE | None evidenced |
| AI_COLLECTIVE_AGREEMENT_ASSISTANCE | None evidenced |

These are business prerequisites, not technical service or database dependencies.

## Institutional continuity

| Dimension | Source-model signal | Capability IDs |
| --- | --- | --- |
| ownership/assignment | PRESENT — not proven operational | CASE_RESPONSIBILITY, HEALTH_SAFETY_CASES, ORGANIZING_CAMPAIGNS |
| successor handoff | PRESENT — not proven operational | KNOWLEDGE_HANDOFF |
| institutional record retention | PRESENT — not proven operational | MEMBER_RECORDS, ORGANIZATION_STRUCTURE, CASE_RECORDS, CASE_EVIDENCE, COLLECTIVE_BARGAINING, GOVERNANCE_ADMINISTRATION, ELECTIONS, HEALTH_SAFETY_CASES, MEMBER_DUES_SELF_SERVICE, DUES_REMITTANCE_ADMIN, FINANCIAL_PLANNING, GENERAL_COMMUNICATIONS, ARBITRATION_PRECEDENT_KNOWLEDGE, DOCUMENT_LIBRARY, KNOWLEDGE_HANDOFF, INSTITUTIONAL_REPORTING |
| deadline continuity | PRESENT — not proven operational | CASE_DEADLINES, CALENDAR_MEETINGS |
| restricted evidence continuity | PRESENT — not proven operational | CASE_EVIDENCE |
| auditability | PRESENT — not proven operational | GOVERNANCE_ADMINISTRATION, DUES_REMITTANCE_ADMIN, FINANCIAL_PLANNING |
| knowledge/context preservation | PRESENT — not proven operational | COLLECTIVE_BARGAINING, ARBITRATION_PRECEDENT_KNOWLEDGE, LEARNING_TRAINING, KNOWLEDGE_HANDOFF |
| case communications | PRESENT — not proven operational | CASE_COMMUNICATIONS |

Potential continuity-related source capabilities include assignment, deadline actions, evidence/record handling, case communications, and knowledge handoff. Their source presence is not proof of assignment durability, retention, restrictions, auditability, deadline delivery, or successful succession.

## External-specialist / WorkAid scope

No WorkAid integration, external-party role, or restricted external access is inferred. The accepted evidence does not establish the requested bounded external-specialist workflow as a current capability. The JSON lists each requested dimension as `NOT_ESTABLISHED`; generic case or document actions do not fill those gaps.

## AI-assisted capabilities

| AI-assisted capability | Underlying capability IDs | Bindings | Source-ceiling bindings | Runtime proven |
| --- | --- | --- | --- | --- |
| AI_CASE_ASSISTANCE: AI-assisted case and steward support | CASE_RECORDS | 5 | 2 | NO |
| AI_COLLECTIVE_AGREEMENT_ASSISTANCE: AI-assisted collective-agreement analysis | COLLECTIVE_BARGAINING | 9 | 7 | NO |

AI-assisted actions are distinct from the underlying institutional capability. They retain their source-ceiling obligations and do not imply provider availability, output quality, human review, or persistence.

## Validation and gate

| Validation | Result |
| --- | --- |
| allCanonicalCapabilitiesHaveActionFamilyAndBindingEvidence | PASS |
| allLegacyCuratedCapabilitiesReconciled | PASS |
| allRelevantBusinessBindingsMapped | PASS |
| allSourceCeilingBindingsRetainedAtBindingLevel | PASS |
| allBusinessSourceCeilingBindingsInherited | PASS |
| allKnownDefectBusinessBindingsInherited | PASS |
| noRuntimeClaimIntroduced | PASS |
| noApplicationSourceInspected | PASS |
| noRuntimeActionExecuted | PASS |
| taxonomyAndPersonaEnumsValid | PASS |
| bindingCoverageArithmetic | PASS |
| noDuplicateBindingWithinCapability | PASS |
| dependenciesResolve | PASS |

**PHASE_1A_3A_SOURCE_MODEL = PASS.**

- `CAPABILITY_RUNTIME_PROVEN = NO`
- `CAPABILITY_AUTHORIZATION_PROVEN = NO`
- `CAPABILITY_PERSISTENCE_PROVEN = NO`
- `PHASE_1A_3 = NOT YET COMPLETE`; `PHASE_1A = NOT YET PROVEN`
- `PHASE_1B = NOT AUTHORIZED`; `PRODUCT_READY = NO`
- No Phase 1A.3b, Phase 1B, or Phase 2 work was started.

The binding-level classifications, exact legacy-row dispositions, capability dependencies, continuity and external-specialist evidence, and validation details are in [PHASE_1A_3A_BUSINESS_CAPABILITY_MODEL.json](./PHASE_1A_3A_BUSINESS_CAPABILITY_MODEL.json).
