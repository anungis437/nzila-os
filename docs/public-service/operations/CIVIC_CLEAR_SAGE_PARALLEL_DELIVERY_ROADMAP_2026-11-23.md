# CIVIC / CLEAR / SAGE — Parallel Delivery Blueprint (alongside Union Eyes)

**Plan:** CCS-ROADMAP-2026-11-23 · **Companion:** [Ceiling freeze](CIVIC_CLEAR_SAGE_CEILING_FREEZE_2026-11-23.md) · **Status:** design-only, pending founder adoption and C1 authorization · **No implementation initiated by this plan.**

## 1. Delivery invariants

- Objective: reach **pilot-ready, product-complete and operationally provable**, at the same acceptance rigor being developed for Union Eyes, **not** wait until UE finishes.
- Work is assigned by bounded owned-path domains with one integration owner. No parallel mutations to shared database schema, central authorization, audit or OCI canonical logic.
- Every feature has a positive case, negative authority case, cross-tenant case, mutation/audit evidence, bilingual/a11y behavior and deployed UAT trace where applicable.
- Use only `SOURCE_IMPLEMENTED`, `LOCAL_PROVEN`, `DEPLOYED_PROVEN`, `CLIENT_ACCEPTED` and `LAUNCH_AUTHORIZED` to claim maturity; green PR CI is not production GO.
- Product modules share canonical OCI version through a stable method contract. There is no new CLEAR scoring engine or CIVIC scoring ladder.
- Method validation by external experts comes **after** an approved, functioning, fictional-data product presentation. External buyer consent and permission to use real data must nevertheless precede actual client data.

## 2. Release boundaries

| Milestone | Target deliverable | Hard limit |
|---|---|---|
| M0 Decision Freeze | Approved ceiling and all domain contract decisions, list of authoritative source files, task ownership | Docs only, no CIVIC execution permission |
| M1 Platform SAGE proof | Correct staging revision, applied migration chain, real auth/tenant and all primary operator routes usable | No institutional client data |
| M2 Institutional kernel | Attested mandate, provenance categories, contradictory evidence, review/adoption and accountability chain | No automated institutional conclusions |
| M3 Integrated CIVIC demo | Authentic CIVIC entry, CLEAR method screens, SAGE operations, final executive package and successor path | Fictional-only, explicitly labelled |
| M4 Production-equivalent acceptance | Complete deployed security, legal-hold, restore, alert, EN/FR, manual a11y, mobile and chaos proof | Not yet a customer pilot |
| M5 Controlled first client | Scoped institutional authority, privacy/records, onboarding, supervised UAT, acceptance and support | Only authorized client; no broad launch |
| M6 Repeatable product | Second different institution/profile without code fork; integrations and commercial delivery repeatable | P5 intelligence still excluded |

## 3. Executable product contracts (types/semantics before code)

**Contract K1 — InstitutionalAuthority:** `institutionId`, `mandateInstrumentRef`, `instrumentVersion`, `institutionPositionId`, `principalId`, `permittedActionSet`, `resourceScope`, `effectiveAt`, `expiresAt`, `revokedAt`, `issuer`, `issuerVerification`, `attestedAt`, `adoptionBasis`; service denies invalid/missing mandate for consequential action, independent of app role. No tenant admin may mint authority without customer-valid instrument and issuer verification.

**Contract K2 — SourceAttestation:** `sourceId`, `sourceLocator`, `systemOfRecord`, `sourceOwner`, `authorityClass`, `authorityInstrumentRef`, `sourceVersion`, `contentDigest` where copy made, `occurredAt`, `capturedAt`, `accessBasis`, `sensitivity`, `availabilityStatus`, `custodyTrail`; separate user-provided labels from independently attested properties. No location or timestamp becomes proof merely by being in input JSON.

**Contract K3 — InterpretiveChain:** `questionId`, `claimId`, `sourceIds[]`, `derivedFrom[]`, `assertionKind`, `confidence`, `counterClaims[]`, `reviewerCommentary`, `disposition`, `humanReviewerId`, `decisionRecordId`, `supersededBy`, `uncertainty`. Allow unresolved contradictory claims to coexist without removing audit history.

**Contract K4 — DecisionAndAdoption:** a decision is proposed, reviewed, adopted/declined/deferred/challenged/corrected, with named actor, effective mandate, approved document hash/version, references and immutable event log. Draft author is not approver; policy-driven separation-of-duties checked at transition time.

**Contract K5 — AccountabilityChain:** `institutionalObjectiveId`, `mandateRef`, `interventionId`, `authorizationRef`, `commitmentId`, `resourceRef`, `expectedMeasure`, `observedMeasureRef`, `measurementWindow`, `variance`, `interpretations[]`, `reviewDueAt`, `nextDecisionOwner`, `resolution`, `closeoutEvidence`. Reports distinguish expectation, observation, causal explanation and human ratification; do not infer causal impact.

**Contract K6 — InstitutionConfiguration:** `institutionType`, `organizationBoundary`, `version`, `effectiveAt`, `riskProfile`, `officialLanguageRequirements`, `approvalRules`, `functionMappings`, `mandatoryEvidenceByTier`, `retentionRules`, `sourceAdapters`, `approvalActorId`, `validationReceipt`, `reversionVersion`. Protect constitutional invariants from config overrides.

**Contract K7 — ExportAndExit:** signed manifest including `tenantId`, `workspaceId`, `contentVersion`, `sourceReferenceManifest`, `adoptionEvents`, `redactionManifest`, `recipientGrant`, `retentionHoldState`, `packageDigest`, `generatedAt`, `auditCorrelationId`; verify consent, access, legal hold and revocation immediately before materialization and access.

**Contract K8 — CanonicalMethod:** declared OCI version, five phases, existing OCRA scoring ownership, exact CLEAR five pillars/tier rubric, canonical bilingual vocabulary, and verified hash/semantic parity against existing UE-executed method fixtures. No current UE source change during Step 1 without isolated integration approval.

Contracts are design schemas, not claims that these precise fields already exist in the database.

## 4. Parallel lanes, ownership and completion tests

### Lane A — Platform SAGE truth (critical path)
**Owned paths:** `packages/sage-core`, `apps/platform-admin/lib/sage`, `apps/platform-admin/app/sage`, `apps/platform-admin/app/api/sage`, plus separately serialized SAGE migration commits.

**Tasks:** reconcile source vs deployment; fix page scope actor classification and all analogous routes; verify service authorization and audit atomicity; run the root SAGE migrations on a supported isolated staging DB; demonstrate deployment revision/health; run same-org and cross-org negative paths against real RLS non-owner role.

**Exit A:** start-to-finish SAGE workspace creation, source registration, review, decision, export, recipient access, revocation and retention; live DB evidence; exact source SHA; no unclassified actor; no source-to-deployed false claims.

### Lane B — Institutional authority and provenance
**Owned paths:** new `packages/institutional-authority` (or carefully named SAGE subdomain) and controlled migrations; one integration owner for shared policy.

**Tasks:** implement K1/K2/K3; institutional position/function model, acting/succession mandates, issuer attestation, source classes, versioning, conflicts, challenges and human resolution; preservation of partial/contested claims.

**Exit B:** R-GATE PASS: authority and provenance correct across two institution profiles, multiple capacities, conflicting evidence, expired/revoked mandate, legal hold and cross-tenant negative tests.

### Lane C — CLEAR method and executive accountability
**Owned paths:** method-consuming package(s), SAGE service extension, report serializer and CLEAR client surfaces after interface freeze.

**Tasks:** versioned five-pillar flow and four tiers; question-to-human-ratification lifecycle; K4/K5; human-only decisions, resource commitments, due/actual deliverables and observation; outcome/variance and successor package; decision-ready executive view beyond counts.

**Exit C:** T-GATE PASS: an executable, replayable synthetic professional-services example, including conflicting interpretations, missing actual spend, no causal assertion, review due and final institutional next action.

### Lane D — CIVIC product UX
**Owned paths:** `apps/civic` only once distinct runtime authorization is amended; shared UI changes separately owned and approved.

**Tasks:** persona-aware home and onboarding; institutional configuration wizard; question/evidence/review/decision/continuity/reports navigation; deep links and back behavior; accessibility and genuine responsive/mobile; minimal restrained copy; en-CA and fr-CA, page/doc language selection.

**Exit D:** a first-time authorized operator completes full demo on desktop and phone, keyboard-only and screen reader; no unauthorized links, broken scrolling, unreachable actions, untranslated or AI-style filler copy; G11 manual proof.

### Lane E — Configuration, integration, portability
**Owned paths:** new versioned institution profile/config layer, reference-based source adapters and exit manifest.

**Tasks:** K6/K7; blueprint profiles for crown corporation, regulator, accountability office and professional service; administrative preview, validation and rollback; manual source register then M365/SharePoint link/read adapter; ownership and source sync revocation; institution export.

**Exit E:** D-GATE passes with two distinct fictional institutions in unchanged code; no unauthorized source copying; measurable duplicate-entry/time-to-brief compared with documented manual baseline; reversible configuration and useful export.

### Lane F — Deployed operations and release confidence
**Owned paths:** isolated staging configuration/CI, SAGE worker and monitoring/backup playbooks; operations owner with platform/UE coordination.

**Tasks:** B-005 staging proof; B-001 correlation/PII-safe telemetry; B-002 named alert receiver and incident drill; B-003 isolated point-in-time restore and non-resurrection; B-004 deployed manual accessibility; SAGE remaining G6/G7/G9/G10/G14/G15 conditions, live recipient mail and destructive storage tests.

**Exit F:** all critical gates demonstrably cleared, realistic chaos scenarios, independent restore proof and incident timeline, correct runbooks, canary/rollback and named human operators.

### Lane G — Commercial & fictional demonstration
**Owned paths:** founder-reviewed collateral and synthetic/demo evidence, OCI pricing source read-only.

**Tasks:** demo narrative with a realistic, fictional public institution; institution-specific value hypothesis and sponsor roles; product terms and handoff, privacy/data-processing/records engagement pack, support/exit, non-availability truth; customer acceptance script; post-presentation external methodology review protocol.

**Exit G:** buyer can see authentic product before external method critique; no fabricated outcomes or compliance guarantees; proposal and quote only after authorized commercial stage, from the OCI canonical price schedule.

### Lane H — Independent integration/acceptance
**Owned paths:** only integration branch and evidence receipts; cannot shadow-edit other owners' files.

**Tasks:** contract/version checks for K1–K8; provenance of each lane's PR and exact SHA; no UX/API drift; feature/route inventories; same tenant authorized/unauthorized, wrong tenant, revoked, conflicted, blind external reviewer, background actor, admin escalation; full desktop/mobile/EN/FR proof; security-design-review labels where required.

**Exit H:** golden journeys and denial matrix completely proven, no unresolved P0/P1 affecting pilot, no missing receipt for advertised capability, founder's scoped release decision.

## 5. Concurrency model with UE (mandatory)

```
OCI canon / method contract ──────────┬────────── UE Step 1 → UE Step 2 → UE own GO
                                      └────────── CIVIC/CLEAR/SAGE design C0
                                                     ├─ A SAGE staging correctness
                                                     ├─ B Authority/provenance
                                                     ├─ C CLEAR/accountability
                                                     ├─ D CIVIC UX (after C1)
                                                     ├─ E Profiles/integration
                                                     ├─ F Operations
                                                     └─ G Demo/commercial
                                                       ↓
                                              H Integrated R/D/T + 15 gates
                                                       ↓
                                              Fictional demo admission
                                                       ↓
                                              Client-specific pilot approval
```

**UE collision controls:** no writes to `apps/union-eyes` while its Step 1 integration and remediation are in flight unless owner of the active UE branch merges a neutral method interface change after parity tests; no replacement/reshuffle of shared auth, audit, migrations, dependencies or top-level CI by another agent. New institutional packages expose additive versioned contracts. Each lane uses clean detached worktrees and branch naming compliant with repository policy. Shared DB migrations are serialized, reversible where feasible, checked against drift and privilege bounds. Source commits and test results are recorded per lane before merge; no blind auto-merge.

## 6. R/D/T test gates — acceptance matrix

| Requirement | Acceptance proof | Blocking failure |
|---|---|---|
| R1 Legitimate institutional authority | Different user with tenant admin role but no active mandate refused consequential action | Admin-as-sponsor shortcut |
| R2 Source and claim truth | Source ID, occurred date, owner, authority class and signed/attested basis verified; tampered label denied | Caller narrative treated as authority |
| R3 Contestability | Two contradictory facts/interpretations survive challenge and can be human-resolved with immutable history | Summary suppresses dissent |
| R4 Accountable decision | Real human reviewer + correct active role/instrument adopt/decline/defer, with separate drafter | Service actor or facilitator ratifies |
| D1 One configurable kernel | Two institution families and different privacy/risk/role policies run unchanged core | Per-client code fork |
| D2 Burden and integrations | Reduce measured manual tasks with source-reference import; prove revoke/change | Shadow source-of-truth or noisy duplication |
| D3 Operator experience | Authorized persona completes key tasks EN/FR, desktop/mobile, screen reader | Broken controls or ambiguous decisions |
| D4 Client delivery | Discover/configure/validate/operate/review/exit with correct client approvals | Unserviceable onboarding or no exit |
| T1 Accountability | Source-bound authority/commitment/deliverable/observation/end-review chain persists | Counts-only panel |
| T2 Executive decision brief | Scope/owner/resources/expected/observed/variance/uncertainty/alternatives/next action | Unsupported causation or no authority |
| T3 Independent decision | Evidence package informs but never fabricates signed institution decision | AI/self-approved governance |

## 7. Operational quality thresholds — proposed design targets

These are engineering acceptance targets, **not contractual SLAs or current performance claims**. Contractual values are established in actual client schedules after proven deployment.

- Monthly interactive service availability target **99.9%**, excluding separately agreed client maintenance.
- Pilot recovery design targets: **RPO ≤ 1 hour** for authoritative platform records, **RTO ≤ 4 hours** under specified staging restore conditions; verify feasibility/cost before contractual commitment.
- **100%** of critical mutating actions emit durable correlated audit and can be traced to actual actor/mandate; no audit-only success without business write or vice versa.
- **100%** of top-tier cross-tenant and wrong-mandate adversarial paths refuse with no data disclosure.
- Every client-facing screen and final export **en-CA/fr-CA**, with functional keyboard + screen-reader inspection and WCAG 2.2 AA target.
- Every client-exported decision-grade assertion is either linked to an authorized verifiable source/attestation or clearly identified as interpretation, contested, missing or derived.
- **Zero** unresolved security, privacy, mandate, backup, destructive-record, tenant-boundary or external disclosure critical blockers at pilot GO.

## 8. Sequencing, without unnecessary dependencies

**Before any code:** accept ceiling C0; record exact protected runtime permission path and owner C1; approve K1–K8 versions; enumerate affected migrations and interfaces; designate shared integration owner; do a fresh source/deployed inventory.

**Can begin independently after C1:** A through G work on disjoint surfaces. B and C develop against mocked K contracts until A stable; D uses typed mocked APIs and fictional data until backend acceptance; E adapters against contract fixtures; F on dedicated staging not UE's. None claim ready based on mocks.

**Integration ordering:** platform auth & migrations → authority/provenance → CLEAR state machine/accountability → CIVIC shell/UX → config/adapter/export → global adversarial proof and operations. Keep test data synthetic until explicit client admission.

**Decision rule:** work in complete domain-sized waves, fix root causes, no status inflation or artificial sign-off ceremonies. User is founder approval authority for internal design; a real customer must still appoint its legitimate authorizers for its data and decisions.

## 9. Reconciliation ledger (do before feature work)

| ID | Action | Outcome |
|---|---|---|
| X01 | Align old 'SAGE does not exist' prose to historical design vs actual implementation | Documents truthful, without mutating doctrine silently |
| X02 | Decide owner-approved CIVIC runtime transition and relationship to existing first-touch embargo | C1 grant through protected contract, separate from synthetic demo scope |
| X03 | Confirm shared OCI method parity/extraction boundary vs UE active Step 1 | Stable API, no branching fork |
| X04 | Review institutional scope driver against canonical OCI quote authority | No price duplication; any change in canonical owner only |
| X05 | Fix actor classification passed from SAGE pages/services | All legitimate user views work while invalid actor fails closed |
| X06 | Identify first pilot institution family and minimum dataset **as a configurable profile**, not real client data | Reusable fictitious example |
| X07 | Prove historical SAGE staging/migrations/ops state afresh | Objective proof, not assumptions |
| X08 | Freeze identity, status and evidence labels in CI/source assertions | Doc/UX/release status never promoted by inference |

## 10. Scope excluded from first pilot

No P5 network, market-wide benchmarking, individual monitoring/profiling, personnel performance scoring, legal/HR/ATIP/risk determinations, procurement approval engine, financial transaction processor, generative autonomous findings, speculative connector marketplace, case adjudication, continuous employee surveillance, customer-specific forks, unapproved real data or legal/certification guarantees.

### Status

This is an execution-ready **plan**, not proof that any lane is complete, nor permission to begin feature implementation. Current recorded SAGE external production decision is NO_GO. Founder approval of this blueprint and separate C1 protected runtime authorization must precede implementation and subsequent claims.
