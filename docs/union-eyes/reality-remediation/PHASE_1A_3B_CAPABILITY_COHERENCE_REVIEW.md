# Phase 1A.3b — Capability Coherence Review

**PHASE_1A_3B_GATE = PASS.** This is an adversarial source-model coherence review, not runtime proof or authorization. Primary evidence is the accepted Phase 1A.3a model; Phase 1A.2 is used only for supporting closeout facts. No application source was inspected and no runtime action was executed.

## Gate and evidence boundary

| Item | Result |
| --- | --- |
| Original capability concepts | 33 |
| Retained canonical capability concepts | 32 |
| Concepts removed as unsupported/non-capabilities | 1 |
| Canonical binding denominator | 644 |
| Business bindings after review | 612 |
| Non-business/inactive bindings after review | 32 |
| Unmapped business candidates | 0 |
| Source-ceiling binding obligations retained | 230/230 |
| Residual effect-chain obligations retained | 247/247 |
| Known-defect binding rows retained | 58/58 |
| Legacy registry rows reconciled | 31/31 |

The 230 source-ceiling obligations remain open/deferred. The review does not resolve the 1A.2 source ceiling, authorize execution, or prove Phase 1A complete. **Phase 1A remains NOT_YET_PROVEN; Phase 1B and Phase 2 remain NOT_AUTHORIZED; product readiness remains NO.**

## Capability dispositions and exposure

| Capability ID | Capability | Disposition | Criticality | Bindings | Defect bindings | Ceiling bindings | Flags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MEMBER_RECORDS | Maintain member records | RENAME | CORE | 9 | 2 | 1 | — |
| ORGANIZATION_STRUCTURE | Maintain organizational structure | CONFIRMED | CORE | 73 | 6 | 41 | HIGH_CEILING_EXPOSURE |
| USER_ACCESS | Administer user accounts and access | RENAME | MATERIAL | 31 | 3 | 8 | — |
| CASE_RECORDS | Manage grievance and claim matters | RENAME | CORE | 23 | 1 | 10 | — |
| CASE_RESPONSIBILITY | Assign responsibility for case and operational work | RENAME | CORE | 12 | 1 | 4 | — |
| CASE_DEADLINES | Calculate matter deadlines | RENAME | CORE | 2 | 1 | 0 | HIGH_DEFECT_EXPOSURE |
| CASE_COMMUNICATIONS | Record matter-related communications | CONFIRMED | CORE | 9 | 0 | 1 | — |
| CASE_EVIDENCE | Capture and manage case evidence | CONFIRMED | CORE | 30 | 0 | 11 | — |
| COLLECTIVE_BARGAINING | Develop collective-agreement positions | RENAME | MATERIAL | 11 | 0 | 9 | HIGH_CEILING_EXPOSURE |
| CALENDAR_MEETINGS | Manage calendars, meetings, and institutional events | RENAME | MATERIAL | 46 | 2 | 9 | — |
| GOVERNANCE_ADMINISTRATION | Administer union governance | CONFIRMED | CORE | 28 | 0 | 17 | HIGH_CEILING_EXPOSURE |
| ELECTIONS | Administer elections and ballot participation | CONFIRMED | MATERIAL | 7 | 0 | 0 | — |
| HEALTH_SAFETY_CASES | Manage workplace health and safety matters | RENAME | CORE | 37 | 6 | 10 | — |
| ORGANIZING_CAMPAIGNS | Coordinate organizing campaigns and engagement | RENAME | CORE | 25 | 6 | 12 | — |
| MEMBER_DUES_SELF_SERVICE | Review member dues and payment records | CONFIRMED | MATERIAL | 11 | 0 | 5 | — |
| DUES_REMITTANCE_ADMIN | Administer dues and remittance records | CONFIRMED | MATERIAL | 20 | 8 | 9 | HIGH_DEFECT_EXPOSURE |
| FINANCIAL_PLANNING | Plan organizational finances and expenses | RENAME | MATERIAL | 28 | 0 | 4 | — |
| GENERAL_COMMUNICATIONS | Manage organizational communications and surveys | RENAME | MATERIAL | 45 | 5 | 19 | — |
| ARBITRATION_PRECEDENT_KNOWLEDGE | Maintain arbitration precedent and jurisdiction knowledge | RENAME | MATERIAL | 26 | 2 | 4 | — |
| DOCUMENT_LIBRARY | Manage institutional documents | RENAME | MATERIAL | 7 | 0 | 5 | HIGH_CEILING_EXPOSURE |
| LEARNING_TRAINING | Support member learning and training | DEMOTE_TO_SUPPORTING | SUPPORTING | 6 | 0 | 3 | HIGH_CEILING_EXPOSURE |
| KNOWLEDGE_HANDOFF | Preserve and transfer institutional knowledge | CONFIRMED | CORE | 17 | 0 | 3 | — |
| INSTITUTIONAL_REPORTING | Generate institutional reports and analytics | SPLIT | MATERIAL | 26 | 7 | 7 | HIGH_DEFECT_EXPOSURE |
| PILOT_ADMINISTRATION | Coordinate pilot onboarding and administration | CONFIRMED | SUPPORTING | 20 | 0 | 11 | HIGH_CEILING_EXPOSURE |
| PUBLIC_INQUIRIES | Receive public inquiries and pilot requests | CONFIRMED | SUPPORTING | 4 | 0 | 2 | HIGH_CEILING_EXPOSURE |
| WORKPLACE_RISK_ASSESSMENT | Complete workplace risk assessments and reports | RENAME | MATERIAL | 12 | 0 | 3 | — |
| MEMBER_RECOGNITION | Administer member recognition and rewards | RENAME | SUPPORTING | 6 | 0 | 0 | — |
| ORGANIZATION_RISK_CONTROLS | Record privacy, consent, and compliance actions | RENAME | SUPPORTING | 3 | 1 | 2 | HIGH_CEILING_EXPOSURE, HIGH_DEFECT_EXPOSURE |
| WORK_COORDINATION | Coordinate workbench queues | RENAME | SUPPORTING | 3 | 0 | 2 | HIGH_CEILING_EXPOSURE |
| APPLICATION_ADMINISTRATION | Configure and administer the application | RENAME | SUPPORTING | 31 | 4 | 12 | — |
| AI_CASE_ASSISTANCE | AI-assisted case and steward support | RENAME | SUPPORTING | 5 | 2 | 2 | HIGH_DEFECT_EXPOSURE |
| AI_COLLECTIVE_AGREEMENT_ASSISTANCE | AI-assisted collective-agreement analysis | RENAME | SUPPORTING | 9 | 0 | 7 | HIGH_CEILING_EXPOSURE |

Capability status describes the bounded source evidence, not feature usability. High-ceiling exposure means a source-ceiling ratio at least 0.50; high-defect exposure means a known-defect ratio at least 0.25.

### Binding volume and thin/large capability review

| Binding volume band | Count |
| --- | --- |
| LARGE_OVER_20 | 13 |
| MEDIUM_6_TO_20 | 14 |
| SMALL_3_TO_5 | 4 |
| THIN_1_TO_2 | 1 |

**Thin (1–2 bindings):** CASE_DEADLINES (2).

**Large (>20 bindings):** ORGANIZATION_STRUCTURE (73; Organization hierarchy, organization records, bulk operations, and organization settings form one coherent administrative ability; after 14 evidence-based transfers from reporting, its 73-binding breadth remains broad and its high ceiling exposure is retained.); USER_ACCESS (31; Identity, invitation, profile, and sharing-control work belongs to access administration, distinct from the member-record outcome.); CASE_RECORDS (23; The shared matter lifecycle is coherent; case records remain distinct from assignments, deadlines, communication, and evidence.); CASE_EVIDENCE (30; Evidence handling is a coherent case-support outcome and remains distinct from the general document library.); CALENDAR_MEETINGS (46; Calendar and event creation, update, selection, and synchronization are one lifecycle, not separate screen-level abilities.); GOVERNANCE_ADMINISTRATION (28; Committee, vote, oversight, and reserved-matter work shares a governance outcome; no separate capability is justified by UI division alone.); HEALTH_SAFETY_CASES (37; Incident, hazard, inspection, and corrective-action workflows are a coherent domain and remain separate from general grievances.); ORGANIZING_CAMPAIGNS (25; Campaign, target, and campaign-note actions form one organizing ability; communication delivery is not independently inferred.); FINANCIAL_PLANNING (28; Budget, expense, vendor, and forecast work is coherent and distinct from member dues and remittance.); GENERAL_COMMUNICATIONS (45; Distribution lists, templates, communication preferences, and survey response actions are one communication domain; case communications remain separate.); ARBITRATION_PRECEDENT_KNOWLEDGE (26; Precedent and jurisdiction preference work is one coherent knowledge ability, separate from bargaining-position development.); INSTITUTIONAL_REPORTING (26; The existing mapping mixed analytics with organization CRUD, app configuration, user profile/access, privacy/compliance, recognition, and workplace-risk reporting. Those named binding groups are reassigned to existing coherent capabilities; no new capability is added.); APPLICATION_ADMINISTRATION (31; Platform settings, maintenance, and administrative operations form a supporting system-administration ability.).

Thinness and breadth were treated as review prompts, not automatic grounds to invent, merge, or split capabilities.

## Reassignments and non-business reclassifications

| Binding ID | From | To | Evidence rationale |
| --- | --- | --- | --- |
| app/[locale]/dashboard/admin/organizations/[id]/edit/page.tsx:271:7:onSubmit | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/[id]/edit/page.tsx:493:15:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/[id]/page.tsx:555:11:onSelectOrganization | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/[id]/page.tsx:674:17:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/new/page.tsx:198:7:onSubmit | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/page.tsx:433:35:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/page.tsx:437:35:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/page.tsx:441:35:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/page.tsx:445:35:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/page.tsx:466:15:onSelect | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/organizations/page.tsx:485:7:onOpenChange | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/admin/page.tsx:1534:19:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/page.tsx:1549:19:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/page.tsx:443:17:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/page.tsx:450:17:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/page.tsx:457:17:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/page.tsx:464:17:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/page.tsx:607:29:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/page.tsx:620:31:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/page.tsx:627:31:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/page.tsx:860:23:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/admin/rewards/shopify/page.tsx:282:9:onClick | INSTITUTIONAL_REPORTING | MEMBER_RECOGNITION | The accepted source path is explicitly the admin rewards store; rewards are part of member recognition, not reporting. |
| app/[locale]/dashboard/compliance/page.tsx:97:9:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_RISK_CONTROLS | The accepted source path/action family identifies consent/privacy/compliance controls, not reporting. |
| app/[locale]/dashboard/error.tsx:63:13:onClick | INSTITUTIONAL_REPORTING | NON_BUSINESS_OR_INACTIVE | The accepted closeout identifies a dashboard error-boundary reset action; that is presentation/recovery behavior, not an institutional reporting ability. |
| app/[locale]/dashboard/profile/page.tsx:1173:23:onClick | INSTITUTIONAL_REPORTING | USER_ACCESS | The accepted source path/action family identifies profile or sharing/access settings, not institutional reporting. |
| app/[locale]/dashboard/settings/_components/org-settings-content.tsx:821:27:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/settings/_components/org-settings-content.tsx:964:17:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/settings/_components/org-settings-content.tsx:970:17:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_STRUCTURE | Accepted source path and action-family identity identify organization records/settings, not reporting or analytics. |
| app/[locale]/dashboard/settings/_components/platform-settings-content.tsx:481:25:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/settings/_components/platform-settings-content.tsx:517:17:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/settings/_components/platform-settings-content.tsx:520:17:onClick | INSTITUTIONAL_REPORTING | APPLICATION_ADMINISTRATION | The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting. |
| app/[locale]/dashboard/settings/sharing/page.tsx:81:11:onSave | INSTITUTIONAL_REPORTING | USER_ACCESS | The accepted source path/action family identifies profile or sharing/access settings, not institutional reporting. |
| components/admin/members-console.tsx:482:13:onClick | MEMBER_RECORDS | USER_ACCESS | The accepted action-family identity is handleSendInvite; the binding is assigned to user-access administration rather than counted simultaneously as member-record maintenance. |
| components/education/MemberCertificates.tsx:322:21:onClick | MEMBER_RECORDS | LEARNING_TRAINING | The accepted action-family path explicitly identifies member certificates in the education surface; education belongs with member learning, not member-record administration. |
| components/education/MemberCertificates.tsx:332:21:onClick | MEMBER_RECORDS | LEARNING_TRAINING | The accepted action-family path explicitly identifies member certificates in the education surface; education belongs with member learning, not member-record administration. |
| components/education/MemberCertificates.tsx:341:21:onClick | MEMBER_RECORDS | LEARNING_TRAINING | The accepted action-family path explicitly identifies member certificates in the education surface; education belongs with member learning, not member-record administration. |
| components/icra/ICRAReportGate.tsx:205:13:onClick | INSTITUTIONAL_REPORTING | WORKPLACE_RISK_ASSESSMENT | The accepted source path/action family identifies ICRA assessment/report actions, not general reporting. |
| components/icra/PrintReportButton.tsx:10:5:onClick | INSTITUTIONAL_REPORTING | WORKPLACE_RISK_ASSESSMENT | The accepted source path/action family identifies ICRA assessment/report actions, not general reporting. |
| components/marketing/revoke-consent-button.tsx:121:11:onClick | INSTITUTIONAL_REPORTING | ORGANIZATION_RISK_CONTROLS | The accepted source path/action family identifies consent/privacy/compliance controls, not reporting. |
| components/pension/trustee-portal-page.tsx:83:15:onClick | TRUSTEE_PENSION_PORTAL | NON_BUSINESS_OR_INACTIVE | A single inline trustee-portal UI binding has no confirmed operation in the accepted action graph; retain its source-ceiling obligation without treating portal access as an institutional capability. |
| components/sharing/SharingSettingsForm.tsx:355:9:onClick | INSTITUTIONAL_REPORTING | USER_ACCESS | The accepted source path/action family identifies profile or sharing/access settings, not institutional reporting. |

Each changed row retains its original binding identity, source disposition, known-defect identifiers/categories, and source-ceiling obligation identifiers. The dashboard error-boundary reset and single trustee-portal inline action are reclassified as non-business/inactive; their open assurance obligations remain attached at binding level.

## Cross-capability overlap and hierarchy

- Retained overlapping bindings: **10**. Each is an explicit AI-support overlay paired with an institutional capability; no unrelated multi-capability assignment is retained.
- Parent groupings: **0**.
- Dependency relationships from the source model: **32**. These are not workflow execution or sequencing proof.

| Binding ID | Capabilities | Disposition | Defects retained | Ceiling obligations retained |
| --- | --- | --- | --- | --- |
| components/ai/clause-reasoning-panel.tsx:78:13:onClick | COLLECTIVE_BARGAINING, AI_COLLECTIVE_AGREEMENT_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | BINDING-47789aba23bc |
| components/cba-intelligence/agreement-explorer.tsx:191:11:onClick | COLLECTIVE_BARGAINING, AI_COLLECTIVE_AGREEMENT_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | BINDING-e4867731208a |
| components/cba-intelligence/benchmark-view.tsx:232:11:onClick | COLLECTIVE_BARGAINING, AI_COLLECTIVE_AGREEMENT_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | BINDING-022e123315fd |
| components/cba-intelligence/benchmark-view.tsx:345:15:onClick | COLLECTIVE_BARGAINING, AI_COLLECTIVE_AGREEMENT_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | BINDING-99c757ee80e6 |
| components/cba-intelligence/freshness-dashboard.tsx:204:11:onClick | COLLECTIVE_BARGAINING, AI_COLLECTIVE_AGREEMENT_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | None |
| components/cba-intelligence/freshness-dashboard.tsx:205:11:onClick | COLLECTIVE_BARGAINING, AI_COLLECTIVE_AGREEMENT_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | None |
| components/cba-intelligence/review-queue.tsx:328:35:onClick | COLLECTIVE_BARGAINING, AI_COLLECTIVE_AGREEMENT_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | BINDING-acfa8716bb86 |
| components/clause-suggestions.tsx:140:19:onClick | COLLECTIVE_BARGAINING, AI_COLLECTIVE_AGREEMENT_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | BINDING-eee015373999, CHAIN-UE-B2-CHAIN-0376 |
| components/clause-suggestions.tsx:92:11:onClick | COLLECTIVE_BARGAINING, AI_COLLECTIVE_AGREEMENT_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | BINDING-da7f6affe332, CHAIN-UE-B2-CHAIN-0121 |
| components/steward-recommendations.tsx:81:9:onClick | CASE_RECORDS, AI_CASE_ASSISTANCE | BUSINESS_BINDING_MAPPED | None | None |

## Persona assessment

| Capability ID | Primary outcome actors | Secondary actors | Incidental actors | Authorization established? |
| --- | --- | --- | --- | --- |
| MEMBER_RECORDS | ADMIN, STAFF | OTHER_EXPLICIT | None | No |
| ORGANIZATION_STRUCTURE | ADMIN | MULTI_PERSONA, OTHER_EXPLICIT | None | No |
| USER_ACCESS | ADMIN, MEMBER | MULTI_PERSONA, OTHER_EXPLICIT, PUBLIC | None | No |
| CASE_RECORDS | MEMBER | OTHER_EXPLICIT | None | No |
| CASE_RESPONSIBILITY | OTHER_EXPLICIT | None | None | No |
| CASE_DEADLINES | MEMBER | None | None | No |
| CASE_COMMUNICATIONS | STAFF | None | None | No |
| CASE_EVIDENCE | OTHER_EXPLICIT | None | None | No |
| COLLECTIVE_BARGAINING | OTHER_EXPLICIT | None | None | No |
| CALENDAR_MEETINGS | OTHER_EXPLICIT | None | None | No |
| GOVERNANCE_ADMINISTRATION | EXECUTIVE, ADMIN | OTHER_EXPLICIT, PUBLIC | None | No |
| ELECTIONS | ADMIN | MULTI_PERSONA, OTHER_EXPLICIT | None | No |
| HEALTH_SAFETY_CASES | OTHER_EXPLICIT | None | None | No |
| ORGANIZING_CAMPAIGNS | OTHER_EXPLICIT | None | None | No |
| MEMBER_DUES_SELF_SERVICE | MULTI_PERSONA | OTHER_EXPLICIT | None | No |
| DUES_REMITTANCE_ADMIN | ADMIN | OTHER_EXPLICIT | None | No |
| FINANCIAL_PLANNING | OTHER_EXPLICIT | None | None | No |
| GENERAL_COMMUNICATIONS | STAFF, ADMIN | OTHER_EXPLICIT, PUBLIC | None | No |
| ARBITRATION_PRECEDENT_KNOWLEDGE | OTHER_EXPLICIT | None | None | No |
| DOCUMENT_LIBRARY | ADMIN | MEMBER, OTHER_EXPLICIT | None | No |
| LEARNING_TRAINING | OTHER_EXPLICIT | None | None | No |
| KNOWLEDGE_HANDOFF | OTHER_EXPLICIT | PUBLIC | None | No |
| INSTITUTIONAL_REPORTING | ADMIN, EXECUTIVE | MULTI_PERSONA, OTHER_EXPLICIT, PUBLIC | None | No |
| PILOT_ADMINISTRATION | ADMIN | MEMBER, OTHER_EXPLICIT | None | No |
| PUBLIC_INQUIRIES | PUBLIC | None | None | No |
| WORKPLACE_RISK_ASSESSMENT | PUBLIC | None | None | No |
| MEMBER_RECOGNITION | ADMIN | OTHER_EXPLICIT | None | No |
| ORGANIZATION_RISK_CONTROLS | OTHER_EXPLICIT | None | None | No |
| WORK_COORDINATION | OTHER_EXPLICIT | None | None | No |
| APPLICATION_ADMINISTRATION | ADMIN | OTHER_EXPLICIT | None | No |
| AI_CASE_ASSISTANCE | OTHER_EXPLICIT | None | None | No |
| AI_COLLECTIVE_AGREEMENT_ASSISTANCE | OTHER_EXPLICIT | None | None | No |

Persona classifications are analytical, not authorization evidence. Source audience tags do not establish role enforcement or an actual population.

## Institutional continuity

| Continuity dimension | Source signal | Capability IDs | Operational proof |
| --- | --- | --- | --- |
| ownership/assignment | Present | CASE_RESPONSIBILITY, HEALTH_SAFETY_CASES, ORGANIZING_CAMPAIGNS | NO |
| successor handoff | Present | KNOWLEDGE_HANDOFF | NO |
| institutional record retention | Present | MEMBER_RECORDS, ORGANIZATION_STRUCTURE, CASE_RECORDS, CASE_EVIDENCE, COLLECTIVE_BARGAINING, GOVERNANCE_ADMINISTRATION, ELECTIONS, HEALTH_SAFETY_CASES, MEMBER_DUES_SELF_SERVICE, DUES_REMITTANCE_ADMIN, FINANCIAL_PLANNING, GENERAL_COMMUNICATIONS, ARBITRATION_PRECEDENT_KNOWLEDGE, DOCUMENT_LIBRARY, KNOWLEDGE_HANDOFF, INSTITUTIONAL_REPORTING | NO |
| deadline continuity | Present | CASE_DEADLINES, CALENDAR_MEETINGS | NO |
| restricted evidence continuity | Present | CASE_EVIDENCE | NO |
| auditability | Present | GOVERNANCE_ADMINISTRATION, DUES_REMITTANCE_ADMIN, FINANCIAL_PLANNING | NO |
| knowledge/context preservation | Present | COLLECTIVE_BARGAINING, ARBITRATION_PRECEDENT_KNOWLEDGE, LEARNING_TRAINING, KNOWLEDGE_HANDOFF | NO |
| case communications | Present | CASE_COMMUNICATIONS | NO |

Each signal remains a source-model signal only; this review does not prove ownership, recovery, continuity operation, or service levels.

## External specialist and AI assessments

- **WorkAid integration inferred:** false.
- **External specialist dimensions supported by source evidence:** None.
- **AI overlays:** AI_CASE_ASSISTANCE → CASE_RECORDS (SUPPORTING_OVERLAY_ONLY); AI_COLLECTIVE_AGREEMENT_ASSISTANCE → COLLECTIVE_BARGAINING (SUPPORTING_OVERLAY_ONLY).

No external integration, specialist access controls, AI provider availability, output quality, privacy behavior, human review, persistence, or runtime behavior is proven.

## Legacy registry reconciliation

| Legacy ID | Legacy item | Disposition | Canonical capability IDs | Rationale |
| --- | --- | --- | --- | --- |
| UE-CRON-MONTHLY-DUES | Monthly dues cron (main app) | OUTSIDE_CURRENT_SCOPE | — | The legacy item describes a scheduled backend job, not a user/institutional ability represented by the closed UI action graph. |
| UE-CRON-OVERDUE-NOTIFICATIONS | Overdue-notifications cron (main app) | OUTSIDE_CURRENT_SCOPE | — | Scheduled notification processing is a backend mechanism, not a distinct capability established by this user-facing action graph. |
| UE-CRON-PROCESS-MESSAGES | Message-processing cron | OUTSIDE_CURRENT_SCOPE | — | Message processing is a scheduled backend mechanism; no user capability is inferred from the job label. |
| UE-CRON-PROCESS-NOTIFICATIONS | Notification-processing cron | OUTSIDE_CURRENT_SCOPE | — | Notification processing is a scheduled backend mechanism; user-facing notification actions are modeled separately. |
| UE-CRON-SCHEDULED-REPORTS | Scheduled-reports cron | OUTSIDE_CURRENT_SCOPE | — | The registry row describes a cron process, not the separate user-facing ability to inspect or generate reports. |
| UE-ADMIN-PILOT-STATUS | Pilot readiness aggregator (/api/admin/pilot-status) | OUTSIDE_CURRENT_SCOPE | — | An aggregator endpoint is implementation/observability plumbing; pilot-administration UI actions are separate and do not prove this endpoint capability. |
| UE-FIN-BOC-EXCHANGE-RATE | Bank of Canada FX rate resolution | OUTSIDE_CURRENT_SCOPE | — | FX resolution is a service behavior, not an independently evidenced user capability in the closed action graph. |
| UE-DEMO-SEPARATE-PACKAGE | Demo runtime is a separate npm package | OUTSIDE_CURRENT_SCOPE | — | Package separation is a delivery/build property, not a business capability. |
| UE-BUILD-OPERATIONAL-ISOLATION | Operational build carries no customer-specific demo content | OUTSIDE_CURRENT_SCOPE | — | Operational build isolation is a deployment property; sidebar actions do not turn it into a user capability. |
| UE-DASH-REPORTS-INDEX | Reports dashboard index (/dashboard/reports) — REMOVED | NO_SOURCE_SUPPORT | — | The registry explicitly marks the reports-index surface removed; do not retain a capability on its historical label. |
| UE-DASH-DEBUG | Developer debug page (/dashboard/debug) — dev-only | OUTSIDE_CURRENT_SCOPE | — | A dev-only debug page is not a business capability in the current user-facing model. |
| UE-DEV-SENTRY-EXAMPLE | Sentry example page (/sentry-example-page) — dev-only | OUTSIDE_CURRENT_SCOPE | — | A dev-only Sentry example page and its known missing implementation are not a Union Eyes business capability. |
| UE-DEADLINE-CORE | Deadline engine — core outbox schema | OUTSIDE_CURRENT_SCOPE | — | The registry row is a schema/engine implementation item; the closed graph's deadline actions are modeled separately. |
| UE-DEADLINE-REMINDERS | Deadline engine — reminder scheduler | OUTSIDE_CURRENT_SCOPE | — | A reminder scheduler is a backend mechanism; no scheduler runtime capability is inferred. |
| UE-DEADLINE-DELIVERY | Deadline engine — worker + at-least-once delivery | OUTSIDE_CURRENT_SCOPE | — | Worker/provider delivery guarantees are infrastructure properties outside this user-action capability model. |
| UE-DEADLINE-OVERDUE | Deadline engine — overdue detector | OUTSIDE_CURRENT_SCOPE | — | An overdue detector is a backend implementation item, not a separately evidenced user ability. |
| UE-DEADLINE-RECOVERY | Deadline engine — lease recovery + append-only audit | OUTSIDE_CURRENT_SCOPE | — | Lease recovery and append-only worker audit are backend mechanisms outside the closed UI action graph. |
| UE-DEADLINE-WORKER-CLAIM | Deadline engine — worker claim under FOR UPDATE SKIP LOCKED | OUTSIDE_CURRENT_SCOPE | — | Worker locking/claim semantics are technical implementation details, not a business capability. |
| UE-DEADLINE-EXECUTION-PERSISTENCE | Deadline engine — append-only execution rows | OUTSIDE_CURRENT_SCOPE | — | Execution-row persistence is a backend implementation detail; persistence is unproven in this phase. |
| UE-DEADLINE-PROVIDER-ACCEPTANCE | Deadline engine — provider acceptance via Resend | OUTSIDE_CURRENT_SCOPE | — | Provider acceptance is a delivery mechanism, not a user capability established by the action graph. |
| UE-DEADLINE-DIRECT-DEAD-LETTER | Deadline engine — immediate dead-letter on synchronous permanent failure | OUTSIDE_CURRENT_SCOPE | — | Dead-letter handling is a worker failure mechanism outside this source-derived user capability model. |
| UE-DUES-PORTAL-BALANCE | null | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | The closed graph contains member-facing dues/payment portal bindings; this maps to the broader source-bounded member dues self-service capability without asserting balance correctness. |
| UE-DUES-PORTAL-PAYMENT-HISTORY | Member dues portal — payment history | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | Payment-history action bindings are part of the same member dues self-service job; the inherited source ceiling remains visible. |
| UE-DUES-PORTAL-ISSUE-REPORTING | Member dues portal — deduction issue reporting | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | The source graph has a dues issue-reporting action; keep it within member dues self-service rather than inflate a separate capability. |
| UE-DUES-PORTAL-DEDUCTIONS | Member dues portal — payroll deduction history | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | Deduction-history actions belong to the same member-facing dues self-service ability. |
| UE-DUES-DIRECT-PAYMENT | Member dues portal — direct Stripe payment / autopay / saved payment methods | MERGED_INTO | MEMBER_DUES_SELF_SERVICE | The closed graph contains dues payment-selection actions, but does not prove payment completion; retain the action under member dues self-service with its ceiling obligation. |
| UE-DEADLINE-ASSIGNMENT-CONTINUITY | Deadline engine — recipient continuity across representative reassignment | OUTSIDE_CURRENT_SCOPE | — | The registry row makes a backend recipient-continuity claim that is not established by this closed action graph; case responsibility and deadlines remain separate modeled source actions. |
| UE-CLAIM-DEADLINES-SURFACE | Claim deadlines (claim_deadlines table) — latent, unexposed surface | MERGED_INTO | CASE_DEADLINES | The source graph includes jurisdictional deadline calculation actions; it does not establish the latent claim_deadlines table surface or persistence. |
| UE-FIN-DUES-CALCULATION-WORKFLOW | Monthly dues calculation (financial-service microservice) | OUTSIDE_CURRENT_SCOPE | — | A financial-service calculation workflow is a backend process, not independently established by the user-facing action graph. |
| UE-FIN-DUES-REMINDER-SCHEDULER | Dues payment reminders (7-day / 1-day / overdue) | OUTSIDE_CURRENT_SCOPE | — | A reminder scheduler is a backend process; no runtime reminder capability is asserted. |
| UE-ANALYTICS-SCHEDULED-REPORTS-UI | Scheduled reports admin UI (duplicate surfaces) | MERGED_INTO | INSTITUTIONAL_REPORTING | Scheduled-report UI labels are not a separate capability; any source-supported report actions belong to institutional reporting, with defects/ceilings inherited per binding. |

**Reconciled 31/31 legacy rows.** Legacy registry labels and owner-path references are not treated as proof of implementation or runtime capability.

## Source-ceiling and defect retention

- All **230** source-ceiling binding obligations remain associated with the same binding IDs and obligation IDs; all remain **OPEN_DEFERRED** with execution authorization false.
- All **247** residual effect-chain obligations remain associated with the same chain IDs, obligation IDs, and binding IDs; all remain **OPEN_DEFERRED** with execution authorization false.
- All **58** binding rows carrying known-defect IDs or categories retain those identifiers/categories. No defect was resolved by this review.
- Full retained ID-level records are in the JSON report.

## Validation and phase disposition

| Check | Result |
| --- | --- |
| allCanonicalBindingsRetained | true |
| allBindingsClassified | true |
| bindingClassificationArithmetic | true |
| allSourceCeilingObligationsRetained | true |
| allResidualEffectChainObligationsRetained | true |
| allKnownDefectIdsAndCategoriesRetained | true |
| allLegacyRegistryRowsReconciled | true |
| everyRetainedCapabilityHasBindings | true |
| personaReviewCoversEveryRetainedCapability | true |
| allCrossCapabilityMappingsAreExplicitAiOverlays | true |
| noRuntimeAuthorizationPersistenceOrReadinessClaimIntroduced | true |
| applicationSourceInspected | false |
| runtimeActionExecuted | false |
| phase1A4Started | false |
| phase1BStarted | false |
| phase2Started | false |

This completes only the 1A.3b coherence-review artifact. It does not start Phase 1A.4, Phase 1B, or Phase 2.
