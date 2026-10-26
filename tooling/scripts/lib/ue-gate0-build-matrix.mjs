/**
 * Writes the Gate 0 completion matrix from the inventories already in the repo.
 * The JSON file is the canonical artifact. This script does not change those inventories.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  FILES,
  ROOT,
  evidenceDeps,
  executionEvidenceProblems,
  guardCounts,
  kernelBaselineHash,
  loadContext,
  routeBaselineHash,
} from './ue-gate0-scope-lock.mjs'
import { PERSONAS, SOURCE_FILES, UNRESOLVED_OWNER, personaActionsFromSpecs } from './ue-gate0-persona-spec.mjs'
import { loadRecovery, RECOVERY_FILE } from './ue-gate0a-persona-recovery.mjs'
import { ownershipHash } from './ue-gate0-route-ownership.mjs'
import { buildOwnership, ownershipJson } from './ue-gate0-build-ownership.mjs'
import { BASELINE_DATA, BASELINE_DOCS } from './ue-gate0a2-baseline-facts.mjs'
import { sha256File } from './ue-gate0a2-validate-baselines.mjs'

const ctx = loadContext(ROOT)
const personaSpecs = ctx.personaSpecs

function cap(partial) {
  return {
    relatedRegisterIds: [],
    registerImplementationOwner: false,
    dependencyGates: [],
    lifecycleState: partial.sourceStatus,
    navigationEntrypoint: null,
    apiRoute: null,
    httpAction: null,
    service: null,
    kernelAction: null,
    kernelResource: null,
    persistence: null,
    auditEvidence: 'No separate audit record is claimed for this obligation.',
    privacyClassification: 'Tenant-scoped. This record adopts no new classification label.',
    notificationPolicy: 'not_adopted',
    negativeAndRecovery: 'Fail closed. Do not report success for work that did not persist.',
    sourceFiles: [],
    sourceTests: [],
    nativeTestsRequired: 'Native PostgreSQL qualification is not recorded.',
    browserTestsRequired: 'Credentialed browser qualification is not recorded.',
    nativeQualification: 'PENDING',
    browserQualification: 'PENDING',
    nativeRuntimeEvidence: [],
    browserRuntimeEvidence: [],
    proof: [],
    externalDependency: null,
    operationallyActivated: false,
    schemaCensus: false,
    individuallyReclassified: false,
    censusCount: null,
    scopedRoutes: [],
    ...partial,
  }
}

const owners = [
  ['A-001', 1, 'NOT_IMPLEMENTED', 'Identity operations', 'Bind a provider subject to an internal principal through the governed migration on a non-production clone.', 'Migration 0041 / v2 bootstrap adoption and the membership-function catalog proof are not recorded.', [], 'PENDING', 'NOT_REQUIRED'],
  ['A-002', 1, 'SOURCE_IMPLEMENTED', 'Kernel identity provider', 'Consume the kernel-owned provider resolver.', 'Register closure cites the resolver file and commit. This record does not add a native or browser pass.', ['apps/union-eyes/lib/authority/store/platform-identity.ts'], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['A-003', 1, 'NOT_IMPLEMENTED', 'Organization session authority', 'Confine cross-principal membership reads and subordinate-authority revocation.', 'The native auth proof for fixed search_path, ownership, grants, and caller confinement is not recorded. Invitation redemption in this branch does not close that proof.', [], 'PENDING', 'NOT_REQUIRED'],
  ['A-004', 1, 'PARTIAL', 'Authenticated member and staff session', 'Stop passing a long-lived session cookie through PostgreSQL session settings.', 'A short-lived bridge or derived proof is not qualified on PostgreSQL 15 and 16. Drizzle bind errors must not carry the bridge token.', ['apps/union-eyes/lib/authority/store/platform-identity.ts'], 'PENDING', 'PENDING'],
  ['A-005', 1, 'NOT_IMPLEMENTED', 'Membership projection readers', 'Reconcile the compatibility membership projection with platform_organization_memberships and move readers.', 'The reconciliation migration and reader move are not recorded.', [], 'PENDING', 'NOT_REQUIRED'],
  ['A-006', 1, 'PARTIAL', 'Identity-provider removal', 'Rename remaining clerk_user_id consumers to auth_user_id and retire the webhook alias after external confirmation.', 'File classification is in progress. Webhook and Whop retirement stay on UE-CONV-A-007.', ['apps/union-eyes/lib/authority/store/platform-identity.ts'], 'PENDING', 'NOT_REQUIRED'],
  ['A-007', 1, 'EXTERNAL_GATE', 'Identity operations, integration owners, and billing integration', 'Retire the exposed webhook password, identify the webhook sender, and confirm the Whop consumer reads userId only.', 'External proof is absent. This gate is not operationally activated.', [], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['B-001', 2, 'PARTIAL', 'Supervisory representative', 'Reconcile and backfill primary representative ownership through assignCase under issuance governance.', 'The backfill tool exists and must not be executed as a protected backfill from this gate. Successor acceptance and member-visible handover remain open.', ['apps/union-eyes/lib/authority/store/case-ownership-backfill.ts', 'apps/union-eyes/lib/authority/store/case-ownership.ts'], 'PENDING', 'PENDING'],
  ['B-002', 3, 'NOT_IMPLEMENTED', 'Representation administration', 'Persist case unit, territory, and respondents with referential integrity and load them in loadCase.', 'unit_id, territory_id, and case_respondents are not implemented.', [], 'PENDING', 'NOT_REQUIRED'],
  ['C-001', 4, 'NOT_IMPLEMENTED', 'Case model owner', 'Choose the canonical case entity and migrate or retire the competing claims or grievances model.', 'The entity choice is not recorded. UE-CAP-K-010 does not make that choice.', [], 'PENDING', 'NOT_REQUIRED'],
  ['D-001', 5, 'PARTIAL', 'Financial officer', 'Keep a payments transaction source with member, amount, and currency constraints and no invented values.', 'Platform 0015 is recorded as partial in the register. Affiliate, budget, expense, vendor, and strike-fund domains stay on UE-OMIT-FINANCE-UNAVAILABLE.', ['apps/union-eyes/lib/finance/require-live-financial-mandate.ts'], 'PENDING', 'NOT_REQUIRED'],
  ['D-002', 5, 'PARTIAL', 'Financial officer and independent approver', 'Approve expenses and remittances on the kernel financial workflow.', 'services/financial-service is not an approval path. No live route issues a financial mandate. Self-approval remains refused until a live issuance rule exists.', ['apps/union-eyes/lib/finance/financial-mandate-lifecycle.ts', 'apps/union-eyes/lib/finance/require-live-financial-mandate.ts'], 'PENDING', 'PENDING'],
  ['D-003', 5, 'PARTIAL', 'Institutional finance authority', 'Replace role-title finance gates with kernel financial mandates once disbursement and approval sources exist.', 'FINANCIAL_MANDATES_NOT_ISSUED. Officer/Executive and Financial Officer role gates both remain. No HTTP route issues a mandate.', ['apps/union-eyes/lib/finance/retired-financial-route.ts', 'apps/union-eyes/lib/finance/financial-mandate-lifecycle.ts'], 'PENDING', 'PENDING'],
  ['E-001', 13, 'PARTIAL', 'Case and document authorization', 'Remove legacy case and document authorization shortcuts after kernel storage is qualified.', 'The ratchet forbids new uses. The claims module and remaining helpers are not deleted.', ['apps/union-eyes/lib/cases/case-authorization.ts'], 'PENDING', 'NOT_REQUIRED'],
  ['F-001', 6, 'SOURCE_VERIFIED', 'Document disclosure authority', 'Keep internal-file reading, editing, and disclosure as separate governed grants.', 'PGlite evidence is not native PostgreSQL qualification and is not a browser pass.', ['apps/union-eyes/lib/authority/ontology.ts'], 'PENDING', 'NOT_REQUIRED'],
  ['F-002', 6, 'PARTIAL', 'Member and representative document custodian', 'Implement document grant, expiry, revocation, and the rest of the lifecycle on the classification and kernel contracts.', 'Own-upload and shared-document reads exist. Grant, expiry, and revocation are not modelled. Self-service privacy rights are UE-OMIT-PRIVACY-RIGHTS.', ['apps/union-eyes/app/[locale]/dashboard/documents/page.tsx'], 'PENDING', 'PENDING'],
  ['F-003', 6, 'EXTERNAL_GATE', "Each institution's governance body", 'Adopt an approved instrument naming member-disclosable labels and the third-party definition.', 'A code workflow exists. Institutional adoption is not engineering completion and is not operationally activated.', ['apps/union-eyes/lib/authority/__tests__/kernel-third-party.test.ts'], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['G-001', 7, 'SOURCE_VERIFIED', 'Union-side counsel engagement', 'Keep union-side counsel engagement on the kernel boundary.', 'Counsel-side verification stays on UE-CONV-G-003. PGlite and unit evidence are not native qualification.', ['apps/union-eyes/lib/authority/store/counsel.ts'], 'PENDING', 'NOT_REQUIRED'],
  ['G-003', 7, 'EXTERNAL_GATE', 'WorkAid / counsel-side operator with privacy and legal review', 'Qualify a counsel-side signature verifier, issuer allow-list, and key custody.', 'No counsel HTTP route is in scope. The boundary is not operationally activated.', [], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['G-002', 7, 'NATIVE_PENDING', 'Member and union staff referring to WorkAid', 'Record union-side WorkAid referral, confirmed disclosure, and member disclosure history on kernel storage.', 'Migrations 0036, cache 0028, and 0037 are unqualified. A skipped native test is not evidence. Counsel execution remains UE-CONV-G-003. Stale persona sentences that say no WorkAid code exists are not current.', ['apps/union-eyes/lib/authority/store/workaid-disclosure.ts', 'apps/union-eyes/lib/authority/policies/workaid.ts'], 'PENDING', 'PENDING'],
  ['H-001', 8, 'SOURCE_VERIFIED', 'API scaffold', 'Keep the retired scaffold routes on honest HTTP 501 responses.', 'Honest 501s close the fake-success defect only. Each underlying operation remains its own obligation.', ['tooling/reality/anti-theatre-scan.ts'], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['H-002', 8, 'NOT_IMPLEMENTED', 'Administrative operator', 'Implement the thirteen stubbed operations on canonical contracts, or hide each surface with a recorded product decision.', 'The routes return HTTP 501. None of the thirteen operations is implemented.', [], 'PENDING', 'NOT_REQUIRED'],
  ['H-003', 9, 'PARTIAL', 'Installation owner', 'Classify migration and bootstrap entrypoints and designate one installation path.', 'The legacy migrate path is not retired and one installation path is not designated.', ['tooling/scripts/lib/ue-approved-migration-lineage.json'], 'PENDING', 'NOT_REQUIRED'],
  ['H-004', 9, 'NOT_IMPLEMENTED', 'Runtime architecture', 'Make non-PostgreSQL data paths unreachable and correct the architecture comments.', 'Misleading multi-database guidance is still open.', [], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['H-005', 8, 'SOURCE_VERIFIED', 'Development seed control', 'Keep the retired seed route on HTTP 501.', 'A canonical seed is not a committed obligation. See the out-of-scope seed record.', ['apps/union-eyes/app/api/admin/seed-test-data/route.ts'], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['H-006', 9, 'SOURCE_IMPLEMENTED', 'Repository maintainer', 'Keep stray root scripts retired through the supersession registry.', 'Retirement evidence is the registry path. No runtime pass is claimed.', ['docs/union-eyes/convergence/register/ue-supersession-registry.json'], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['I-001', 10, 'PARTIAL', 'Member, steward, representative, senior representative, officer, financial officer, and governance officer', 'Integrate the remaining frozen persona journeys on kernel records, including recusal.', 'Member review intake is UE-CAP-REVIEW-INTAKE and does not close this programme. Officer domains in the executive matrix are not OPERATIONAL. The representative canonical file is not in the repository.', ['apps/union-eyes/lib/executive/capability-matrix.ts'], 'PENDING', 'PENDING'],
  ['J-001', 9, 'EXTERNAL_GATE', 'Release engineering', 'Qualify kernel migrations on a staging clone.', 'Clone-qualification output is absent. This gate is not operationally activated. Staging and production stay NO-GO.', [], 'PENDING', 'NOT_REQUIRED'],
  ['K-001', 15, 'SOURCE_VERIFIED', 'Migration lineage checker', 'Keep migration lineage verification in the convergence checker.', 'The checker covers source lineage. It is not a native database pass.', ['tooling/scripts/lib/ue-approved-migration-lineage.json'], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['K-002', 15, 'SOURCE_VERIFIED', 'Anti-theatre scanner', 'Keep stub and fake-success detection enforced as rule R-9.', 'The scanner is source evidence. It does not implement the stubbed operations.', ['tooling/reality/anti-theatre-scan.ts'], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['K-003', 15, 'PARTIAL', 'Convergence checker', 'Run register integrity and legacy-reachability ratchets in the validation chain.', 'The checker exists. Gate 0 does not claim the full validation chain already fails every legacy reach.', ['tooling/scripts/lib/ue-convergence-check.mjs'], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['I-002', 11, 'PARTIAL', 'Member and assigned staff', 'Assign, read, reply, close, archive, escalate, and retain member conversations on the kernel message contract.', 'Unread state remains blocked on runtime grants. Staging qualification of migrations 0014 and 0021 is external. Delivery evidence is UE-OMIT-DELIVERY-EVIDENCE.', ['apps/union-eyes/lib/messaging/conversation-participation.ts', 'apps/union-eyes/app/[locale]/dashboard/messages/staff/page.tsx'], 'PENDING', 'PENDING'],
  ['H-007', 'schema-census', 'PARTIAL', 'Schema census owner', 'Keep the 231-entry schema census as one later workstream.', 'Census entries are not individually reclassified in Gate 0. applyNow stays false on the batch manifest. Ranking and per-relation remediation have not started.', ['docs/union-eyes/convergence/register/ue-schema-mutation-batches.json'], 'PENDING', 'NOT_REQUIRED'],
  ['K-005', 14, 'PARTIAL', 'Governed mutation owner', 'Commit every authority-bearing mutation with its audit record in the same transaction.', 'The best-effort audit ratchet is not at zero for every remaining caller.', ['apps/union-eyes/lib/__tests__/mutation-scope-ratchet.test.ts'], 'PENDING', 'NOT_REQUIRED'],
  ['K-006', 14, 'PARTIAL', 'Tenant isolation owner', 'Scope mutations by an explicit organization predicate, including system-context jobs.', 'The mutation baseline is not a claim that every historical statement was converted. The ratchet fails on a new unscoped statement.', ['docs/union-eyes/convergence/register/ue-mutation-scope-baseline.json', 'apps/union-eyes/lib/__tests__/mutation-scope-ratchet.test.ts'], 'PENDING', 'NOT_REQUIRED'],
  ['K-007', 13, 'PARTIAL', 'Generic CRUD authorization', 'Move generic CRUD routes off a role floor onto audited resource authorization.', 'The classification test holds the inventory. Real PostgreSQL proof of the audited write is not recorded, and mislabelled stub routes remain.', ['docs/union-eyes/convergence/register/ue-route-coverage-manifest.json'], 'PENDING', 'NOT_REQUIRED'],
  ['K-008', 15, 'PARTIAL', 'Route-coverage ratchet', 'Shrink route-coverage baselines to zero by converting each listed route.', 'The manifest is the inventory. Gate 0 does not shrink baselines and does not treat a route filename as implementation.', ['docs/union-eyes/convergence/register/ue-route-coverage-manifest.json'], 'NOT_REQUIRED', 'NOT_REQUIRED'],
  ['K-009', 12, 'PARTIAL', 'Election and voting authority', 'Keep voting-session and council-election writes inside the caller organization and the draft-session rules.', 'The council vote route remains HTTP 501. UE_ELECTION_SUCCESSION_NATIVE_PROOF and UE_OWNERSHIP_NATIVE_PROOF are not set. Review intake does not certify an election.', ['apps/union-eyes/app/api/elections/[id]/vote/route.ts'], 'PENDING', 'PENDING'],
  ['K-010', 4, 'PARTIAL', 'Claims and grievance mutation authority', 'Decide claims, cases, documents, and grievance mutations in the authority kernel and migrate the status, workflow, and OCR UI.', 'Depends on the UE-CAP-C-001 entity choice. The real-PostgreSQL claims proof and triage issuance source are not recorded.', ['apps/union-eyes/lib/cases/case-authorization.ts'], 'PENDING', 'PENDING'],
  ['K-011', 14, 'PARTIAL', 'Authority audit owner', 'Commit authority-bearing review, clone, and ballot mutations with their audit records.', 'Review-route authority, platform migration 0021 clone qualification, and ballot timestamp granularity are unresolved.', ['apps/union-eyes/lib/authority/ontology.ts'], 'PENDING', 'NOT_REQUIRED'],
  ['K-004', 15, 'NOT_IMPLEMENTED', 'Completion controls', 'Build persona, authorization, and documentation-supersession controls against this machine-readable matrix.', 'Gate 0 publishes the matrix. It does not implement the controls and does not close this register entry.', [], 'NOT_REQUIRED', 'NOT_REQUIRED'],
]

const tests = {
  'F-001': ['apps/union-eyes/db/__tests__/authority-kernel-resources.pglite.test.ts', 'apps/union-eyes/db/__tests__/authority-kernel-lifecycle.pglite.test.ts'],
  'G-001': ['apps/union-eyes/lib/authority/__tests__/counsel-boundary.test.ts', 'apps/union-eyes/db/__tests__/authority-kernel-resources.pglite.test.ts', 'apps/union-eyes/db/__tests__/authority-kernel-counsel.pglite.test.ts'],
  'H-001': ['tooling/reality/__tests__/anti-theatre-scan.test.ts'],
  'H-005': ['apps/union-eyes/app/api/__tests__/admin-seed-test-data.route.test.ts'],
  'K-001': ['tooling/scripts/lib/ue-migration-lineage-certification.test.mjs'],
  'K-002': ['tooling/reality/__tests__/anti-theatre-scan.test.ts'],
  'K-003': ['tooling/scripts/lib/ue-convergence-check.test.mjs'],
}

const external = {
  'A-007': ['identity operations; integration owners; billing integration', 'Dated evidence that the old password is rejected or the accounts disabled; identity of the webhook sender and a delivery log; confirmation that the Whop consumer reads userId only.'],
  'F-003': ["each institution's governance body", 'An approved instrument naming member-disclosable labels and the third-party definition.'],
  'G-003': ['WorkAid / counsel-side operator with privacy and legal review', 'A named counsel-side system, its issuer allow-list entry, key custody and rotation procedure, and a passing acceptance run of the counsel-boundary contract.'],
  'J-001': ['release engineering', 'Clone-qualification gate output for the registered additions.'],
}

const capabilities = owners.map(([suffix, gate, sourceStatus, actor, businessOutcome, gap, sourceFiles, nativeQualification, browserQualification]) => {
  const registerId = `UE-CONV-${suffix}`
  const externalDependency = external[suffix]
    ? { owner: external[suffix][0], missingProof: external[suffix][1], operationallyActivated: false }
    : null
  return cap({
    id: `UE-CAP-${suffix}`,
    parentRegisterId: registerId,
    registerImplementationOwner: true,
    obligationKey: `register:${registerId}`,
    primaryGate: gate,
    actor,
    businessOutcome,
    sourceStatus,
    lifecycleState: sourceStatus === 'EXTERNAL_GATE' ? 'EXTERNAL_GATE' : sourceStatus,
    gap,
    sourceFiles,
    sourceTests: tests[suffix] ?? [],
    nativeQualification,
    browserQualification,
    externalDependency,
    schemaCensus: suffix === 'H-007',
    censusCount: suffix === 'H-007' ? ctx.censusCount : null,
    individuallyReclassified: false,
    proof: tests[suffix]?.map((ref) => ({ type: 'test', ref })) ?? sourceFiles.slice(0, 1).map((ref) => ({ type: 'path', ref })),
  })
})

const h002 = capabilities.find((item) => item.id === 'UE-CAP-H-002')
h002.scopedRoutes = ctx.registryActions
  .filter((record) => record.id.startsWith('UE-ACTION-') && record.id !== 'UE-ACTION-ORG-HIERARCHY-SEED')
  .flatMap((record) => record.routes)
h002.apiRoute = h002.scopedRoutes.join(', ')
h002.httpAction = 'GET/POST as declared on each route; current response HTTP 501'

const g002 = capabilities.find((item) => item.id === 'UE-CAP-G-002')
g002.sourceTests = ['apps/union-eyes/lib/authority/__tests__/kernel-workaid.test.ts', 'apps/union-eyes/lib/authority/__tests__/workaid-wording-store.test.ts']
g002.proof = g002.sourceTests.map((ref) => ({ type: 'test', ref }))
g002.nativeTestsRequired = 'apps/union-eyes native WorkAid migration qualification. UE_DELIVERY_NATIVE_PROOF is unrelated. A skipped test is not a pass.'
g002.kernelAction = 'workaid:refer'
g002.kernelResource = 'workaid_matter'
g002.notificationPolicy = 'not_adopted'

const review = cap({
  id: 'UE-CAP-REVIEW-INTAKE',
  parentRegisterId: 'UE-CONV-K-009',
  relatedRegisterIds: ['UE-CONV-I-001'],
  obligationKey: 'member-review-intake',
  primaryGate: 12,
  dependencyGates: [10, 1],
  actor: 'Active member, and a governance officer who holds review:monitor',
  businessOutcome: 'An active member opens a complaint, appeal, or reconsideration and reads their own intake. Oversight lists only reviews on a monitor mandate.',
  sourceStatus: 'PARTIAL',
  navigationEntrypoint: '/dashboard/union/reviews and /dashboard/governance/reviews',
  apiRoute: 'app/api/reviews/route.ts',
  httpAction: 'GET, POST',
  service: 'apps/union-eyes/lib/authority/store/review-intake.ts',
  kernelAction: 'review:monitor',
  kernelResource: 'governance_review',
  persistence: 'ue_authority_reviews',
  auditEvidence: 'authority.review.open through the existing registerReview audit.',
  notificationPolicy: 'not_adopted',
  negativeAndRecovery: 'Inactive members are refused. A caller cannot name themselves as adverse. Oversight without review:monitor receives an empty list. Respondent ids are omitted. Organization RLS still allows a direct SELECT of review rows outside this route.',
  sourceFiles: ['apps/union-eyes/lib/authority/store/review-intake.ts', 'apps/union-eyes/app/api/reviews/route.ts', 'apps/union-eyes/components/reviews/review-intake.tsx'],
  sourceTests: ['apps/union-eyes/db/__tests__/review-intake.pglite.test.ts', 'apps/union-eyes/app/api/__tests__/reviews-intake.route.test.ts', 'apps/union-eyes/components/reviews/review-intake.test.tsx'],
  nativeTestsRequired: 'Native PostgreSQL proof of review intake is not recorded. PGlite is not that proof.',
  browserTestsRequired: 'Credentialed member and governance-officer browser coverage is not recorded.',
  proof: [{ type: 'commit', ref: '08f20236c540b556e022d7b430ba0cbf3e8470e2' }, { type: 'test', ref: 'apps/union-eyes/db/__tests__/review-intake.pglite.test.ts' }],
  gap: 'Intake does not assign an independent reviewer, issue a finding, or close remediation. It does not implement member withdrawal, clarification, or acknowledgement. It does not close UE-CONV-I-001 or UE-CONV-K-009.',
})

const distinct = [
  review,
  cap({
    id: 'UE-OMIT-M04-MEMBER-REQUESTS',
    parentRegisterId: 'UE-CONV-I-001',
    obligationKey: 'member-representation-requests',
    primaryGate: 10,
    dependencyGates: [4],
    actor: 'Member',
    businessOutcome: 'A member withdraws, clarifies, or acknowledges their own representation matter.',
    sourceStatus: 'PARTIAL',
    navigationEntrypoint: '/dashboard/claims/[id]',
    service: 'apps/union-eyes/lib/cases/case-authorization.ts',
    sourceFiles: ['apps/union-eyes/lib/cases/case-authorization.ts'],
    proof: [{ type: 'path', ref: 'docs/union-eyes/reality-remediation/UE_MEMBER_CANONICAL_2_1.md' }],
    gap: 'Own-case read and timeline exist. Member withdrawal, clarification, and acknowledgement are not implemented. Review intake is a different obligation.',
  }),
  cap({
    id: 'UE-OMIT-M04-LEGAL-DEADLINE',
    parentRegisterId: 'UE-CONV-I-001',
    obligationKey: 'member-legal-deadline-calculation',
    primaryGate: 10,
    actor: 'Member',
    businessOutcome: 'Show a member the legal deadline that governs their own matter when a calculation engine exists.',
    sourceStatus: 'NOT_IMPLEMENTED',
    proof: [{ type: 'path', ref: 'docs/union-eyes/reality-remediation/UE_MEMBER_CANONICAL_2_1.md' }],
    gap: 'The member canonical records legal-deadline calculation as unavailable. No engine is claimed here.',
  }),
  cap({
    id: 'UE-OMIT-DEADLINE-OVERDUE',
    parentRegisterId: 'UE-CONV-I-001',
    obligationKey: 'representative-deadline-overdue',
    primaryGate: 10,
    dependencyGates: [9],
    actor: 'Senior representative',
    businessOutcome: 'Surface overdue representation deadlines to the responsible representative.',
    sourceStatus: 'PARTIAL',
    service: 'apps/union-eyes/lib/deadline-engine/reminder-worker.ts',
    sourceFiles: ['apps/union-eyes/lib/deadline-engine/reminder-worker.ts', 'apps/union-eyes/lib/deadline-engine/deadline-semantics.ts'],
    sourceTests: ['apps/union-eyes/lib/deadline-engine/__tests__/reminder-worker.test.ts'],
    proof: [{ type: 'path', ref: 'docs/union-eyes/reality-remediation/32_UE_SENIOR_REPRESENTATIVE_2_1_CONVERGENCE_DISPOSITION.md' }],
    gap: 'SR10 records the deadline engine as limited and overdue processing as unproven. The main-app overdue cron remains HTTP 501 under UE-OMIT-MAIN-APP-CRONS.',
  }),
  cap({
    id: 'UE-OMIT-PRIVACY-RIGHTS',
    parentRegisterId: 'UE-CONV-F-002',
    relatedRegisterIds: ['UE-CONV-F-003'],
    obligationKey: 'privacy-rights-and-incidents',
    primaryGate: 6,
    actor: 'Member and governance officer',
    businessOutcome: 'Receive and fulfill an access, correction, or portability request, and record a privacy incident without treating a missing workflow as success.',
    sourceStatus: 'PARTIAL',
    navigationEntrypoint: '/dashboard/privacy',
    sourceFiles: ['apps/union-eyes/app/[locale]/dashboard/privacy/page.tsx'],
    proof: [{ type: 'path', ref: 'apps/union-eyes/lib/reality/capability-registry.ts' }],
    notificationPolicy: 'not_adopted',
    gap: 'The privacy page explains the model. Capability-registry entries for DSAR handling, privacy incidents, jurisdictional privacy cases, and breach notification determination are NOT_IMPLEMENTED. Self-service export is not offered.',
  }),
  cap({
    id: 'UE-OMIT-MAIN-APP-CRONS',
    parentRegisterId: 'UE-CONV-H-001',
    obligationKey: 'main-app-cron-implementation',
    primaryGate: 9,
    dependencyGates: [8],
    actor: 'Scheduled job runner',
    businessOutcome: 'Run monthly dues, overdue notifications, message processing, notification processing, and scheduled reports only when each job actually performs the work.',
    sourceStatus: 'NOT_IMPLEMENTED',
    apiRoute: 'app/api/cron/monthly-dues/route.ts, app/api/cron/overdue-notifications/route.ts, app/api/cron/process-messages/route.ts, app/api/cron/process-notifications/route.ts, app/api/cron/scheduled-reports/route.ts',
    httpAction: 'HTTP 501',
    proof: [{ type: 'path', ref: 'apps/union-eyes/lib/reality/capability-registry.ts' }],
    gap: 'The five UE-CRON registry entries are NOT_IMPLEMENTED. Honest 501s are UE-CAP-H-001. Implementing the jobs is not part of the thirteen stubbed operations.',
  }),
  cap({
    id: 'UE-OMIT-A11Y-BILINGUAL',
    parentRegisterId: 'UE-CONV-I-001',
    obligationKey: 'accessibility-bilingual-journeys',
    primaryGate: 10,
    actor: 'Member, representative, and governance officer',
    businessOutcome: 'Complete the frozen bilingual, accessible, and responsive journeys, including the WCAG 2.2 AA target named for members.',
    sourceStatus: 'PARTIAL',
    navigationEntrypoint: '/dashboard/help',
    sourceFiles: ['apps/union-eyes/app/[locale]/dashboard/help/page.tsx', 'apps/union-eyes/messages/en-CA.json', 'apps/union-eyes/messages/fr-CA.json'],
    browserTestsRequired: 'Credentialed EN/FR, mobile, and WCAG journey evidence is not recorded.',
    proof: [{ type: 'path', ref: 'docs/union-eyes/reality-remediation/UE_MEMBER_CANONICAL_2_1.md' }],
    gap: 'Locale catalogs exist for en-CA, fr-CA, it, and pt. WCAG 2.2 AA journey checks are not recorded. SR22 and the financial-officer bilingual acceptance are unproven. it and pt were not updated for the financial unavailable-state strings.',
  }),
  cap({
    id: 'UE-OMIT-FINANCE-UNAVAILABLE',
    parentRegisterId: 'UE-CONV-D-001',
    obligationKey: 'named-unavailable-finance-domains',
    primaryGate: 5,
    dependencyGates: [5],
    actor: 'Financial officer',
    businessOutcome: 'Budgets, expenses, vendors, affiliate remittances, and strike or restricted funds either work on the kernel finance model or stay honestly unavailable.',
    sourceStatus: 'NOT_IMPLEMENTED',
    navigationEntrypoint: null,
    service: 'apps/union-eyes/lib/finance/retired-financial-route.ts',
    proof: [{ type: 'path', ref: 'docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md' }],
    gap: 'F10, F11, F12, F13, F14, F17, and F18 are UNAVAILABLE in the financial-officer disposition. The capability registry records the same domains as NOT_IMPLEMENTED. Advertising Accounts & Cash, Budgets & Spending, or Funds & Programs is not authorized.',
  }),
  cap({
    id: 'UE-OMIT-FINANCE-RANGE-UNSPECIFIED',
    parentRegisterId: 'UE-CONV-D-003',
    obligationKey: 'financial-officer-range-without-titles',
    primaryGate: 5,
    actor: 'Financial officer',
    businessOutcome: 'Hold the financial-officer identifiers that the repository cites only as a range, without inventing titles.',
    sourceStatus: 'SOURCE_UNSPECIFIED',
    nativeQualification: 'NOT_REQUIRED',
    browserQualification: 'NOT_REQUIRED',
    proof: [{ type: 'path', ref: 'docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md' }],
    gap: 'F01–F28 and FJ01–FJ10 are cited. Individual statements exist for F08, F09, F10, and F19 only. F11–F14 and F17–F18 carry shared labels. The other unnamed codes are not given titles in this repository.',
  }),
  cap({
    id: 'UE-OMIT-REP-CANONICAL-ABSENT',
    parentRegisterId: 'UE-CONV-I-001',
    obligationKey: 'representative-canonical-action-ids',
    primaryGate: 10,
    actor: 'Representative and steward',
    businessOutcome: 'Lock representative and steward action identifiers once the frozen canonical list is in the repository.',
    sourceStatus: 'SOURCE_UNSPECIFIED',
    nativeQualification: 'NOT_REQUIRED',
    browserQualification: 'NOT_REQUIRED',
    proof: [{ type: 'path', ref: 'docs/union-eyes/convergence/UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION.md' }],
    gap: 'The disposition cites UE-REPRESENTATIVE-CANONICAL-2.2 (FROZEN), and that canonical file is not in the repository. The disposition is a defect list, not an action-id matrix. Steward has no separate action-id matrix. Seven staff navigation destinations are described there and are not given stable action ids.',
  }),
  cap({
    id: 'UE-OMIT-DELIVERY-EVIDENCE',
    parentRegisterId: 'UE-CONV-I-002',
    obligationKey: 'notification-delivery-evidence',
    primaryGate: 11,
    dependencyGates: [14],
    actor: 'Notification sender',
    businessOutcome: 'Record queued, attempted, accepted, failed, and retried notification facts, and refuse a retry after acceptance.',
    sourceStatus: 'NATIVE_PENDING',
    service: 'apps/union-eyes/lib/services/delivery-reconciliation.ts',
    persistence: 'notification delivery log',
    notificationPolicy: 'ledger_records_attempt_and_acceptance; an attempted row is not confirmed provider delivery',
    sourceFiles: ['apps/union-eyes/lib/services/delivery-reconciliation.ts'],
    sourceTests: ['apps/union-eyes/lib/services/__tests__/delivery-reconciliation.test.ts'],
    nativeTestsRequired: 'apps/union-eyes/db/__tests__/notification-delivery-native.test.ts runs only when UE_DELIVERY_NATIVE_PROOF=1. A skipped run is not evidence.',
    proof: [{ type: 'test', ref: 'apps/union-eyes/lib/services/__tests__/delivery-reconciliation.test.ts' }],
    gap: 'Native concurrency is not recorded. Retry covers a confirmed failure with no acceptance. It is not exactly-once provider delivery. This obligation is absent from the 41-entry register and does not close UE-CONV-I-002.',
  }),
]

const byDistinct = (id) => distinct.find((item) => item.id === id)

byDistinct('UE-OMIT-FINANCE-RANGE-UNSPECIFIED').gap = 'F01–F28 and FJ01–FJ10 form a 38-identifier universe in the financial-officer disposition. Gate 0A searched all 526 refs and the repository history and recovered no Financial Officer canonical. Four identifiers (F08, F09, F10, F19) carry their own statement; F08 and F09 give a status statement and no domain title. Six (F11–F14, F17, F18) carry shared labels: four identifiers share three labels (budgets, expenses, vendors), so no pairing was made. Twenty-eight (F01–F07, F15, F16, F20–F28, FJ01–FJ10) are cited only as range members and the disposition says only that all other domains are NOT_PROVEN. Three further references have no identifier (seven navigation destinations of which three are named, organization scenarios and related acceptance topics). The separation of viewing, preparation, approval, payment execution, reconciliation, mandate administration, and audit is recorded as evidence in ue-gate0a-persona-source-recovery.json with no institutional requirement attached. Gate 0 gives none of the unspecified identifiers a title.'
byDistinct('UE-OMIT-REP-CANONICAL-ABSENT').actor = 'Representative'
byDistinct('UE-OMIT-REP-CANONICAL-ABSENT').businessOutcome = 'Lock the representative R01–R24 identifiers once the frozen UE-REPRESENTATIVE-CANONICAL-2.2 is in the repository.'
byDistinct('UE-OMIT-REP-CANONICAL-ABSENT').gap = 'The Representative 2.2 disposition cites UE-REPRESENTATIVE-CANONICAL-2.2 (FROZEN). Gate 0A searched all 526 refs and the repository history and recovered no canonical. The disposition gives 7 navigation destinations and a 25-row action proof matrix, mapped by source locator (32 individually defined). The first version of that disposition (571784d58, replaced at a0e7753fd) carries titles for R01 identity/mandates, R02 daily workload, R09 member relationships, R13 evidence/records, R14 tasks/deadlines, R15 agreements and R18 WorkAid/specialists, so those 7 are individually defined (title only; no required behavior). R03–R08, R10–R12, R16, R17 and R19–R24 (17 identifiers) stay grouped only: R03–R06 share one parenthetical, R07/R08 share one label cell, R11/R12 share one label, and the rest carry a status and no label. R18 has conflicting statuses (BLOCKED in the first version, MISSING in the current one) and stays an unresolved conflict. Journeys A–G and the institutional scenarios have no identifier.'

distinct.push(
  cap({
    id: 'UE-OMIT-STEWARD-CANONICAL-ABSENT',
    parentRegisterId: 'UE-CONV-I-001',
    obligationKey: 'steward-canonical-action-ids',
    primaryGate: 10,
    actor: 'Steward',
    businessOutcome: 'Lock steward action identifiers once a frozen steward canonical exists in the repository.',
    sourceStatus: 'SOURCE_UNSPECIFIED',
    nativeQualification: 'NOT_REQUIRED',
    browserQualification: 'NOT_REQUIRED',
    proof: [{ type: 'path', ref: 'apps/union-eyes/lib/dashboard/role-experience.ts' }],
    gap: 'No steward canonical, steward action-identifier matrix, or steward disposition exists in the repository or its history (Gate 0A searched 526 refs). Eight evidence items are recorded and none defines an action: the Representative 2.2 disposition describes one combined steward and staff experience and puts the steward at level 1, the repairs list what a steward must not hold or see, and the role exists in code. The reading that the Steward is the level-1 role inside Representative 2.2 is an unverified inference and needs an institutional decision. Gate 0 invents no steward action. The Steward persona cannot be accepted at Gate 10 until the frozen canonical is supplied or that decision is recorded.',
  }),
  cap({
    id: 'UE-OMIT-REP-CORRESPONDENCE',
    parentRegisterId: 'UE-CONV-I-001',
    obligationKey: 'representative-correspondence-lifecycle',
    primaryGate: 11,
    actor: 'Representative',
    businessOutcome: 'Draft, approve, dispatch, and track correspondence as distinct governed states, with thread participants and matter grants.',
    sourceStatus: 'PARTIAL',
    navigationEntrypoint: '/dashboard/correspondence',
    apiRoute: 'app/api/correspondence/route.ts',
    sourceFiles: ['apps/union-eyes/app/api/correspondence/route.ts'],
    proof: [{ type: 'path', ref: 'docs/union-eyes/convergence/UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION.md' }],
    gap: 'The Representative 2.2 disposition records list and draft as IMPLEMENTED-UNVERIFIED (organization required, fails closed), approve, dispatch, delivery, and receipt as not examined, and thread participants and matter grants as MISSING (no model). The correspondence routes are owned here and no approval or delivery state is claimed.',
  }),
  cap({
    id: 'UE-OMIT-REP-TRANSITION-REASON-LEAK',
    parentRegisterId: 'UE-CONV-I-001',
    relatedRegisterIds: ['UE-CONV-K-010'],
    obligationKey: 'representative-transition-reason-visibility',
    primaryGate: 10,
    dependencyGates: [4],
    actor: 'Representative and the member on their own case',
    businessOutcome: 'A member-visible status change records only the from and to status. The representative free-text reason is held in a staff-only record and absent from member-visible metadata.',
    sourceStatus: 'NOT_IMPLEMENTED',
    apiRoute: 'app/api/cases/[caseId]/transition/route.ts',
    httpAction: 'PATCH',
    kernelAction: 'case:transition',
    proof: [{ type: 'path', ref: 'apps/union-eyes/app/api/cases/[caseId]/transition/route.ts' }],
    negativeAndRecovery: 'The repair needs a test asserting that the member case-history projection excludes the reason.',
    gap: 'Representative 2.2 finding P0-F2 is declared OPEN in that disposition. Gate 0 re-read the route at this revision: the member-visible status_change row (isInternal false, visibilityScope member) embeds the representative reason in its message and in its metadata. No second staff-only row is written. Gate 0 did not change the route.',
    trackedDefects: [
      {
        id: 'P0-F2-TRANSITION-REASON-LEAK',
        kind: 'SOURCE_DEFECT',
        file: 'apps/union-eyes/app/api/cases/[caseId]/transition/route.ts',
        sourceQuote: 'Status changed: ${fromStatus} → ${toDbStatus}. Reason: ${reason}',
        description: 'The member-visible case-history row embeds the representative free-text reason in message and metadata (Representative 2.2 finding P0-F2).',
        blocksGates: [10],
      },
    ],
  }),
  cap({
    id: 'UE-OMIT-ROUTE-DOMAIN-SCOPE',
    parentRegisterId: 'UE-CONV-K-007',
    relatedRegisterIds: ['UE-CONV-K-008'],
    obligationKey: 'route-domain-scope-decision',
    primaryGate: 13,
    actor: 'Programme owner (scope decision)',
    businessOutcome: 'Give each route domain that no register entry, persona source, or capability-registry record names an explicit decision: adopt it under a named capability, retire it to HTTP 501, or record it as out of scope with evidence.',
    sourceStatus: 'SOURCE_UNSPECIFIED',
    nativeQualification: 'NOT_REQUIRED',
    browserQualification: 'NOT_REQUIRED',
    proof: [{ type: 'path', ref: 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json' }],
    gap: 'The route-coverage manifest lists operations in domains that no register entry, frozen persona source, or capability-registry record names. Their operations carry disposition SCOPE_UNDECIDED in ue-route-capability-ownership.json, and their control owner stays the guard-class owner. Gate 0 does not guess a business owner from a route name.',
  }),
)

// NOT_IMPLEMENTED finance domains cite a service in the narrative. The validator
// rejects source files on NOT_IMPLEMENTED, so the retired route stays in the gap text only.
const financeUnavailable = distinct.find((item) => item.id === 'UE-OMIT-FINANCE-UNAVAILABLE')
financeUnavailable.service = null

capabilities.find((item) => item.id === 'UE-CAP-B-001').trackedDefects = [
  {
    id: 'MUTABLE-REP-IDENTIFIER@case-ownership-backfill',
    kind: 'RATCHET',
    ratchetId: 'MUTABLE-REP-IDENTIFIER',
    file: 'apps/union-eyes/lib/authority/store/case-ownership-backfill.ts',
    description: 'The ownership backfill reads grievances.union_rep_id, a mutable identifier with no foreign key that is not an authority source. The global convergence checker reports an unexpected occurrence. The implementation and the allowlist are unchanged.',
    blocksGates: [2],
  },
]
capabilities.find((item) => item.id === 'UE-CAP-K-005').trackedDefects = [
  {
    id: 'DIRECT-MANDATORY-AUDIT-IMPORT@election-succession',
    kind: 'RATCHET',
    ratchetId: 'DIRECT-MANDATORY-AUDIT-IMPORT',
    file: 'apps/union-eyes/lib/voting/election-succession.ts',
    description: 'appendMandatoryAudit returns false outside Canonical V2 and leaves the caller unaudited. The global convergence checker reports an unexpected occurrence. The implementation and the allowlist are unchanged.',
    blocksGates: [14, 12],
  },
]
capabilities.find((item) => item.id === 'UE-CAP-G-001').trackedDefects = [
  {
    id: 'COUNSEL-PGLITE-SUITE-FAILS-AT-SETUP',
    kind: 'TEST_SUITE',
    suite: 'apps/union-eyes/db/__tests__/authority-kernel-counsel.pglite.test.ts',
    file: 'apps/union-eyes/db/__tests__/authority-kernel-counsel.pglite.test.ts',
    description: 'The suite fails in beforeAll with REFERRAL_SCOPE_REQUIRED, raised by the referral-scope trigger of platform migration 0037, so none of its 13 assertions run.',
    blocksGates: [7],
  },
]

const f003 = capabilities.find((item) => item.id === 'UE-CAP-F-003')
f003.sourceFiles = []
f003.proof = [{ type: 'test', ref: 'apps/union-eyes/lib/authority/__tests__/kernel-third-party.test.ts' }]

const a002 = capabilities.find((item) => item.id === 'UE-CAP-A-002')
a002.proof = [{ type: 'commit', ref: 'b6bb51acd' }, { type: 'path', ref: 'apps/union-eyes/lib/authority/store/platform-identity.ts' }]

for (const id of ['UE-CAP-H-001', 'UE-CAP-K-002']) {
  const item = capabilities.find((capability) => capability.id === id)
  item.proof.push({ type: 'commit', ref: '01b7a0ecb' })
}

const documents = capabilities.find((item) => item.id === 'UE-CAP-F-002')
const documentPage = 'apps/union-eyes/app/[locale]/dashboard/documents/page.tsx'
if (!ctx) throw new Error('context missing')
try {
  readFileSync(join(ROOT, documentPage))
} catch {
  documents.sourceFiles = ['apps/union-eyes/components/member/my-union.tsx']
  documents.navigationEntrypoint = '/dashboard/documents'
}

const all = [...capabilities, ...distinct]

const evidenceFile = JSON.parse(readFileSync(join(ROOT, FILES.evidence), 'utf8'))
const deps = evidenceDeps(ROOT)
for (const item of all) {
  if (item.sourceStatus !== 'SOURCE_VERIFIED') continue
  const problems = executionEvidenceProblems(item, evidenceFile, deps)
  if (problems.length === 0) continue
  const executed = evidenceFile.records.find((record) => record.capabilityId === item.id)
  const failedSuite = executed?.files?.some((file) => file.suiteStatus !== 'passed' || file.failed > 0 || file.skipped > 0)
  item.sourceStatus = failedSuite ? 'PARTIAL' : 'SOURCE_IMPLEMENTED'
  item.lifecycleState = item.sourceStatus
  item.gap = `${item.gap} Downgraded from SOURCE_VERIFIED: ${problems[0].replace(`${item.id} is SOURCE_VERIFIED without execution evidence: `, '')}.`
}
const personaMap = {
  [SOURCE_FILES['governance-officer']]: {
    G01: 'UE-CAP-I-001', G02: 'UE-CAP-I-001', G03: 'UE-CAP-I-001', G04: 'UE-CAP-I-001', G05: 'UE-CAP-I-001', G06: 'UE-CAP-I-001',
    G07: 'UE-CAP-REVIEW-INTAKE', G08: 'UE-CAP-REVIEW-INTAKE', G09: 'UE-CAP-I-001', G10: 'UE-CAP-B-001', G11: 'UE-CAP-K-009', G12: 'UE-CAP-K-009',
    G13: 'UE-CAP-I-001', G14: 'UE-OMIT-PRIVACY-RIGHTS', G15: 'UE-OMIT-PRIVACY-RIGHTS', G16: 'UE-OMIT-PRIVACY-RIGHTS', G17: 'UE-CAP-F-003',
    G18: 'UE-CAP-F-002', G19: 'UE-CAP-G-002', G20: 'UE-CAP-I-001', G21: 'UE-CAP-D-003', G22: 'UE-CAP-K-003', G23: 'UE-CAP-K-005', G24: 'UE-CAP-I-001',
    G25: 'UE-CAP-I-001', G26: 'UE-CAP-I-001', G27: 'UE-CAP-G-002', G28: 'UE-CAP-I-001', G29: 'UE-CAP-I-001', G30: 'UE-OMIT-A11Y-BILINGUAL',
  },
  [SOURCE_FILES['officer-executive']]: {
    O01: 'UE-CAP-I-001', O02: 'UE-CAP-I-001', O03: 'UE-CAP-I-001', O04: 'UE-CAP-B-001', O05: 'UE-CAP-I-001', O06: 'UE-CAP-I-001', O07: 'UE-CAP-I-001',
    O08: 'UE-CAP-I-001', O09: 'UE-CAP-K-009', O10: 'UE-CAP-I-001', O11: 'UE-CAP-I-001', O12: 'UE-CAP-I-001', O13: 'UE-OMIT-FINANCE-UNAVAILABLE',
    O14: 'UE-CAP-D-002', O15: 'UE-CAP-D-001', O16: 'UE-CAP-I-001', O17: 'UE-CAP-I-001', O18: 'UE-CAP-I-001', O19: 'UE-CAP-G-002', O20: 'UE-CAP-I-001',
    O21: 'UE-OMIT-PRIVACY-RIGHTS', O22: 'UE-CAP-I-001', O23: 'UE-CAP-I-001', O24: 'UE-CAP-I-001', O25: 'UE-CAP-I-001', O26: 'UE-OMIT-A11Y-BILINGUAL',
  },
  [SOURCE_FILES['senior-representative']]: {
    SR01: 'UE-CAP-I-001', SR02: 'UE-CAP-I-001', SR03: 'UE-CAP-I-001', SR04: 'UE-CAP-B-001', SR05: 'UE-CAP-I-001', SR06: 'UE-CAP-I-001', SR07: 'UE-CAP-I-001',
    SR08: 'UE-CAP-I-001', SR09: 'UE-CAP-I-001', SR10: 'UE-OMIT-DEADLINE-OVERDUE', SR11: 'UE-CAP-B-001', SR12: 'UE-CAP-F-002', SR13: 'UE-CAP-I-001',
    SR14: 'UE-CAP-G-002', SR15: 'UE-CAP-I-001', SR16: 'UE-CAP-I-001', SR17: 'UE-CAP-I-001', SR18: 'UE-CAP-I-001', SR19: 'UE-CAP-I-001', SR20: 'UE-CAP-I-001',
    SR21: 'UE-CAP-I-001', SR22: 'UE-OMIT-A11Y-BILINGUAL',
  },
  [SOURCE_FILES.member]: {
    M01: 'UE-CAP-A-004', M02: 'UE-CAP-I-001', M03: 'UE-CAP-K-010', M04: 'UE-OMIT-M04-MEMBER-REQUESTS', M05: 'UE-CAP-I-002', M06: 'UE-CAP-F-002',
    M07: 'UE-CAP-I-001', M08: 'UE-CAP-G-002', M09: 'UE-OMIT-PRIVACY-RIGHTS', M10: 'UE-OMIT-A11Y-BILINGUAL',
  },
  [SOURCE_FILES.representative]: {
    'REP-NAV-1': 'UE-CAP-I-001', 'REP-NAV-2': 'UE-CAP-I-001', 'REP-NAV-3': 'UE-CAP-I-001', 'REP-NAV-4': 'UE-OMIT-REP-CORRESPONDENCE',
    'REP-NAV-5': 'UE-CAP-F-002', 'REP-NAV-6': 'UE-OMIT-DEADLINE-OVERDUE', 'REP-NAV-7': 'UE-CAP-I-001',
    'REP-ACT-01': 'UE-CAP-I-001', 'REP-ACT-02': 'UE-CAP-K-010', 'REP-ACT-03': 'UE-CAP-K-010', 'REP-ACT-04': 'UE-CAP-B-001', 'REP-ACT-05': 'UE-CAP-B-001',
    'REP-ACT-06': 'UE-CAP-K-010', 'REP-ACT-07': 'UE-CAP-K-010', 'REP-ACT-08': 'UE-CAP-K-010', 'REP-ACT-09': 'UE-CAP-B-001', 'REP-ACT-10': 'UE-CAP-I-001',
    'REP-ACT-11': 'UE-CAP-I-001', 'REP-ACT-12': 'UE-OMIT-REP-CORRESPONDENCE', 'REP-ACT-13': 'UE-OMIT-REP-CORRESPONDENCE', 'REP-ACT-14': 'UE-OMIT-REP-CORRESPONDENCE',
    'REP-ACT-15': 'UE-CAP-F-002', 'REP-ACT-16': 'UE-CAP-F-001', 'REP-ACT-17': 'UE-CAP-F-002', 'REP-ACT-18': 'UE-OMIT-DEADLINE-OVERDUE', 'REP-ACT-19': 'UE-CAP-K-010',
    'REP-ACT-20': 'UE-CAP-I-001', 'REP-ACT-21': 'UE-CAP-B-001', 'REP-ACT-22': 'UE-CAP-I-001', 'REP-ACT-23': 'UE-OMIT-REP-TRANSITION-REASON-LEAK',
    'REP-ACT-24': 'UE-CAP-G-002', 'REP-ACT-25': 'UE-OMIT-A11Y-BILINGUAL',
  },
  [SOURCE_FILES['financial-officer']]: {
    F08: 'UE-CAP-D-003', F09: 'UE-CAP-D-001', F10: 'UE-OMIT-FINANCE-UNAVAILABLE', F19: 'UE-CAP-D-003',
    F11: 'UE-OMIT-FINANCE-UNAVAILABLE', F12: 'UE-OMIT-FINANCE-UNAVAILABLE', F13: 'UE-OMIT-FINANCE-UNAVAILABLE', F14: 'UE-OMIT-FINANCE-UNAVAILABLE',
    F17: 'UE-OMIT-FINANCE-UNAVAILABLE', F18: 'UE-OMIT-FINANCE-UNAVAILABLE',
  },
}

const recoveredCapability = Object.fromEntries((loadRecovery(ROOT)?.identifiers ?? []).filter((item) => item.capabilityId && item.persona === 'representative').map((item) => [item.id, item.capabilityId]))
const personaActions = personaActionsFromSpecs(personaSpecs).map((action) => {
  const explicit = personaMap[action.source]?.[action.actionId] ?? (action.definition === 'INDIVIDUAL' ? recoveredCapability[action.actionId] : undefined)
  const fallback = action.persona === 'financial-officer' ? UNRESOLVED_OWNER['financial-officer'] : action.persona === 'representative' && /^R\d{2}$/.test(action.actionId) ? UNRESOLVED_OWNER.representative : undefined
  const capabilityId = explicit ?? fallback
  if (!capabilityId) throw new Error(`no mapping for ${action.persona} ${action.actionId}`)
  return { persona: action.persona, source: action.source, actionId: action.actionId, definition: action.definition, capabilityId, mandatory: true }
})

const personaCompleteness = PERSONAS.map((persona) => {
  const spec = personaSpecs[persona]
  return {
    persona,
    label: spec.label,
    sourceFile: spec.sourceFile,
    canonicalFileFound: spec.canonicalFileFound,
    universe: spec.universe,
    individuallyDefined: spec.individuallyDefined,
    groupedOnly: spec.groupedOnly,
    unspecified: spec.unspecified,
    resolved: spec.resolved,
    definitionSources: spec.definitionSources,
    conflicts: spec.conflicts,
    unidentifiedReferences: spec.unidentifiedReferences,
    trackingCapability: UNRESOLVED_OWNER[persona] ?? null,
  }
})

const kernelActionAssignments = {
  'case:read': 'UE-CAP-K-010',
  'case:read_own_submission': 'UE-CAP-K-010',
  'case:read_internal': 'UE-CAP-F-001',
  'case:read_third_party_restricted': 'UE-CAP-F-001',
  'case:read_privileged': 'UE-CAP-F-001',
  'case:comment': 'UE-CAP-K-010',
  'case:write_notes': 'UE-CAP-K-010',
  'case:draft_action': 'UE-CAP-K-010',
  'case:upload_evidence': 'UE-CAP-K-010',
  'case:modify_document': 'UE-CAP-F-002',
  'case:process_ocr': 'UE-CAP-K-010',
  'case:disclose_to_member': 'UE-CAP-F-001',
  'case:export_sealed_evidence': 'UE-CAP-F-001',
  'case:close': 'UE-CAP-K-010',
  'case:transition': 'UE-CAP-K-010',
  'case:assign': 'UE-CAP-B-001',
  'finance:view': 'UE-CAP-D-003',
  'finance:prepare': 'UE-CAP-D-002',
  'finance:approve': 'UE-CAP-D-002',
  'finance:execute': 'UE-CAP-D-002',
  'finance:reconcile': 'UE-CAP-D-002',
  'finance:audit': 'UE-CAP-D-003',
  'governance:approve': 'UE-CAP-I-001',
  'governance:supersede_certified_result': 'UE-CAP-K-009',
  'review:monitor': 'UE-CAP-REVIEW-INTAKE',
  'review:access_evidence': 'UE-CAP-I-001',
  'review:issue_finding': 'UE-CAP-I-001',
  'review:request_corrective_action': 'UE-CAP-I-001',
  'review:enforce': 'UE-CAP-I-001',
  'review:verify_remediation': 'UE-CAP-I-001',
  'workaid:refer': 'UE-CAP-G-002',
  'workaid:receive_disclosure': 'UE-CAP-G-002',
  'workaid:read_counsel_material': 'UE-CAP-G-003',
  'message:read': 'UE-CAP-I-002',
  'message:reply': 'UE-CAP-I-002',
  'message:close': 'UE-CAP-I-002',
  'message:archive': 'UE-CAP-I-002',
  'message:place_legal_hold': 'UE-CAP-I-002',
  'message:release_legal_hold': 'UE-CAP-I-002',
  'message:adopt_retention': 'UE-CAP-I-002',
  'message:read_retention_policy': 'UE-CAP-I-002',
}

const guardAssignments = {
  ADMIN_AUTH: 'UE-CAP-K-007',
  CAPABILITY_TOKEN: 'UE-CAP-A-004',
  CRON_SECRET: 'UE-CAP-K-008',
  CRUD_FACTORY: 'UE-CAP-K-007',
  DELEGATED: 'UE-CAP-K-010',
  NONE: 'UE-CAP-K-008',
  ORG_AUTH: 'UE-CAP-E-001',
  PLATFORM_AUTH_HANDLER: 'UE-CAP-A-006',
  RETIRED: 'UE-CAP-H-001',
  ROLE_AUTH: 'UE-CAP-K-007',
  SESSION_AUTH: 'UE-CAP-A-004',
  WEBHOOK_SIGNATURE: 'UE-CAP-K-008',
  WITH_API: 'UE-CAP-K-008',
  WITH_API_PUBLIC: 'UE-CAP-K-008',
}

const stubActionAssignments = {}
for (const record of ctx.registryActions) {
  if (record.id === 'UE-ACTION-ORG-HIERARCHY-SEED') stubActionAssignments[record.id] = 'UE-SCOPE-ORG-HIERARCHY-SEED'
  else if (record.id.startsWith('UE-ACTION-')) stubActionAssignments[record.id] = 'UE-CAP-H-002'
  else stubActionAssignments[record.id] = 'UE-OMIT-MAIN-APP-CRONS'
}

const manifestKeys = new Set(ctx.routes.map((route) => route.route))
const uninventoried = ctx.diskRouteKeys
  .filter((key) => !manifestKeys.has(key))
  .map((key) => {
    const text = readFileSync(join(ROOT, 'apps/union-eyes/app/api', key), 'utf8')
    const methods = [...new Set([...text.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((match) => match[1]))].sort()
    if (key !== 'reviews/route.ts') throw new Error(`unexpected uninventoried route ${key}`)
    return {
      route: key,
      methods,
      capabilityId: 'UE-CAP-REVIEW-INTAKE',
      reason: 'The member review-intake route was added after the route-coverage manifest was last regenerated. The manifest still lists 993 routes and the route-coverage test expects every route file. Regenerating the manifest belongs to UE-CONV-K-008 and is not done in Gate 0.',
    }
  })

const ownership = buildOwnership({ routes: ctx.routes, registryActions: ctx.registryActions, uninventoried })
const entriesHash = ownershipHash(ownership.entries)

const matrix = {
  schemaVersion: 1,
  mission: 'UE-FINAL-CONVERGENCE-2026-10',
  gate0Verdict: 'IN_PROGRESS',
  evaluatedBaselineSha: 'ce854162cae5595f2f00e65db14444229da0a6ab',
  statusVocabulary: {
    NOT_IMPLEMENTED: 'The required outcome has no implementation in the cited source.',
    PARTIAL: 'Some of the required outcome exists in source. The recorded gap remains. A cited file is not verification.',
    SOURCE_IMPLEMENTED: 'The recorded source outcome is present in the cited files. Native and browser qualification are separate.',
    SOURCE_VERIFIED: 'The cited suites were executed and every test file passed in full with no skip, against the recorded revision and file hashes (gate0-source-verification.json). A test file that exists is not verification. This is not a native PostgreSQL pass and not operational acceptance.',
    NATIVE_PENDING: 'The recorded source outcome is present and the blocking remainder is an unrecorded native or credentialed runtime proof.',
    EXTERNAL_GATE: 'A named external owner holds the missing proof. operationallyActivated is false.',
    SOURCE_UNSPECIFIED: 'The frozen source cites the identifier without a distinct in-repository outcome. This is not an implementation claim.',
  },
  gates: {
    1: 'Identity, sessions and membership',
    2: 'Case ownership and representation',
    3: 'Bargaining units, territories and respondents',
    4: 'Claims/grievances convergence',
    5: 'Finance operating model',
    6: 'Documents, privacy and records',
    7: 'WorkAid union-side completion',
    8: 'Thirteen stubbed operations',
    9: 'Runtime and installation architecture',
    10: 'Frozen persona journeys',
    11: 'Member/staff messaging',
    12: 'Voting, elections and reviews',
    13: 'Generic CRUD and route authorization',
    14: 'Audit, mutation isolation and security',
    15: 'Machine-enforced completion and cleanroom readiness',
    'schema-census': 'UE-CONV-H-007 preserved as one later workstream. Its 231 entries are not individually reclassified.',
  },
  capabilities: all,
  personaActions,
  personaCompleteness,
  personaRecovery: { file: RECOVERY_FILE, kind: 'EVIDENCE_CONSOLIDATION' },
  proposedPersonaBaselines: {
    status: 'READY_FOR_PRODUCT_SPECIFICATION_REVIEW',
    adopted: false,
    frozen: false,
    originalRecovered: false,
    note: 'Three proposed new baselines are available for review. They are new designs, not recovered originals. They do not resolve a persona, add a capability, or create institutional authority.',
    data: Object.fromEntries(Object.entries(BASELINE_DATA).map(([key, file]) => [key, { file, sha256: sha256File(ROOT, file) }])),
    documents: BASELINE_DOCS,
  },
  routeOwnership: { file: FILES.ownership, entriesHash, operations: ownership.entries.length },
  outOfScope: [
    {
      id: 'UE-SCOPE-ORG-HIERARCHY-SEED',
      topic: 'Organization hierarchy seeding',
      reason: 'UE-CONV-H-005 says a canonical seed, if wanted, is a new capability. The current route is an honest HTTP 501. Gate 0 does not adopt a seed product.',
      evidence: 'apps/union-eyes/lib/reality/capability-registry.ts UE-ACTION-ORG-HIERARCHY-SEED',
    },
    {
      id: 'UE-SCOPE-M07-UNADOPTED-SURFACES',
      topic: 'Agreement, benefits, events, participation, and digital card',
      reason: 'The member canonical tells My Union to list these as not available and not to invent values. That honest absence is not an authorization to build those products in Gates 1–15.',
      evidence: 'docs/union-eyes/reality-remediation/UE_MEMBER_CANONICAL_2_1.md M07',
    },
    {
      id: 'UE-SCOPE-REPORTS-DASHBOARD-REMOVED',
      topic: 'Reports dashboard index',
      reason: 'The capability registry records /dashboard/reports as REMOVED. Gate 0 does not restore it.',
      evidence: 'apps/union-eyes/lib/reality/capability-registry.ts reports dashboard index',
    },
    {
      id: 'UE-SCOPE-WORKAID-SYNTHETIC-JOURNEYS',
      topic: 'WorkAid synthetic persona journey contracts',
      reason: 'docs/union-eyes/workaid/14_PERSONA_JOURNEY_CONTRACTS.md is an in-memory contract, not a Union Eyes screen, route, or database journey. Counsel execution stays on UE-CONV-G-003.',
      evidence: 'docs/union-eyes/workaid/14_PERSONA_JOURNEY_CONTRACTS.md',
    },
    {
      id: 'UE-SCOPE-COUNSEL-HTTP-ROUTE',
      topic: 'Counsel HTTP route',
      reason: 'No counsel HTTP route is in the committed engineering scope. Counsel-side verification remains the external gate UE-CONV-G-003.',
      evidence: 'docs/union-eyes/convergence/UE-WORKAID-COUNSEL-BOUNDARY-CONTRACT.md',
    },
  ],
  dispositions: [],
  lockedCapabilityIds: all.map((item) => item.id).sort(),
  routeBaseline: {
    manifest: 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json',
    algorithm: 'sha256 of sorted route|methods|guard lines',
    hash: routeBaselineHash(ctx.routes),
    routeCount: ctx.routes.length,
    guardCounts: guardCounts(ctx.routes),
    guardAssignments,
    note: 'Guard-class assignment locks a new guard or a changed guard count. It does not copy the 993-route manifest into a second inventory.',
  },
  kernelBaseline: {
    source: 'apps/union-eyes/lib/authority/ontology.ts',
    algorithm: 'sha256 of sorted ACTIONS entries',
    hash: kernelBaselineHash(ctx.kernelActions),
    count: ctx.kernelActions.length,
  },
  kernelActionAssignments,
  stubActionAssignments,
}

writeFileSync(join(ROOT, FILES.matrix), `${JSON.stringify(matrix, null, 2)}\n`)
writeFileSync(join(ROOT, FILES.ownership), ownershipJson(ownership))

const lockPath = join(ROOT, FILES.lock)
if (!existsSync(lockPath)) {
  mkdirSync(dirname(lockPath), { recursive: true })
  writeFileSync(lockPath, `${JSON.stringify({
    schemaVersion: 1,
    lockVersion: 1,
    note: 'Independent capability lock. The anchored capability set is read from git history at anchorCommit, which an edit to the working tree cannot change. A capability may leave the matrix only through a retirement record here with schemaVersion 2 or later, a reason, and an existing evidence file.',
    anchorCommit: '2247978bd642a89a7d4f8bd720b978f789cb4437',
    anchorMatrixPath: FILES.matrix,
    capabilityIds: all.map((item) => item.id).sort(),
    retirements: [],
  }, null, 2)}\n`)
}
console.log(`wrote ${all.length} capabilities, ${personaActions.length} persona mappings, ${ownership.entries.length} route operations, ${h002.scopedRoutes.length} stub routes, census ${ctx.censusCount}`)
