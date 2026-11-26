import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const STEP1_BASELINE_SHA = 'b00a3624619be09aa77cd201fa7fe8a8c16b21f3'
export const STEP1_PR = 1309
export const PLANNING_SCHEMA = 1

const INVENTORIES = [
  ['authorityActionIndex', (recon) => recon.authorityActionIndex],
  ['baseFamilies', (recon) => recon.baseFamilies],
  ['canonicalDecisionCoverage.scopeApplicability', (recon) => recon.canonicalDecisionCoverage.scopeApplicability],
  ['commercialCommitmentMatrix.rows', (recon) => recon.commercialCommitmentMatrix.rows],
  ['historicalCapabilities', (recon) => recon.historicalCapabilities],
  ['historicalPersonaIdentifiers', (recon) => recon.historicalPersonaIdentifiers],
  ['historicalPilotScope.excluded', (recon) => recon.historicalPilotScope.excluded],
  ['historicalPilotScope.included', (recon) => recon.historicalPilotScope.included],
  ['historicalStoryIndex', (recon) => recon.historicalStoryIndex],
  ['operatingModelScope.crossCuttingVariants', (recon) => recon.operatingModelScope.crossCuttingVariants],
  ['operatingModelScope.presets', (recon) => recon.operatingModelScope.presets],
  ['reconstructedPersonaContracts', (recon) => recon.reconstructedPersonaContracts],
  ['registryCapabilities', (recon) => recon.registryCapabilities],
  ['stakeholderCensus.roleValues', (recon) => recon.stakeholderCensus.roleValues],
  ['stakeholderCensus.stakeholderFamilies', (recon) => recon.stakeholderCensus.stakeholderFamilies],
  ['stakeholderLifecycle.stages', (recon) => recon.stakeholderLifecycle.stages],
]

const FUNCTIONAL = [
  ['C01', 'Invitation to first case', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable browser invitation journey on the Step 1 production build. Provider delivery is not proven.'],
  ['C02', 'Truthful invitation email status', 'SOURCE_PRESENT_RUNTIME_UNPROVEN', 'UNEXECUTED', 'Invitation UI exists in the action contract. No provider receipt is bound to b00a362.'],
  ['C03', 'Invitation reissue and revocation', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable journey recorded revoke, replay refusal and wrong-organization refusal.'],
  ['C04', 'Organization-admin invitation entry', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Admin invitation route exists. The disposable journey proved platform-executive organization creation, not the full organization-admin console.'],
  ['C05', 'Persistent organization setup', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable platform-executive create returned 201 and read the organization row back. Staging setup is unproven.'],
  ['C06', 'Membership and access lifecycle', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Redeemed invitation created one membership in the inviting organization. Suspension, reinstatement and deployed revocation are unproven.'],
  ['C07', 'Multiple capacity and active organization', 'SOURCE_PRESENT_RUNTIME_UNPROVEN', 'UNEXECUTED', 'Authority facts and representation protocol source exist. No multi-capacity journey is in the Step 1 browser matrix.'],
  ['C08', 'Connected intake to closure', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable filing persisted a claim and reopened it. Closure is not in that journey.'],
  ['C09', 'Automatic workload and expertise assignment', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable proof assigned one scoped filing to a second steward. Automatic workload matching remains a pending staging criterion.'],
  ['C10', 'Senior representative supervision', 'SOURCE_PRESENT_RUNTIME_UNPROVEN', 'UNEXECUTED', 'Case policy and issuance source exist. No supervision journey is in the Step 1 matrix.'],
  ['C11', 'Successor handoff', 'SOURCE_PRESENT_RUNTIME_UNPROVEN', 'UNEXECUTED', 'Lifecycle store source exists. No successor journey is in the Step 1 matrix.'],
  ['C12', 'Member case follow-through', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable member list and detail reopened the persisted case.'],
  ['C13', 'Role-specific document journey', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Private-document suite and E2E shard 4 passed on the disposable runtime of the Step 1 head. Staging byte delivery is unproven.'],
  ['C14', 'User-facing sealed evidence export', 'SOURCE_PRESENT_RUNTIME_UNPROVEN', 'UNEXECUTED', 'Older candidates recorded export work. That evidence is not bound to b00a362 and is not staging acceptance.'],
  ['C15', 'OCR document extraction', 'SOURCE_PRESENT_RUNTIME_UNPROVEN', 'UNEXECUTED', 'The action contract names the OCR route and service. No OCR receipt is bound to this head.'],
  ['C16', 'Correspondence approval and dispatch', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable journey persisted a draft and refused the member. Dispatch and provider acceptance are unproven.'],
  ['C17', 'Staff messaging and preferences', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable thread create wrote messages.thread.create. Preferences and deployed delivery are unproven.'],
  ['C18', 'Leadership indicators and drill-down', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable leadership report allowed the executive and refused the member. Drill-down is unproven.'],
  ['C19', 'Organization administration and audit operations', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable sign-in policy save and platform organization create read rows and audit events back. Full admin audit operations are unproven.'],
  ['C20', 'Privacy request handling', 'SOURCE_PRESENT_RUNTIME_UNPROVEN', 'UNEXECUTED', 'Privacy request route and library exist in the action contract. No DSAR journey is in the Step 1 matrix.'],
  ['C21', 'Connected deadlines', 'SOURCE_PRESENT_RUNTIME_UNPROVEN', 'UNEXECUTED', 'Deadline source exists. No connected-deadline journey is in the Step 1 matrix.'],
  ['C22', 'Failure, concurrency and recovery coverage', 'PARTIALLY_IMPLEMENTED', 'TARGETED_TESTED', 'Disposable proof covers filing retry, policy 409, document audit failure and concurrent downloads. It is not the whole family and it is not staging.'],
]

const CONTROL_CLASSES = [
  'unauthorized-negative',
  'wrong-tenant',
  'expired-or-revoked',
  'retry-concurrency',
  'persisted-readback',
  'audit-event',
  'presentation-en-fr-mobile',
  'recovery',
]

const REASSIGNMENT = new Set(['C08', 'C09', 'C10', 'C11', 'C13'])
const ADVERSE = new Set(['C08', 'C13', 'C16', 'C18', 'C19'])

const CLASSIFICATION = Object.fromEntries(FUNCTIONAL.map(([id, , kind, tier, evidence]) => [id, { kind, tier, evidence }]))

function readJson(root, path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'))
}

function required(items) {
  return items.filter((item) => item.scope === 'REQUIRED')
}

export function loadCanonical(root) {
  return {
    recon: readJson(root, 'docs/union-eyes/staging/UE_V2_BASE_PRODUCT_SCOPE_RECONCILIATION.json'),
    coverage: readJson(root, 'docs/union-eyes/staging/UE_V2_BASE_ACTION_COVERAGE.json'),
    go: readJson(root, 'docs/union-eyes/staging/UE_STAGING_GO_CONTRACT.json'),
    candidate: readJson(root, 'tooling/scripts/lib/ue-v2-staging-candidate.json'),
  }
}

export function scopeNodes(recon) {
  const nodes = []
  for (const [inventory, select] of INVENTORIES) {
    for (const item of required(select(recon))) {
      const baseActionIds = [...(item.baseActionIds ?? [])].sort()
      if (baseActionIds.length < 1) throw new Error(`Required scope node ${inventory}:${item.id} has no action join`)
      nodes.push({ inventory, id: String(item.id), baseActionIds, proofStatus: 'UNEXECUTED' })
    }
  }
  nodes.sort((a, b) => `${a.inventory}:${a.id}`.localeCompare(`${b.inventory}:${b.id}`))
  return nodes
}

function roleExpectation(role) {
  if (role.group === 'AFFILIATED_INSTITUTION') return 'DENY_WITHOUT_MATTER_MANDATE'
  if (role.group === 'PLATFORM_OPERATOR' || role.group === 'PLATFORM_SPECIALTY') return 'DENY_TITLE_DOES_NOT_GRANT_LOCAL_CASE'
  if (role.group === 'LOCAL_SPECIALTY') return 'ALLOW_ONLY_WHEN_ASSIGNED_STEWARD_CAPACITY'
  if (role.id === 'member') return 'ALLOW_OWN_CASE_ONLY'
  return 'ALLOW_ONLY_WITH_LIVE_CASE_AUTHORITY'
}

function row(partial) {
  return {
    proofStatus: 'UNEXECUTED',
    environment: 'DEPLOYED_STAGING_REQUIRED',
    evidence: null,
    authoritySource: 'AUTHENTICATED_IDENTITY_AND_ACTIVE_MEMBERSHIP_AND_CAPACITY_AND_RESOURCE_AUTHORITY',
    organizationScope: 'ONE_ACTIVE_ORGANIZATION_NO_HIERARCHY_BYPASS',
    ...partial,
  }
}

export function matrixRows(recon, coverage) {
  const families = new Map(recon.stakeholderCensus.stakeholderFamilies.map((item) => [item.id, item]))
  const rows = []
  for (const action of coverage.actions) {
    const info = CLASSIFICATION[action.id]
    for (const stakeholderId of action.qualificationContract.stakeholderIds) {
      const family = families.get(stakeholderId)
      if (!family) throw new Error(`Unknown stakeholder ${stakeholderId} on ${action.id}`)
      const deferred = family.scope !== 'REQUIRED'
      rows.push(row({
        id: `${action.id}:${stakeholderId}:${deferred ? 'deferred-actor-denial' : 'authorized-positive'}`,
        actionId: action.id,
        proofClass: deferred ? 'deferred-actor-denial' : 'authorized-positive',
        actorType: 'stakeholder-family',
        actorId: stakeholderId,
        actorScope: family.scope,
        capacity: family.kind,
        resource: action.action,
        lifecycleIds: family.lifecycleIds ?? [],
        expectedResult: deferred ? 'DENY_DEFERRED_ACTOR_IS_NOT_A_PASS' : 'ALLOW_ONLY_WITH_LIVE_RESOURCE_AUTHORITY',
        presentation: 'EN_FR_AND_NARROW_VIEWPORT_WHEN_A_PERSON_USES_THE_SURFACE',
        step1Tier: info.tier,
      }))
    }
    for (const proofClass of CONTROL_CLASSES) {
      rows.push(row({
        id: `${action.id}:control:${proofClass}`,
        actionId: action.id,
        proofClass,
        actorType: 'control',
        actorId: 'SA30',
        actorScope: 'REQUIRED',
        capacity: 'NEGATIVE_CONTROL',
        resource: action.action,
        lifecycleIds: [],
        expectedResult: proofClass === 'unauthorized-negative' || proofClass === 'wrong-tenant' || proofClass === 'expired-or-revoked'
          ? 'DENY_AND_AUDIT'
          : 'PERSISTED_RESULT_MATCHES_THE_COMMITTED_DECISION',
        presentation: proofClass === 'presentation-en-fr-mobile' ? 'EN_FR_DESKTOP_AND_NARROW_VIEWPORT' : 'API_AND_AUDIT',
        step1Tier: info.tier,
      }))
    }
    if (REASSIGNMENT.has(action.id)) {
      rows.push(row({
        id: `${action.id}:control:resource-reassignment`,
        actionId: action.id,
        proofClass: 'resource-reassignment',
        actorType: 'control',
        actorId: 'ASSIGNED_THEN_REASSIGNED',
        actorScope: 'REQUIRED',
        capacity: 'CASE_ASSIGNMENT',
        resource: action.action,
        lifecycleIds: ['L07', 'L11'],
        expectedResult: 'PRIOR_ACTOR_LOSES_ACCESS_AND_SUCCESSOR_GAINS_ONLY_THAT_RESOURCE',
        presentation: 'API_AND_AUDIT',
        step1Tier: info.tier,
      }))
    }
    if (ADVERSE.has(action.id)) {
      rows.push(row({
        id: `${action.id}:control:adverse-principal`,
        actionId: action.id,
        proofClass: 'adverse-principal',
        actorType: 'stakeholder-family',
        actorId: 'SA19',
        actorScope: 'REQUIRED',
        capacity: 'ADVERSE_OR_EXTERNAL_PRINCIPAL',
        resource: action.action,
        lifecycleIds: ['L10'],
        expectedResult: 'DENY_INTERNAL_CASE_ACCESS_UNLESS_A_LIVE_RECIPIENT_GRANT_EXISTS',
        presentation: 'API_AND_AUDIT',
        step1Tier: info.tier,
      }))
    }
  }
  for (const role of required(recon.stakeholderCensus.roleValues)) {
    rows.push(row({
      id: `C08:role:${role.id}:role-boundary`,
      actionId: 'C08',
      proofClass: 'role-boundary',
      actorType: 'stored-role',
      actorId: role.id,
      actorScope: role.scope,
      capacity: role.group,
      resource: 'case',
      lifecycleIds: ['L07'],
      expectedResult: roleExpectation(role),
      presentation: 'DEPLOYED_ROUTE_GUARD',
      step1Tier: 'UNEXECUTED',
      boundarySource: 'docs/union-eyes/staging/UE_V2_BASE_PRODUCT_SCOPE_RECONCILIATION.json#stakeholderCensus.roleValues',
    }))
    rows.push(row({
      id: `FINANCE:role:${role.id}:finance-boundary`,
      actionId: 'C19',
      proofClass: 'finance-boundary',
      actorType: 'stored-role',
      actorId: role.id,
      actorScope: role.scope,
      capacity: role.group,
      resource: 'union-finance',
      lifecycleIds: ['L12'],
      expectedResult: 'DENY_FINANCE_AND_DUES_IMPLEMENTATION',
      presentation: 'DEPLOYED_ROUTE_GUARD',
      step1Tier: 'UNEXECUTED',
    }))
  }
  for (const preset of required(recon.operatingModelScope.presets)) {
    rows.push(row({
      id: `PRESET:${preset.id}`,
      actionId: 'C07',
      proofClass: 'operating-preset',
      actorType: 'operating-preset',
      actorId: preset.id,
      actorScope: 'REQUIRED',
      capacity: preset.id,
      resource: 'operating-model',
      lifecycleIds: ['L03'],
      expectedResult: 'PRESET_CHANGES_CAPACITY_NOT_RESOURCE_AUTHORITY',
      presentation: 'CONFIGURATION_AND_DENIAL',
      step1Tier: 'UNEXECUTED',
    }))
  }
  for (const variant of recon.operatingModelScope.crossCuttingVariants) {
    const deferred = variant.scope !== 'REQUIRED'
    rows.push(row({
      id: `VARIANT:${variant.id}`,
      actionId: deferred ? 'O09' : 'C10',
      proofClass: 'cross-cutting-variant',
      actorType: 'cross-cutting-variant',
      actorId: variant.id,
      actorScope: variant.scope,
      capacity: variant.id,
      resource: variant.id,
      lifecycleIds: [],
      expectedResult: deferred ? 'DEFERRED_NOT_A_PASS' : 'QUALIFY_PROTOCOL_OR_SCOPE_LIMIT_ON_THE_DEPLOYED_REVISION',
      presentation: 'API_AND_AUDIT',
      step1Tier: 'UNEXECUTED',
    }))
  }
  for (const stage of required(recon.stakeholderLifecycle.stages)) {
    rows.push(row({
      id: `LIFECYCLE:${stage.id}`,
      actionId: 'C22',
      proofClass: 'lifecycle-stage',
      actorType: 'lifecycle-stage',
      actorId: stage.id,
      actorScope: 'REQUIRED',
      capacity: stage.id,
      resource: stage.name ?? stage.title ?? stage.id,
      lifecycleIds: [stage.id],
      expectedResult: 'STAGE_QUALIFIED_ON_THE_DEPLOYED_REVISION_OR_EXPLICITLY_NOT_APPLICABLE_WITH_A_SOURCE_CITATION',
      presentation: 'JOURNEY_OR_API',
      step1Tier: 'UNEXECUTED',
    }))
  }
  rows.sort((a, b) => a.id.localeCompare(b.id))
  return rows
}

function pkg(entry) {
  return {
    status: 'PLANNED',
    engineeringComplete: false,
    stagingGo: 'HELD',
    productionGo: 'HELD',
    verificationExecutedInS200: false,
    ...entry,
  }
}

export function workPackages() {
  const plan = pkg({
    id: 'S2.00-PLAN',
    phase: 'S2.00',
    lane: 'INTEGRATION',
    title: 'Scope, evidence and dependency freeze',
    objective: 'Freeze the Step 2 denominator, coverage register, deployment conflict and acceptance contracts without authorizing implementation.',
    deliverables: [
      'docs/union-eyes/step2/UE_STEP2_MASTER_PLAN.md',
      'docs/union-eyes/step2/UE_STEP2_WORK_BREAKDOWN.json',
      'docs/union-eyes/step2/UE_STEP2_ACTION_AUTHORITY_MATRIX.json',
      'docs/union-eyes/step2/UE_STEP2_DEPLOYMENT_AND_DATA_PLAN.md',
      'docs/union-eyes/step2/UE_STEP2_ACCEPTANCE_REGISTER.json',
      'docs/union-eyes/step2/UE_STEP2_ADVERSARIAL_REVIEW.md',
      'docs/union-eyes/step2/UE_STEP2_EXECUTION_ORDER.md',
    ],
    dependencies: [],
    verificationCommands: ['node tooling/scripts/ue-step2-plan-validate.mjs'],
    acceptance: 'The validator exits 0. STEP_2_PLANNING_COMPLETE may be YES. STEP_2_ENGINEERING_COMPLETE and STEP_2_ACCEPTED stay NO.',
    status: 'PLANNING_ARTIFACT',
  })
  const later = [
    ['S2.01-INTEGRATE', 'S2.01', 'A', 'Normal integration of PR 1309', 'Merge only after founder approval. The merge commit is a new source and does not inherit b00a362 check runs.', ['S2.00-PLAN', 'FOUNDER_MERGE_APPROVAL'], 'gh pr view 1309 --json state,mergedAt,mergeCommit', 'PR 1309 is merged by the normal path. The merge commit is recorded. No staging apply is implied.'],
    ['S2.01-REQUALIFY', 'S2.01', 'A', 'Exact-head qualification of the merge commit', 'Run the required GitHub checks on the merge commit before any image is treated as the candidate.', ['S2.01-INTEGRATE'], 'The required workflows named in the execution order, on the merge SHA', 'Every required check on the merge SHA succeeded. Skipped main-only jobs are listed and are not counted as passes.'],
    ['S2.01-IMAGE', 'S2.01', 'A', 'Immutable application and scanner images', 'Build through .github/workflows/ue-v2-staging-build.yml and record registry digests.', ['S2.01-REQUALIFY'], '.github/workflows/ue-v2-staging-build.yml', 'Application, ClamAV adapter and cron image digests are attested to the merge SHA.'],
    ['S2.01-BIND', 'S2.01', 'A', 'Candidate source freeze', 'Rebind tooling/scripts/lib/ue-v2-staging-candidate.json from 6a60c95c to the merge SHA. Do not bind b00a362 while it is unmerged.', ['S2.01-IMAGE'], 'git diff on the candidate pin and the typed projection', 'The candidate pin, typed projection and release manifest name the same merge SHA. SQL statement count does not change unless a reviewed plan regeneration says so.'],
    ['S2.02-PREIMAGE', 'S2.02', 'A', 'Read-only staging and database preimage', 'Resolve the serving-SHA conflict with a fresh revision, traffic, image and database observation. Capture PostgreSQL version, migration history, owners, ACLs, RLS attributes, sequences and row counts.', ['S2.00-PLAN'], 'az containerapp revision list and a read-only catalog query. Neither command is run by S2.00.', 'A new evidence file names the command, time, revision, traffic weight, image digest and database catalog. Historical receipts are not reused as this observation.'],
    ['S2.02-LEGACY-GATE', 'S2.02', 'A', 'Released-topology applicability gate', 'Decide from the fresh preimage whether the four legacy installer cases must run before this transition.', ['S2.02-PREIMAGE'], 'The read-only function and event-trigger probe described in the deployment plan', 'If the preimage lacks current security topology, all four current-security-installer cases pass on authentic provenance before upgrade. If the preimage is already current topology, the four cases stay tracked and are not called passes. A current bootstrap is not substituted for a historical upgrade.'],
    ['S2.02-REHEARSAL', 'S2.02', 'A', 'Preserving upgrade rehearsal and rollback', 'Rehearse the data-preserving forward upgrade and a full transactional rollback on the staging preimage.', ['S2.02-LEGACY-GATE', 'S2.01-BIND'], '.github/workflows/ue-v2-staging-forward-upgrade.yml and .github/workflows/ue-v2-staging-rollback-rehearsal.yml', 'Row counts, sequences, migration history and unrelated ACLs match the preimage after rollback. A failed historical rehearsal is not reused.'],
    ['S2.02-FORWARD', 'S2.02', 'A', 'Forward recovery after a committed upgrade', 'Prove the upgraded database starts the candidate and that recovery proceeds forward rather than by deleting data.', ['S2.02-REHEARSAL'], 'The forward-upgrade workflow apply mode after a successful rehearsal', 'Original rows remain. Temporary privileges are gone. The candidate reaches its health check. No delete or truncate of business data is present in the evidence.'],
    ['S2.03-WHATIF', 'S2.03', 'A', 'No-delete infrastructure what-if', 'Run the staging deploy workflow in what-if mode and refuse deletes and drift.', ['S2.02-FORWARD', 'S2.01-BIND', 'FOUNDER_STAGING_APPLY_APPROVAL'], '.github/workflows/ue-v2-staging-deploy.yml what-if', 'The what-if artifact has no deletes. The reviewed fingerprint matches the apply-time what-if.'],
    ['S2.03-ZERO-TRAFFIC', 'S2.03', 'A', 'Zero-traffic candidate', 'Prepare the new revision at zero traffic while the current revision keeps 100 percent.', ['S2.03-WHATIF'], '.github/workflows/ue-v2-staging-deploy.yml', 'The new revision is healthy at 0 percent and the previously serving revision remains at 100 percent until promotion.'],
    ['S2.03-CUTOVER', 'S2.03', 'A', 'Controlled traffic cutover and readback', 'Shift traffic only after health, then read back source, image and revision.', ['S2.03-ZERO-TRAFFIC'], 'The promote step in ue-v2-staging-deploy.yml', 'Serving revision, image digest and source SHA match the bound candidate. STAGING_GO remains HELD until S2.08.'],
    ['S2.04-ENTRA', 'S2.04', 'B', 'Deployed Entra sessions and MFA', 'Exercise real staging identity sessions, MFA and session revocation on the serving revision.', ['S2.03-CUTOVER'], '.github/workflows/ue-v2-staging-real-session.yml', 'A real session starts and a revoked session is refused. Synthetic QA cookies are not this proof.'],
    ['S2.04-MEMBERSHIP', 'S2.04', 'B', 'Membership, role change and multiple organizations', 'Prove active membership, role change, organization selection and departure.', ['S2.04-ENTRA'], 'Deployed membership and organization journeys for the required families that own C05, C06 and C07', 'A role title without active membership is refused. A second organization does not inherit the first organization cases.'],
    ['S2.04-MANDATE', 'S2.04', 'B', 'Mandate, delegation, expiry, revocation and recusal', 'Prove resource authority that is separate from role title, including expiry and conflict.', ['S2.04-MEMBERSHIP'], 'Deployed mandate journeys for C07, C10 and C11', 'An expired, revoked, conflicted or missing mandate is refused. Office title does not replace the mandate.'],
    ['S2.04-EXTERNAL', 'S2.04', 'B', 'External and affiliated principal boundaries', 'Prove affiliated titles, employers, adverse parties and deferred counsel do not receive local case access.', ['S2.04-MANDATE'], 'The denial rows in the action-authority matrix', 'Every denial row for SA15, SA16, SA18, SA19, SA22 and the deferred external families is evidenced. Deferred families are not passes.'],
    ['S2.05-INVITE', 'S2.05', 'B', 'C01 through C04 on the serving revision', 'Qualify invitation, truthful provider status, reissue, revocation and organization-admin entry with negative cases.', ['S2.04-ENTRA'], 'Deployed invitation journeys plus the provider receipt for C02', 'Positive and negative results, readback and audit are stored. A queued message without provider truth does not pass C02.'],
    ['S2.05-ORG', 'S2.05', 'B', 'C05 through C07 on the serving revision', 'Qualify organization setup, membership lifecycle and multiple capacity.', ['S2.04-MEMBERSHIP'], 'Deployed organization and membership journeys', 'Persisted organization, membership and active-organization selection survive reload. Cross-organization reads fail.'],
    ['S2.05-CASE', 'S2.05', 'B', 'C08 through C12 on the serving revision', 'Qualify intake, assignment, supervision, handoff and member follow-through, including closure.', ['S2.04-MANDATE'], 'Deployed case journeys', 'An unassigned case is not visible to an executive title. Closure and handoff remove the prior actor access. Member follow-through stays on that member case.'],
    ['S2.05-ASSIGN', 'S2.05', 'B', 'C09 automatic workload and expertise', 'Qualify the automatic assignment criterion separately from a manual assign.', ['S2.05-CASE'], 'AUTOMATIC_WORKLOAD_EXPERTISE_ASSIGNMENT staging criterion', 'The serving revision assigns from workload and expertise rules. A manual assign is not substituted.'],
    ['S2.05-DOCS', 'S2.05', 'B', 'C13 through C15 on the serving revision', 'Qualify document journey, sealed export and OCR against private bytes.', ['S2.03-CUTOVER'], 'Deployed document, export and OCR journeys', 'Bytes match the stored object. A sealed export refuses the wrong actor. OCR does not bypass document authority. Local shard 4 is not this proof.'],
    ['S2.05-MAIL', 'S2.05', 'B', 'C16 and C17 on the serving revision', 'Qualify correspondence approval, dispatch and staff messaging.', ['S2.06-INBOX'], 'Deployed correspondence and message journeys', 'A draft is not reported as dispatched. The member does not see internal notes. The other organization is refused.'],
    ['S2.05-LEAD', 'S2.05', 'B', 'C18 and C19 on the serving revision', 'Qualify leadership indicators and organization administration without title bypass.', ['S2.04-MANDATE'], 'Deployed leadership and admin journeys', 'Indicators drill to a case only when the actor has that case authority. Admin audit operations read back the audit row.'],
    ['S2.05-PRIVACY', 'S2.05', 'B', 'C20 privacy requests', 'Qualify a privacy request through decision, readback and audit.', ['S2.04-ENTRA'], 'Deployed privacy-request journey', 'The request persists. An unauthorized actor is refused. Completion is not reported when the write or audit fails.'],
    ['S2.05-DEADLINE', 'S2.05', 'B', 'C21 connected deadlines', 'Qualify deadline creation, reminder and actor-specific visibility.', ['S2.06-WORKERS'], 'Deployed deadline journey and the reminder worker', 'A deadline is visible only to an authorized actor. A missed worker run is reported as missed.'],
    ['S2.05-RECOVERY', 'S2.05', 'B', 'C22 concurrency and recovery', 'Qualify conflict, retry, audit failure and recovery on the serving revision.', ['S2.03-CUTOVER'], 'Deployed concurrency and failure journeys', 'A failed audit is not returned as success. A retry does not create a second case. A conflict returns 409.'],
    ['S2.05-FINANCE', 'S2.05', 'B', 'Sensitive finance denial', 'Prove every required role is refused union finance and dues behavior.', ['S2.03-CUTOVER'], 'SENSITIVE_FINANCE_BOUNDARIES staging criterion', 'The deployed finance surface denies all 34 required roles. No financial transaction is created. Financial Officer 2.1 stays out of scope.'],
    ['S2.06-INBOX', 'S2.06', 'B', 'O01 controlled inbox and provider state', 'Prove recipient delivery, deduplication, retry and dead letter with a controlled inbox.', ['S2.03-CUTOVER'], 'A controlled-inbox run against the serving revision', 'Provider state is correlated to the audit row. A spoofed provider is refused. Absence of an inbox is an unexecuted proof.'],
    ['S2.06-WORKERS', 'S2.06', 'B', 'Workers, cron, retry and dead letter', 'Prove worker freshness and exactly-once handling for the required jobs.', ['S2.03-CUTOVER'], 'O06 on the serving revision', 'A stale worker is visible as stale. A retry does not double-apply. Dead letters are inspectable.'],
    ['S2.07-PERF', 'S2.07', 'C', 'O02 and O03 workload', 'Measure authenticated casework and the sustained pilot workload on the serving revision.', ['S2.03-CUTOVER'], 'The existing authenticated casework load harness pointed at the serving revision', 'Thresholds are the contract thresholds. A result from another SHA is not reused.'],
    ['S2.07-OPS', 'S2.07', 'C', 'Backup, audit seal, health, alerts and restore', 'Qualify O04, O05, O07, O08 and O15 from fresh operational evidence.', ['S2.03-CUTOVER'], 'Fresh backup, seal, health, alert and restore receipts', 'Each receipt names the serving revision. A missed backup or seal is not a pass.'],
    ['S2.07-UX', 'S2.07', 'C', 'O11 accessibility and O12 bilingual states', 'Qualify accessibility and English/French states on the serving revision, including a narrow viewport.', ['S2.03-CUTOVER'], 'Deployed EN/FR and accessibility journeys', 'O10 physical-device expansion stays deferred and is not counted. The Step 1 local browser matrix is not this proof.'],
    ['S2.07-TRUTH', 'S2.07', 'C', 'O13 registry truth and O14 telemetry', 'Qualify capability status and pilot telemetry against the serving revision.', ['S2.03-CUTOVER'], 'O13 and O14 on the serving revision', 'A route or navigation label is not a capability pass. Telemetry does not invent institutional adoption.'],
    ['S2.08-ADVERSARIAL', 'S2.08', 'INTEGRATION', 'Independent adversarial acceptance', 'Challenge security, privacy, authority, preservation and deployment integrity against the serving evidence.', ['S2.04-EXTERNAL', 'S2.05-INVITE', 'S2.05-ORG', 'S2.05-CASE', 'S2.05-ASSIGN', 'S2.05-DOCS', 'S2.05-MAIL', 'S2.05-LEAD', 'S2.05-PRIVACY', 'S2.05-DEADLINE', 'S2.05-RECOVERY', 'S2.05-FINANCE', 'S2.06-INBOX', 'S2.06-WORKERS', 'S2.07-PERF', 'S2.07-OPS', 'S2.07-UX', 'S2.07-TRUTH'], 'A new adversarial record bound to the serving SHA', 'Every material finding is fixed or disposed. No finding is closed by a different SHA.'],
    ['S2.08-CRITERIA', 'S2.08', 'INTEGRATION', 'Twenty staging criteria', 'Reconcile every required UE_STAGING_GO_CONTRACT criterion on the serving revision.', ['S2.08-ADVERSARIAL'], 'docs/union-eyes/staging/UE_STAGING_GO_CONTRACT.json', 'All 20 required criteria are PASS on the serving SHA. The advisory local-regression criterion is not one of the 20. This planning package does not mark them PASS.'],
  ]
  return [plan, ...later.map(([id, phase, lane, title, objective, dependencies, command, acceptance]) => pkg({
    id,
    phase,
    lane,
    title,
    objective,
    deliverables: [`Evidence cited by ${id} after execution. None is produced by S2.00.`],
    dependencies,
    verificationCommands: [command],
    acceptance,
  }))]
}

const EVIDENCE = [
  'docs/union-eyes/staging/UE_V2_BASE_PRODUCT_SCOPE_RECONCILIATION.json',
  'docs/union-eyes/staging/UE_V2_BASE_PRODUCT_SCOPE_SEMANTIC_REVIEW_20261117.json',
  'docs/union-eyes/staging/UE_V2_BASE_ACTION_COVERAGE.json',
  'docs/union-eyes/staging/UE_STAGING_GO_CONTRACT.json',
  'docs/union-eyes/staging/UE_V2_BASE_RELEASE_REMAINING_WORK.md',
  'docs/union-eyes/staging/UE_V2_PR1309_FINAL_ENGINEERING_CONVERGENCE.md',
  'docs/union-eyes/staging/evidence/ue-v2-forward-upgrade-20261122/persona-and-lifecycle-census.json',
  'docs/union-eyes/staging/evidence/ue-v2-forward-upgrade-20261122/operator-binding-6a60c95c.json',
  'docs/union-eyes/staging/evidence/ue-v2-forward-upgrade-20261122/document-family-remediation-20261123.json',
  'docs/union-eyes/staging/evidence/ue-v2-forward-upgrade-20261122/admitted-app-source-6a60c95c.json',
  'ops/change-records/CHG-2026-0114.founder-authorization.md',
  'docs/union-eyes/reality-remediation/26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md',
  'docs/union-eyes/reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md',
  'apps/union-eyes/lib/reality/capability-registry.ts',
  'tooling/scripts/lib/ue-v2-staging-candidate.json',
  'tooling/scripts/lib/ue-native-expected-skips.json',
  '.github/workflows/ue-v2-staging-deploy.yml',
  '.github/workflows/ue-v2-staging-build.yml',
  '.github/workflows/ue-v2-staging-forward-upgrade.yml',
  '.github/workflows/ue-v2-staging-rollback-rehearsal.yml',
]

export function buildPlan(root) {
  const { recon, coverage, go, candidate } = loadCanonical(root)
  const nodes = scopeNodes(recon)
  const families = recon.stakeholderCensus.stakeholderFamilies
  const roles = recon.stakeholderCensus.roleValues
  const actions = coverage.actions.map((action) => ({
    id: action.id,
    action: action.action,
    historicalLedgerState: action.state,
    classification: CLASSIFICATION[action.id].kind,
    step1EvidenceTier: CLASSIFICATION[action.id].tier,
    evidence: CLASSIFICATION[action.id].evidence,
    stakeholderIds: action.qualificationContract.stakeholderIds,
    entryPoints: action.qualificationContract.runtimeEntryPoints.map((entry) => entry.path),
    stagingAcceptance: 'UNEXECUTED',
  }))
  const operations = coverage.operations.map((operation) => ({
    id: operation.id,
    action: operation.action,
    scope: operation.scope,
    historicalLedgerState: operation.state,
    disposition: operation.scope === 'DEFERRED' ? 'DEFERRED_NOT_A_PASS' : 'REQUIRED_UNEXECUTED',
    stagingAcceptance: 'UNEXECUTED',
  }))
  const criteria = go.criteria.map((criterion) => ({
    id: criterion.id,
    requirement: criterion.requirement,
    historicalStatus: criterion.status,
    countsTowardRequired20: criterion.requirement === 'REQUIRED',
    step2Status: 'UNEXECUTED',
    packageId: criterion.requirement === 'REQUIRED' ? criteriaPackage(criterion.id) : null,
  }))
  return {
    register: {
      schemaVersion: PLANNING_SCHEMA,
      record: 'UE_STEP2_ACCEPTANCE_REGISTER',
      step2PlanningComplete: true,
      step2EngineeringComplete: false,
      step2Accepted: false,
      stagingGo: 'HELD',
      productionGo: 'HELD',
      ueSaasOperationalReadiness: 'NO_GO',
      fullReadiness: 'NOT_YET_PROVEN',
      phase3B: 'NOT_STARTED',
      financialOfficer21: 'OUT_OF_SCOPE',
      step1: {
        baselineSha: STEP1_BASELINE_SHA,
        pullRequest: STEP1_PR,
        state: 'DRAFT_OPEN_NOT_MERGED',
        step1EngineeringComplete: true,
        step1Accepted: true,
        acceptanceLocation: 'PR 1309 description for this exact SHA. The committed convergence record cannot name that later SHA.',
        merged: false,
        deployed: false,
      },
      main: {
        observedSha: '97cd90fb029af07dbfcbf4455c1068acfd6e1cb8',
        observedCommit: 'Merge pull request #1307',
        containsStep1Baseline: false,
        observation: 'git rev-parse origin/main and git merge-base --is-ancestor during S2.00. This is a repository observation, not an Azure observation.',
      },
      deploymentCandidatePin: {
        path: 'tooling/scripts/lib/ue-v2-staging-candidate.json',
        applicationSourceSha: candidate.applicationSourceSha,
        incompatibility: 'The deployment pin still names 6a60c95c. It does not name the accepted Step 1 head. S2.01-BIND moves it only after the merge commit exists.',
      },
      servingIdentity: {
        freshObservation: 'UNEXECUTED',
        resolution: 'CONFLICTED_HISTORICAL',
        receipts: [
          {
            path: 'docs/union-eyes/staging/evidence/ue-v2-forward-upgrade-20261122/operator-binding-6a60c95c.json',
            recordedAt: '2026-11-23T16:38:17.935777+00:00',
            servingSha: 'cccfc8c311a1017f80241bf089c00ef0c6828751',
            apply: 'NOT_LAUNCHED',
          },
          {
            path: 'docs/union-eyes/staging/UE_V2_BASE_RELEASE_REMAINING_WORK.md',
            servingSha: 'cccfc8c311a1017f80241bf089c00ef0c6828751',
            note: 'November 23 section says the D4 rehearsal failed and no apply was launched.',
          },
          {
            path: 'docs/union-eyes/staging/evidence/ue-v2-forward-upgrade-20261122/document-family-remediation-20261123.json',
            recordedAt: '2026-11-24T00:41:59.795884+00:00',
            servingSha: '6a60c95c9de17e9343e0414bb51766afbc190054',
            note: 'The field names 6a60c95c. The same object does not contain a revision name, traffic weight or command transcript.',
          },
        ],
        stopCondition: 'S2.02-PREIMAGE must replace this conflict with a fresh observation before any rehearsal or apply.',
      },
      legacyInstaller: {
        disposition: 'OUTSIDE_STEP_1_WITH_TRACKED_DEPENDENCY',
        step2Applicability: 'APPLICABLE_UNTIL_DISPROVEN',
        cases: 4,
        file: 'apps/union-eyes/db/__tests__/current-security-installer.native.test.ts',
        expectedSkips: 'tooling/scripts/lib/ue-native-expected-skips.json',
        owner: 'team-union-eyes-engineering@nzila.ai',
        notPasses: true,
        rule: 'Run all four cases before the staging transition only when the fresh preimage still has the released pre-current security topology. A current-schema bootstrap is not a substitute. If the preimage already has current topology, keep the cases tracked for a later restore of an older database and do not call them passes.',
      },
      denominators: denominatorReport(recon, nodes, criteria),
      actions,
      operations,
      criteria,
      scopeNodes: nodes,
      deferredNotPasses: [
        'O09', 'O10', 'PM05', 'SA02', 'SA14', 'SA17', 'SA20', 'SA21', 'SA26', 'SA27', 'SA32', 'SA35',
      ],
      excluded: coverage.excluded,
      evidencePaths: EVIDENCE,
      institutionalDecisions: [
        { id: 'ID-MERGE', state: 'REQUIRED_BEFORE_S2.01', decision: 'Founder approval to merge PR 1309.' },
        { id: 'ID-APPLY', state: 'REQUIRED_BEFORE_S2.03', decision: 'Founder approval to apply the bound candidate to staging. CHG-2026-0114 does not bind b00a362.' },
        { id: 'ID-SCOPE-BACKFILL', state: 'NOT_ISSUED', decision: 'No case-scope backfill or institutional mandate is authorized. UE-CAP-B-002 stays unadopted.' },
        { id: 'ID-FINANCE', state: 'EXCLUDED', decision: 'Union finance, dues persistence and Financial Officer 2.1 stay excluded.' },
        { id: 'ID-PHASE3B', state: 'NOT_STARTED', decision: 'Phase 3B stays closed while UE_SAAS_OPERATIONAL_READINESS is NO_GO.' },
      ],
      capabilityClasses: {
        implementedOnDisposableOrCiOnly: actions.filter((action) => action.classification === 'PARTIALLY_IMPLEMENTED').map((action) => action.id),
        sourcePresentRuntimeUnproven: actions.filter((action) => action.classification === 'SOURCE_PRESENT_RUNTIME_UNPROVEN').map((action) => action.id),
        blockedByInstitutionalAuthority: ['UE-CAP-B-002 case-scope backfill', 'Live customer mandate issuance'],
        infrastructureNotAUserPass: ['PostgreSQL RLS and physical guards', 'Bootstrap V2 catalog', 'Authority store'],
        presentationNotAPass: ['Seven navigation profiles: member, steward, chief_steward, officer, secretary_treasurer, admin, app_owner'],
        stagingEvidenceHistoricalAndConflicting: ['servingIdentity'],
        localAndCiEvidence: ['Step 1 PR 1309 checks on b00a362', 'Disposable browser and document journeys in the convergence record'],
        missingProductionLikeEvidence: ['Fresh staging revision readback', 'Deployed Entra session on the Step 1 head', 'Deployed C01-C22 and O01-O08, O11-O15'],
        externalDependencies: ['Azure Container Apps', 'Azure Container Registry', 'Azure PostgreSQL', 'Azure Cache for Redis', 'Azure Storage', 'Key Vault', 'Entra', 'ClamAV adapter', 'Email provider'],
        outsideStep2: ['Production', 'Phase 3B', 'Financial Officer 2.1', 'O09', 'O10', 'PM05', 'Certified elections and ratification', 'WorkAid activation'],
      },
      stakeholderCounts: {
        total: families.length,
        required: families.filter((item) => item.scope === 'REQUIRED').length,
        deferred: families.filter((item) => item.scope === 'DEFERRED').length,
      },
      roleCounts: {
        stored: roles.length,
        required: roles.filter((item) => item.scope === 'REQUIRED').length,
        excluded: roles.filter((item) => item.scope === 'EXCLUDED').length,
      },
    },
    matrix: {
      schemaVersion: PLANNING_SCHEMA,
      record: 'UE_STEP2_ACTION_AUTHORITY_MATRIX',
      authorityRule: 'A stored role is eligibility. Access requires authenticated identity, active organization membership, functional capacity and live resource authority. Title, seniority and affiliation do not grant local case access.',
      equivalence: 'Platform roles share one denial procedure but every required role id has its own row. Local union roles stay separate because the census says their positive duties differ. Deferred stakeholders are denials, not positive coverage.',
      rows: matrixRows(recon, coverage),
    },
    work: {
      schemaVersion: PLANNING_SCHEMA,
      record: 'UE_STEP2_WORK_BREAKDOWN',
      step2PlanningComplete: true,
      step2EngineeringComplete: false,
      step2Accepted: false,
      packages: workPackages(),
    },
  }
}

function criteriaPackage(id) {
  const map = {
    CANDIDATE_IDENTITY: 'S2.03-CUTOVER',
    SOURCE_ENGINEERING: 'S2.01-REQUALIFY',
    FINAL_CANDIDATE_CI: 'S2.01-REQUALIFY',
    AUTHORIZED_STAGING_DEPLOYMENT: 'S2.03-WHATIF',
    DEPLOYED_REVISION_IDENTITY: 'S2.03-CUTOVER',
    DATABASE_MIGRATIONS: 'S2.02-FORWARD',
    ENTRA_AUTHENTICATED_SESSIONS: 'S2.04-ENTRA',
    API_AND_POSTGRES_TENANT_ISOLATION: 'S2.02-PREIMAGE',
    BUSINESS_WORKFLOWS_AND_PERSONAS: 'S2.05-CASE',
    WORKERS_RETRIES_AND_DELIVERY: 'S2.06-WORKERS',
    AUDIT_AND_TELEMETRY: 'S2.07-TRUTH',
    DOCUMENT_REVOCATION_AND_PRIVACY: 'S2.05-DOCS',
    SENSITIVE_FINANCE_BOUNDARIES: 'S2.05-FINANCE',
    OPERATIONAL_RECOVERY: 'S2.07-OPS',
    CAPABILITY_TRUTHFULNESS: 'S2.07-TRUTH',
    INSTITUTIONAL_BOUNDARIES: 'S2.04-EXTERNAL',
    STAGING_DECISION_ACCEPTANCE: 'S2.08-CRITERIA',
    REPAIRED_ONBOARDING_ACTIONS: 'S2.05-INVITE',
    AUTOMATIC_WORKLOAD_EXPERTISE_ASSIGNMENT: 'S2.05-ASSIGN',
    BASE_ACTION_COVERAGE: 'S2.08-CRITERIA',
  }
  if (!map[id]) throw new Error(`No package for criterion ${id}`)
  return map[id]
}

function denominatorReport(recon, nodes, criteria) {
  const byInventory = {}
  for (const node of nodes) byInventory[node.inventory] = (byInventory[node.inventory] ?? 0) + 1
  return {
    functionalActionFamilies: 22,
    operationalFamiliesTotal: 15,
    operationalFamiliesRequired: 13,
    operationalFamiliesDeferred: 2,
    stakeholderFamiliesTotal: recon.stakeholderCensus.stakeholderFamilies.length,
    stakeholderFamiliesRequired: required(recon.stakeholderCensus.stakeholderFamilies).length,
    storedRoleValues: recon.stakeholderCensus.roleValues.length,
    requiredRoleBoundaries: required(recon.stakeholderCensus.roleValues).length,
    lifecycleStages: required(recon.stakeholderLifecycle.stages).length,
    operatingModelPresets: required(recon.operatingModelScope.presets).length,
    crossCuttingVariantsRequired: required(recon.operatingModelScope.crossCuttingVariants).length,
    crossCuttingVariantsDeferred: recon.operatingModelScope.crossCuttingVariants.filter((item) => item.scope === 'DEFERRED').length,
    requiredScopeNodes: nodes.length,
    requiredScopeNodesByInventory: byInventory,
    stagingCriteriaRequired: criteria.filter((item) => item.countsTowardRequired20).length,
    stagingCriteriaAdvisory: criteria.filter((item) => !item.countsTowardRequired20).length,
  }
}

export const PLAN_FILES = {
  register: 'docs/union-eyes/step2/UE_STEP2_ACCEPTANCE_REGISTER.json',
  matrix: 'docs/union-eyes/step2/UE_STEP2_ACTION_AUTHORITY_MATRIX.json',
  work: 'docs/union-eyes/step2/UE_STEP2_WORK_BREAKDOWN.json',
}
