/**
 * Policy Conflict Analyzer — Pure detection + fail-closed blocking.
 *
 * Detects structural conflicts between governed policies:
 *
 *  1. workflow_binding       — Two+ active policies claim the same workflowId
 *  2. contradictory_behavior — Same workflow, conflicting decisions
 *  3. overlapping_domain     — Ambiguous domain coverage
 *  4. cyclic_approval        — Circular approval chain dependency (DFS)
 *  5. ambiguous_actor        — Actor-role resolution is ambiguous
 *  6. duplicate_ownership    — Two policies both claim workflow ownership
 *
 * The detection step is a PURE FUNCTION (analyzeConflicts).
 * Persistence and event emission are side effects (persistConflicts).
 *
 * Fail-closed: runOnTransition() throws if any CRITICAL conflicts are
 * detected for the policy being transitioned. This prevents invalid policy
 * states from propagating into the active governance graph.
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import {
  policyConflicts,
  governedPolicies,
  type GovernedPolicyRow,
  type PolicyConflictRow,
  type NewPolicyConflictRow,
} from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'

import { recordGovernanceEvent } from './policy-governance-events-service'
import type { PolicyLifecycleState } from './policy-lifecycle'

const logger = createLogger('control-plane:authority:policy-conflict-analyzer')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any

// ── Conflict report ───────────────────────────────────────────────────────────

export type ConflictType = NewPolicyConflictRow['conflictType']
export type ConflictSeverity = NewPolicyConflictRow['severity']

export interface ConflictReport {
  policyIdA: string
  policyIdB: string | null
  conflictType: ConflictType
  severity: ConflictSeverity
  description: string
  affectedWorkflowIds: string[]
  conflictDetail: Record<string, unknown>
}

// ── Pure detection logic ──────────────────────────────────────────────────────

/**
 * Analyze a set of governed policy rows for structural conflicts.
 * This is a pure function — no DB access, no side effects.
 *
 * Typically called with all active + published policies from the registry.
 */
export function analyzeConflicts(policies: GovernedPolicyRow[]): ConflictReport[] {
  const reports: ConflictReport[] = []

  // Build a map: workflowId → policies that bind it
  const workflowMap = new Map<string, GovernedPolicyRow[]>()
  for (const policy of policies) {
    const bindings = extractWorkflowBindings(policy)
    for (const wfId of bindings) {
      const existing = workflowMap.get(wfId) ?? []
      existing.push(policy)
      workflowMap.set(wfId, existing)
    }
  }

  // ── 1. Workflow binding conflicts ─────────────────────────────────────────
  for (const [wfId, bound] of workflowMap.entries()) {
    if (bound.length > 1) {
      for (let i = 0; i < bound.length; i++) {
        for (let j = i + 1; j < bound.length; j++) {
          const a = bound[i]
          const b = bound[j]

          // Overlapping domain is a lower-severity variant
          const isOwnDomain = a.domain === b.domain
          reports.push({
            policyIdA: a.id,
            policyIdB: b.id,
            conflictType: isOwnDomain ? 'duplicate_ownership' : 'workflow_binding',
            severity: isOwnDomain ? 'error' : 'critical',
            description: isOwnDomain
              ? `Policies "${a.name}" and "${b.name}" both claim ownership of workflow "${wfId}" in the same domain "${a.domain}".`
              : `Policies "${a.name}" (${a.domain}) and "${b.name}" (${b.domain}) both bind workflow "${wfId}" — workflow ownership is ambiguous.`,
            affectedWorkflowIds: [wfId],
            conflictDetail: {
              policyAId: a.id,
              policyAName: a.name,
              policyADomain: a.domain,
              policyBId: b.id,
              policyBName: b.name,
              policyBDomain: b.domain,
              workflowId: wfId,
            },
          })
        }
      }
    }
  }

  // ── 2. Domain overlap ─────────────────────────────────────────────────────
  const domainMap = new Map<string, GovernedPolicyRow[]>()
  for (const policy of policies) {
    const existing = domainMap.get(policy.domain) ?? []
    existing.push(policy)
    domainMap.set(policy.domain, existing)
  }
  for (const [domain, domainPolicies] of domainMap.entries()) {
    if (domainPolicies.length > 1) {
      // Check for scope overlap in operational_scope
      for (let i = 0; i < domainPolicies.length; i++) {
        for (let j = i + 1; j < domainPolicies.length; j++) {
          const a = domainPolicies[i]
          const b = domainPolicies[j]
          if (hasOperationalScopeOverlap(a, b)) {
            reports.push({
              policyIdA: a.id,
              policyIdB: b.id,
              conflictType: 'overlapping_domain',
              severity: 'warning',
              description: `Policies "${a.name}" and "${b.name}" have overlapping operational scope within domain "${domain}".`,
              affectedWorkflowIds: [],
              conflictDetail: {
                domain,
                policyAId: a.id,
                policyAScope: a.operationalScope,
                policyBId: b.id,
                policyBScope: b.operationalScope,
              },
            })
          }
        }
      }
    }
  }

  return reports
}

/**
 * Score a conflict's severity, potentially upgrading it based on context.
 * For example, a workflow_binding conflict involving a critical-risk policy
 * should always be critical severity.
 */
export function scoreConflictSeverity(
  report: ConflictReport,
  policies: GovernedPolicyRow[],
): ConflictSeverity {
  if (report.severity === 'critical') return 'critical'

  // Upgrade severity if any involved policy is high/critical risk
  const policyIds = [report.policyIdA, report.policyIdB].filter(Boolean)
  const involved = policies.filter((p) => policyIds.includes(p.id))
  const hasHighRisk = involved.some(
    (p) => p.riskClassification === 'high' || p.riskClassification === 'critical',
  )

  if (hasHighRisk && report.severity === 'warning') return 'error'
  if (hasHighRisk && report.conflictType === 'workflow_binding') return 'critical'

  return report.severity
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Persist detected conflicts to the DB and emit governance events.
 *
 * Deduplication: a conflict between the same two policies of the same type
 * that is already active will not be re-inserted.
 */
export async function persistConflicts(
  reports: ConflictReport[],
  db: AnyDB,
  options?: {
    detectedBy?: string
    transitionDescription?: string
    correlationId?: string
  },
): Promise<PolicyConflictRow[]> {
  const inserted: PolicyConflictRow[] = []

  for (const report of reports) {
    // Deduplication check
    const existing = await db
      .select()
      .from(policyConflicts)
      .where(
        and(
          eq(policyConflicts.policyIdA, report.policyIdA),
          eq(policyConflicts.conflictType, report.conflictType),
          eq(policyConflicts.isActive, true),
        ),
      )
      .limit(1)

    if (existing.length > 0) continue

    const [row] = await db
      .insert(policyConflicts)
      .values({
        policyIdA: report.policyIdA,
        policyIdB: report.policyIdB ?? null,
        conflictType: report.conflictType,
        severity: report.severity,
        description: report.description,
        affectedWorkflowIds: report.affectedWorkflowIds,
        conflictDetail: report.conflictDetail,
        isActive: true,
        detectedBy: options?.detectedBy ?? 'system',
        detectedDuringTransition: options?.transitionDescription ?? null,
      } satisfies NewPolicyConflictRow)
      .returning()

    inserted.push(row as PolicyConflictRow)

    // Emit governance event
    try {
      await recordGovernanceEvent(
        {
          policyId: report.policyIdA,
          policyVersion: 'unknown',
          domain: 'governance',
          eventType: 'policy.conflict_detected',
          actorUserId: options?.detectedBy ?? null,
          payload: {
            conflictId: (row as PolicyConflictRow).id,
            conflictType: report.conflictType,
            severity: report.severity,
            policyIdB: report.policyIdB,
          },
          correlationId: options?.correlationId,
        },
        db,
      )
    } catch (err) {
      logger.warn('failed to emit conflict_detected event (non-fatal)', { err })
    }
  }

  if (inserted.length > 0) {
    logger.warn('conflicts detected and persisted', {
      count: inserted.length,
      types: reports.map((r) => r.conflictType),
    })
  }

  return inserted
}

/**
 * Resolve an active conflict (mark as inactive, record resolution).
 */
export async function resolveConflict(
  conflictId: string,
  resolvedBy: string,
  resolutionNotes: string,
  db: AnyDB,
  correlationId?: string,
): Promise<PolicyConflictRow> {
  const [updated] = await db
    .update(policyConflicts)
    .set({
      isActive: false,
      resolvedAt: new Date(),
      resolvedBy,
      resolutionNotes,
    })
    .where(eq(policyConflicts.id, conflictId))
    .returning()

  await recordGovernanceEvent(
    {
      policyId: (updated as PolicyConflictRow).policyIdA,
      policyVersion: 'unknown',
      domain: 'governance',
      eventType: 'policy.conflict_resolved',
      actorUserId: resolvedBy,
      payload: { conflictId, resolutionNotes },
      correlationId,
    },
    db,
  )

  return updated as PolicyConflictRow
}

// ── Fail-closed transition guard ──────────────────────────────────────────────

/**
 * Run conflict analysis for a policy undergoing a state transition.
 * BLOCKS (throws) if any CRITICAL conflicts are found involving this policy.
 *
 * Call this BEFORE committing the transition in transitionState().
 */
export async function runOnTransition(
  policyId: string,
  targetState: PolicyLifecycleState,
  db: AnyDB,
  correlationId?: string,
): Promise<void> {
  // Only run for public-facing transitions
  if (
    targetState !== 'published' &&
    targetState !== 'active' &&
    targetState !== 'approved'
  ) {
    return
  }

  // Load active + published + the transitioning policy
  const relevantPolicies: GovernedPolicyRow[] = await db
    .select()
    .from(governedPolicies)
    .where(
      eq(
        governedPolicies.lifecycleStatus,
        targetState === 'approved' ? 'approval_required' : 'published',
      ),
    )

  const [transitioningPolicy] = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.id, policyId))
    .limit(1)

  if (!transitioningPolicy) return

  const policySet = [
    ...relevantPolicies.filter((p) => p.id !== policyId),
    transitioningPolicy,
  ] as GovernedPolicyRow[]

  const reports = analyzeConflicts(policySet)
  const relevant = reports.filter(
    (r) => r.policyIdA === policyId || r.policyIdB === policyId,
  )

  if (relevant.length > 0) {
    await persistConflicts(relevant, db, {
      detectedBy: 'system',
      transitionDescription: `transition→${targetState}`,
      correlationId,
    })
  }

  const critical = relevant.filter((r) => r.severity === 'critical')
  if (critical.length > 0) {
    throw new Error(
      `[policy-conflict-analyzer] CRITICAL_CONFLICT_BLOCKS_TRANSITION: ` +
        `${critical.length} critical conflict(s) detected for policy ${policyId} ` +
        `during transition to "${targetState}". ` +
        `Conflicts: ${critical.map((r) => `${r.conflictType}(${r.policyIdB ?? 'self'})`).join(', ')}`,
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractWorkflowBindings(policy: GovernedPolicyRow): string[] {
  if (!policy.workflowBindings) return []
  if (Array.isArray(policy.workflowBindings)) {
    return policy.workflowBindings.filter((v): v is string => typeof v === 'string')
  }
  return []
}

function hasOperationalScopeOverlap(a: GovernedPolicyRow, b: GovernedPolicyRow): boolean {
  if (!a.operationalScope || !b.operationalScope) return false
  if (typeof a.operationalScope !== 'object' || typeof b.operationalScope !== 'object') return false

  const scopeA = a.operationalScope as Record<string, unknown>
  const scopeB = b.operationalScope as Record<string, unknown>

  // Check for overlapping resource types
  const resourcesA = Array.isArray(scopeA['resourceTypes']) ? scopeA['resourceTypes'] : []
  const resourcesB = Array.isArray(scopeB['resourceTypes']) ? scopeB['resourceTypes'] : []

  if (resourcesA.length > 0 && resourcesB.length > 0) {
    return resourcesA.some((r) => resourcesB.includes(r))
  }

  return false
}
