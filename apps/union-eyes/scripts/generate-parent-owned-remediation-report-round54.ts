#!/usr/bin/env tsx
/**
 * scripts/generate-parent-owned-remediation-report-round54.ts
 *
 * PR #752 round 54 (FINAL_NON_VOTING_PARENT_OWNED_AUTHORITY_CONVERGENCE):
 * durable, advisory-only remediation record for the 14 non-voting
 * PARENT_OWNED NEEDS_REVIEW tables (votes/voting_options frozen for a
 * dedicated future election-integrity round).
 *
 * This script NEVER rewrites the manifest. Every table's
 * `finalManifestClassification` field reflects the ACTUAL
 * db/rls-storage-authority/*.ts disposition applied this round.
 *
 * Usage: tsx scripts/generate-parent-owned-remediation-report-round54.ts
 * Output: reports/union-eyes-parent-owned-remediation-round54.{json,md}
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const APP_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(APP_ROOT, '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

type WorkingLane =
  | 'RESOLVED_PARENT_READY'
  | 'CONTAINED_DEAD_CODE'
  | 'ARCHITECTURAL_REDESIGN'
  | 'UNRESOLVED_DIRECT_PARENT'

interface RemediatedChild {
  table: string
  directParent: string | null
  resolvedRoot: string | null
  workingLane: WorkingLane
  finalManifestClassification: string
  invocationAuthority: string
  dbExecutionPrincipal: string
  djangoDisposition: string
  concreteDefectFixed: string | null
  residualBlocker: string | null
  status: 'CLOSED' | 'CARRIED_FORWARD'
}

// prettier-ignore
const CHILDREN: RemediatedChild[] = [
  { table: 'newsletter_list_subscribers', directParent: 'newsletterDistributionLists (CLOSED round 45)', resolvedRoot: null, workingLane: 'ARCHITECTURAL_REDESIGN', finalManifestClassification: 'NEEDS_REVIEW', invocationAuthority: 'TBD', dbExecutionPrincipal: 'TBD', djangoDisposition: 'Already DenyAllPermission since round 47, reverified unchanged', concreteDefectFixed: null, residualBlocker: 'crud-factory itemRoute mismatch: the URL\u2019s [id] segment is the distribution LIST id, but itemRoute treats params.id as a SUBSCRIBER id \u2014 GET/PATCH/DELETE can never match a real row (fails closed, not a live vulnerability, but requires a genuine route-shape product decision to fix)', status: 'CARRIED_FORWARD' },
  { table: 'document_signers', directParent: 'signatureDocuments (CLOSED round 45, TENANT_RLS_REQUIRED)', resolvedRoot: 'organizations', workingLane: 'RESOLVED_PARENT_READY', finalManifestClassification: 'PARENT_OWNED_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'Already CONTAINED (Round40DenyAllPermission) since round 45, reverified unchanged', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'ai_safety_filters', directParent: 'chatSessions (CLOSED round 45, TENANT_RLS_REQUIRED)', resolvedRoot: 'organizations', workingLane: 'RESOLVED_PARENT_READY', finalManifestClassification: 'PARENT_OWNED_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'Was IsAuthenticated-only, queryset=Model.objects.all() \u2014 contained via DenyAllPermission', concreteDefectFixed: 'checkContentSafety() inserted flagged-content audit rows without the already-available sessionId, leaving every row untraceable to its tenant/session \u2014 fixed to stamp sessionId on every flagged insert', residualBlocker: null, status: 'CLOSED' },
  { table: 'mobile_sync_queue', directParent: null, resolvedRoot: null, workingLane: 'CONTAINED_DEAD_CODE', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'Was IsAuthenticated-only, queryset=Model.objects.all() despite a real org_id column \u2014 contained via DenyAllPermission', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'address_change_history', directParent: 'internationalAddresses', resolvedRoot: null, workingLane: 'CONTAINED_DEAD_CODE', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'Was IsAuthenticated-only, full ModelViewSet CRUD, queryset=Model.objects.all() \u2014 contained via DenyAllPermission (same pattern as sibling AddressValidationCacheViewSet, round 51)', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'alert_executions', directParent: 'alertRules (CLOSED round 46, TENANT_RLS_REQUIRED, MIXED authority)', resolvedRoot: 'organizations', workingLane: 'RESOLVED_PARENT_READY', finalManifestClassification: 'PARENT_OWNED_RLS_REQUIRED', invocationAuthority: 'MIXED', dbExecutionPrincipal: 'MIXED', djangoDisposition: 'No Django ViewSet exists for this table', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'award_history', directParent: 'awardTemplates (CLOSED this round, BLOCKER_ROOT_MICRO_COHORT)', resolvedRoot: null, workingLane: 'CONTAINED_DEAD_CODE', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'Was IsAuthenticated-only, full ModelViewSet CRUD \u2014 contained via DenyAllPermission', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'clause_library_tags', directParent: 'sharedClauseLibrary (still NEEDS_REVIEW)', resolvedRoot: null, workingLane: 'UNRESOLVED_DIRECT_PARENT', finalManifestClassification: 'NEEDS_REVIEW', invocationAuthority: 'TBD', dbExecutionPrincipal: 'TBD', djangoDisposition: 'No Django ViewSet exists for this table', concreteDefectFixed: null, residualBlocker: 'Direct parent sharedClauseLibrary is a deliberate cross-union sharing feature (sharingLevel + sharedWithOrgIds), not an ordinary tenant boundary \u2014 verifying its 6 real routes correctly enforce sharing-level access control is a genuine architecture review, disqualified from the bounded one-hop BLOCKER_ROOT_MICRO_COHORT', status: 'CARRIED_FORWARD' },
  { table: 'contract_line_items', directParent: 'commercialContracts (CLOSED this round, BLOCKER_ROOT_MICRO_COHORT)', resolvedRoot: 'organizations', workingLane: 'RESOLVED_PARENT_READY', finalManifestClassification: 'PARENT_OWNED_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'No Django ViewSet exists for this table', concreteDefectFixed: 'app/api/contracts/[id]/clauses/route.ts passed the URL contract id straight to getContractLineItems(contractId) with zero organization verification \u2014 a live cross-org IDOR letting any authenticated member read another organization\u2019s contract pricing/feature/SLA data; fixed to verify contract ownership before returning line items (fail-closed empty array on mismatch)', residualBlocker: null, status: 'CLOSED' },
  { table: 'firewall_access_rules', directParent: null, resolvedRoot: null, workingLane: 'CONTAINED_DEAD_CODE', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'Dedicated EmployerNonInterferenceServiceViewSet.check_access already CONTAINED round 49; a SEPARATE generated ModelViewSet (backend/compliance/views.py) was still IsAuthenticated-only \u2014 contained via DenyAllPermission this round', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'firewall_violations', directParent: null, resolvedRoot: null, workingLane: 'CONTAINED_DEAD_CODE', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'Dedicated EmployerNonInterferenceServiceViewSet.report_violation already CONTAINED round 49; a SEPARATE generated ModelViewSet (backend/compliance/views.py) was still IsAuthenticated-only, exposing every org\u2019s violation user_id/email/IP \u2014 contained via DenyAllPermission this round', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'push_deliveries', directParent: 'pushNotifications + pushDevices (both CLOSED round 46, TENANT_RLS_REQUIRED)', resolvedRoot: null, workingLane: 'CONTAINED_DEAD_CODE', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'Was IsAuthenticated-only \u2014 contained via DenyAllPermission', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'signature_verification', directParent: 'signatureWorkflows + signers (both still NEEDS_REVIEW, moot given dead-code reachability)', resolvedRoot: null, workingLane: 'CONTAINED_DEAD_CODE', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'Was IsAuthenticated-only \u2014 contained via DenyAllPermission (same pattern as sibling SignatureAuditLogViewSet, round 49)', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'signers', directParent: 'signatureWorkflows (still NEEDS_REVIEW, moot given dead-code reachability)', resolvedRoot: null, workingLane: 'CONTAINED_DEAD_CODE', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'Was IsAuthenticated-only \u2014 contained via DenyAllPermission', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
]

interface BlockerRoot {
  root: string
  childrenBlocked: string[]
  startClassification: string
  authorityModel: string
  finalClassification: string
  childrenUnlocked: number
}

const BLOCKER_ROOTS: BlockerRoot[] = [
  { root: 'award_templates', childrenBlocked: ['award_history'], startClassification: 'NEEDS_REVIEW', authorityModel: 'Nullable/unenforced organizationId; dead TS code (lib/services/rewards/template-service.ts has zero real callers)', finalClassification: 'CONTAINED_NO_AUTHORITY', childrenUnlocked: 1 },
  { root: 'commercial_contracts', childrenBlocked: ['contract_line_items'], startClassification: 'NEEDS_REVIEW', authorityModel: 'organization_id NOT NULL; MIXED tenant/platform-admin invocation across 3 verified real routes', finalClassification: 'TENANT_RLS_REQUIRED', childrenUnlocked: 1 },
]

const FINANCE_FROZEN_EXCEPTIONS = [
  'contribution_rates',
  'currency_enforcement_audit',
  'fx_rate_audit_log',
  't106_filing_tracking',
  'bank_of_canada_rates',
  'currency_enforcement_policy',
  'currency_enforcement_violations',
  'transaction_currency_conversions',
  'transfer_pricing_documentation',
  'fee_settlement_batches',
]

const ROUND53_RESIDUAL_BLOCKERS = [
  'ai_budgets: broken historical RLS policy DDL referencing nonexistent auth.user_id() (round-35 finding, not re-litigated)',
  'reports: ReportExecutor dynamic SQL generation not independently injection-audited',
  'sso_providers: oidcClientSecret plaintext credential storage (CREDENTIAL_STORAGE_MODEL_UNRESOLVED)',
]

function main() {
  const closed = CHILDREN.filter((t) => t.status === 'CLOSED')
  const carriedForward = CHILDREN.filter((t) => t.status === 'CARRIED_FORWARD')
  const concreteDefects = CHILDREN.filter((t) => t.concreteDefectFixed !== null)

  const summary = {
    generatedAt: new Date().toISOString(),
    round: 54,
    mission: 'FINAL_NON_VOTING_PARENT_OWNED_AUTHORITY_CONVERGENCE',
    startSha: '0ec64999fff2529ccd42456a48480f8c18bbd9f5',
    parentOwnedNeedsReviewStartCount: 16,
    votingFrozenCount: 2,
    nonVotingActiveCount: 14,
    parentOwnedNeedsReviewEndCount: carriedForward.length + 2,
    childrenClosedCount: closed.length,
    childrenCarriedForwardCount: carriedForward.length,
    concreteDefectsFixedCount: concreteDefects.length,
    blockerRoots: BLOCKER_ROOTS,
    votingFreeze: 'PRESERVED — votes and voting_options untouched (manifest, runtime, schema, Django, reasoning all unchanged)',
    financeFrozenExceptions: FINANCE_FROZEN_EXCEPTIONS,
    financeFreezeStatus: 'PRESERVED — none of these 10 tables, their manifest classifications, or their runtime principal architecture were touched this round',
    round53ResidualBlockers: ROUND53_RESIDUAL_BLOCKERS,
    round53ResidualBlockerStatus: 'UNCHANGED — carried forward in the programme blocker register, not remediated this round',
    children: CHILDREN,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'union-eyes-parent-owned-remediation-round54.json'), JSON.stringify(summary, null, 2))

  const md: string[] = []
  md.push('# Union Eyes Parent-Owned Authority Remediation Report (round 54)')
  md.push('')
  md.push(`Generated: ${summary.generatedAt}`)
  md.push('')
  md.push('Advisory only -- does not rewrite the manifest. See db/rls-storage-authority/*.ts for the authoritative classification of each table.')
  md.push('')
  md.push('This report closes 12 of the 14 non-voting PARENT_OWNED NEEDS_REVIEW tables deferred since round 41 (2 carried forward with explicit architecture blockers), plus 2 direct-parent BLOCKER_ROOT_MICRO_COHORT closures. votes/voting_options remain the only intended parent-owned exception lane, frozen for a dedicated future election-integrity round.')
  md.push('')
  md.push(`Parent-owned NEEDS_REVIEW: ${summary.parentOwnedNeedsReviewStartCount} (14 active + 2 voting-frozen) -> ${summary.parentOwnedNeedsReviewEndCount} (${carriedForward.length} carried forward + 2 voting-frozen)`)
  md.push('')
  md.push('## 14-child disposition matrix')
  md.push('')
  md.push('| Table | Direct parent | Working lane | Final classification | Invocation | DB principal | Concrete defect fixed | Residual blocker | Status |')
  md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const t of CHILDREN) {
    md.push(`| ${t.table} | ${t.directParent ?? '(none / no security-relevant parent)'} | ${t.workingLane} | ${t.finalManifestClassification} | ${t.invocationAuthority} | ${t.dbExecutionPrincipal} | ${t.concreteDefectFixed ?? '(none)'} | ${t.residualBlocker ?? '(none)'} | ${t.status} |`)
  }
  md.push('')
  md.push('## Blocker-root micro-cohort (bounded, one-hop)')
  md.push('')
  md.push('| Root | Children blocked | Start classification | Authority model | Final classification | Children unlocked |')
  md.push('| --- | --- | --- | --- | --- | --- |')
  for (const r of BLOCKER_ROOTS) {
    md.push(`| ${r.root} | ${r.childrenBlocked.join(', ')} | ${r.startClassification} | ${r.authorityModel} | ${r.finalClassification} | ${r.childrenUnlocked} |`)
  }
  md.push('')
  md.push('## Voting freeze (must remain PRESERVED)')
  md.push('')
  md.push(summary.votingFreeze)
  md.push('')
  md.push('## Finance freeze (must remain PRESERVED)')
  md.push('')
  md.push(summary.financeFreezeStatus)
  md.push('')
  for (const f of FINANCE_FROZEN_EXCEPTIONS) md.push(`- ${f}`)
  md.push('')
  md.push('## Round-53 residual blockers (unchanged, carried forward)')
  md.push('')
  for (const b of ROUND53_RESIDUAL_BLOCKERS) md.push(`- ${b}`)
  md.push('')

  writeFileSync(resolve(OUT_DIR, 'union-eyes-parent-owned-remediation-round54.md'), md.join('\n'))

  console.log(`Children closed: ${closed.length} / ${CHILDREN.length}`)
  console.log(`Children carried forward: ${carriedForward.length}`)
  console.log(`Blocker roots closed: ${BLOCKER_ROOTS.length}`)
  console.log(`Concrete defects fixed: ${summary.concreteDefectsFixedCount}`)
  console.log(`Parent-owned NEEDS_REVIEW: ${summary.parentOwnedNeedsReviewStartCount} -> ${summary.parentOwnedNeedsReviewEndCount}`)
  console.log('Report written to reports/union-eyes-parent-owned-remediation-round54.{json,md}')
}

main()
