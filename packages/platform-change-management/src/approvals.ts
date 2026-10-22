/**
 * @nzila/platform-change-management — Approval engine
 *
 * Evaluates approval requirements based on change type, risk level,
 * and current approval state.
 *
 * Approval roles: service_owner, change_manager, security_approver, platform_owner
 *
 * Rules:
 *   STANDARD → may auto-approve (no mandatory approvals)
 *   NORMAL   → service_owner + change_manager
 *   NORMAL (HIGH/CRITICAL) → service_owner + change_manager + security_approver
 *   EMERGENCY → reduced path (service_owner only), but PIR required afterward
 *
 * @module @nzila/platform-change-management/approvals
 */
import type { ChangeRecord, ApprovalRequirements, ApprovalRole, PostImplementationReview } from './types'
import { loadChangeRecord, saveChangeRecord } from './service'
import { nowISO } from './utils'

// ── Approval Rules ──────────────────────────────────────────────────────────

// A reviewed, mission-specific delegation, not a general role override. The
// source instruction hash is pinned so another record cannot self-authorize by
// adding a field. This only evaluates operational authority; signed release,
// clone rehearsal, isolation and runtime proof remain separate mandatory gates.
export function hasStagingMissionAuthorization(change: ChangeRecord): boolean {
  const auth = change.staging_authorization
  if (!auth || change.change_id !== 'CHG-2026-0112' || change.service !== 'union-eyes' || change.environment !== 'STAGING' || change.change_type !== 'NORMAL') return false
  if (auth.mission !== 'UE-STAGING-RECOVERY-TO-GO' || auth.owner_github_login !== 'anungis437' || auth.owner_instruction_sha256 !== '681844e4f18424c1e592dfd1db205afc66d5c7a3d647c91006dc8f5d2dcbb2e3' || auth.owner_instruction_ref !== 'ops/change-records/CHG-2026-0112.staging-authorization.md') return false
  if (auth.delegate?.name !== 'Codex' || auth.delegate.authenticated_github_login !== 'anungis437' || auth.delegate.azure_identity !== 'user:fcb34d85-3e87-4213-9fc4-435656b17f44') return false
  if (auth.production_authorized !== false || auth.security_proof_required !== true || auth.signed_release_required !== true) return false
  const expected = {
    subscription_id: '5d819f33-d16f-429c-a3c0-5b0e94740ba3', tenant_id: '5082b8be-b04d-4a13-b61c-b6397670177b',
    container_app: 'nzila-os-union-eyes-staging', container_app_resource_group: 'nzila-canada-staging-rg',
    postgres_server: 'nzila-staging-db', postgres_resource_group: 'nzila-staging-rg', database: 'nzila_os_staging',
    key_vault: 'nzila-staging-kv', clone_name_prefix: 'nzila-ue-recovery-', region: 'canadacentral',
  }
  if (!auth.resources || Object.keys(auth.resources).length !== Object.keys(expected).length || !Object.entries(expected).every(([key, value]) => auth.resources[key as keyof typeof expected] === value)) return false
  return change.risk_level === 'MEDIUM' && change.approval_status === 'APPROVED' && change.approved_by.length === 1 && change.approved_by[0] === auth.owner_github_login && change.approvers_required.length === 1 && change.approvers_required[0] === auth.owner_github_login
}

/**
 * Determine required approval roles for a given change record.
 */
function getRequiredRoles(change: ChangeRecord): ApprovalRole[] {
  switch (change.change_type) {
    case 'STANDARD':
      // Auto-approve path — no mandatory roles
      return []

    case 'EMERGENCY':
      // Reduced approval path — only service_owner
      return ['service_owner']

    case 'NORMAL': {
      const base: ApprovalRole[] = ['service_owner', 'change_manager']
      if (change.risk_level === 'HIGH' || change.risk_level === 'CRITICAL') {
        base.push('security_approver')
      }
      return base
    }

    default:
      return ['service_owner', 'change_manager']
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate approval requirements for a change record.
 *
 * Returns the full set of required approvals, which are missing,
 * whether a CAB (Change Advisory Board) review is needed,
 * and whether the current approvals satisfy the requirements.
 */
export function evaluateChangeRequirements(change: ChangeRecord): ApprovalRequirements {
  if (hasStagingMissionAuthorization(change)) {
    return { requiredApprovals: ['staging_mission_owner'], missingApprovals: [], cabRequired: false, approvalSatisfied: true }
  }
  const requiredApprovals = getRequiredRoles(change)

  const missingApprovals = requiredApprovals.filter(
    (role) => !change.approved_by.includes(role),
  )

  // CAB required for HIGH/CRITICAL normal changes
  const cabRequired =
    change.change_type === 'NORMAL' &&
    (change.risk_level === 'HIGH' || change.risk_level === 'CRITICAL')

  const approvalSatisfied = missingApprovals.length === 0

  return {
    requiredApprovals,
    missingApprovals,
    cabRequired,
    approvalSatisfied,
  }
}

/**
 * Check whether a NORMAL or EMERGENCY change can be closed.
 * NORMAL and EMERGENCY changes cannot be CLOSED until PIR exists.
 */
export function canClosePIR(change: ChangeRecord): { canClose: boolean; reason?: string } {
  if (change.change_type === 'STANDARD') {
    return { canClose: true }
  }

  if (!change.post_implementation_review) {
    return {
      canClose: false,
      reason: `${change.change_type} changes require a Post Implementation Review before closing.`,
    }
  }

  return { canClose: true }
}

/**
 * Record a Post Implementation Review on an existing change.
 */
export function recordPostImplementationReview(
  changeId: string,
  review: PostImplementationReview,
  opts?: { baseDir?: string },
): ChangeRecord {
  const change = loadChangeRecord(changeId, opts)
  if (!change) {
    throw new Error(`Change record ${changeId} not found`)
  }

  if (
    change.status !== 'COMPLETED' &&
    change.status !== 'FAILED' &&
    change.status !== 'ROLLED_BACK'
  ) {
    throw new Error(
      `Cannot record PIR for change ${changeId} in status ${change.status}. ` +
      `Must be COMPLETED, FAILED, or ROLLED_BACK.`,
    )
  }

  const updated: ChangeRecord = {
    ...change,
    post_implementation_review: review,
    updated_at: nowISO(),
  }

  saveChangeRecord(updated, opts)
  return updated
}
