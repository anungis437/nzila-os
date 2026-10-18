/**
 * @nzila/tool-fabric — governed gate
 *
 * The single entry point a future broker must call. It turns an UNTRUSTED
 * request into a policy decision by:
 *
 *   untrusted intent (identity + wish only)
 *     -> strict schema (no self-asserted authority / approval)
 *     -> trusted AgentAuthorityResolver -> ResolvedAgentAuthority
 *     -> GovernanceDecisionVerifier (per-request approval, if referenced)
 *     -> trust state replayed + integrity-checked from the ledger
 *     -> the tool's approving governance decision re-verified as still ACTIVE
 *     -> ToolPolicy
 *     -> audit (an audit failure denies the request)
 *
 * It never executes anything. Every failure path denies.
 */
import {
  AuthorityResolutionError,
  resolveAgentAuthority,
  toolExecutionIntentSchema,
  type AgentAuthorityResolver,
} from './authority'
import {
  GovernanceVerificationError,
  verifyGovernanceDecision,
  type GovernanceDecisionVerifier,
} from './governance'
import type { ToolTrustLedger } from './ledger'
import { ToolPolicy, type ToolPolicyOptions } from './policy'
import type { ToolProviderRegistry } from './providers'
import {
  scrubReason,
  summarizeIntentForAudit,
  type ToolAuditEvent,
  type ToolAuditSink,
} from './audit'
import type { PolicyDecision, ResolvedAgentAuthority, ToolInstallRequest, ToolRecord } from './types'
import type { VerifiedGovernanceDecision } from './governance'
import {
  authenticateInvocation, DenyInvocationAuthenticator,
  type InvocationAuthenticator,
} from './invocation'
import { canonicalJson, toolInstallRequestSchema } from './authority'

export interface GovernedToolGateDeps {
  readonly invocation?: InvocationAuthenticator
  readonly ledger: ToolTrustLedger
  readonly providers: ToolProviderRegistry
  readonly authority: AgentAuthorityResolver
  readonly governance: GovernanceDecisionVerifier
  readonly audit: ToolAuditSink
  readonly now?: () => Date
  readonly policy?: ToolPolicyOptions
}

export interface GateDecision extends PolicyDecision {
  readonly auditEntryId: string | null
  readonly policyEligible: boolean
  readonly executionAuthorized: false
  readonly installAuthorized: false
}

function denyReason(err: unknown, fallback: string): string {
  if (err instanceof AuthorityResolutionError || err instanceof GovernanceVerificationError) {
    return scrubReason(err.message)
  }
  return fallback
}

export class GovernedToolGate {
  private readonly now: () => Date

  constructor(private readonly deps: GovernedToolGateDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  async evaluateExecution(raw: unknown, hostContext?: unknown): Promise<GateDecision> {
    const summary = summarizeIntentForAudit(raw)
    const parsed = toolExecutionIntentSchema.safeParse(raw)
    const base: Pick<ToolAuditEvent, 'type' | 'correlationId' | 'requestingAgentId' | 'capability' | 'toolKey'> & typeof summary = {
      type: 'EXECUTION_POLICY',
      correlationId: parsed.success ? parsed.data.auditCorrelationId : readString(raw, 'auditCorrelationId') ?? 'unknown',
      requestingAgentId: parsed.success ? parsed.data.requestingAgentId : readString(raw, 'requestingAgentId'),
      capability: parsed.success ? parsed.data.capability : null,
      toolKey: parsed.success ? parsed.data.toolKey : null,
      ...summary,
    }
    const ctx: AuditContext = { trustStatus: null, suspension: null, toolDigest: null, trustDecisionRef: null, authority: null, approval: null }

    if (!parsed.success) {
      return this.finish(base, ctx, deny(base.correlationId, ['intent rejected: request does not match the strict intent schema']))
    }
    const intent = parsed.data
    let invocation
    try {
      invocation = await authenticateInvocation(
        this.deps.invocation ?? new DenyInvocationAuthenticator(), hostContext, this.now(),
      )
      ctx.authenticatedActor = {
        subject: invocation.subject, organizationId: invocation.organizationId,
        missionId: invocation.missionId, invocationRef: invocation.invocationRef, source: invocation.source,
      }
    } catch {
      return this.finish(base, ctx, deny(base.correlationId, ['INVOCATION_UNAUTHENTICATED']))
    }

    let authority: ResolvedAgentAuthority
    try {
      authority = await resolveAgentAuthority(this.deps.authority, intent.requestingAgentId, this.now())
      ctx.authority = { source: authority.source, authorityRef: authority.authorityRef, resolvedAt: authority.resolvedAt }
    } catch (err) {
      return this.finish(base, ctx, deny(base.correlationId, [denyReason(err, 'authority resolution failed')]))
    }

    let approval: VerifiedGovernanceDecision | null = null
    if (intent.approvalRef) {
      try {
        approval = await verifyGovernanceDecision(this.deps.governance, intent.approvalRef, this.now())
        ctx.approval = { decisionRef: approval.decisionRef, status: approval.status }
      } catch (err) {
        return this.finish(base, ctx, deny(base.correlationId, [denyReason(err, 'approval could not be verified')]))
      }
    }

    let record: ToolRecord | undefined
    let registry
    try {
      registry = await this.deps.ledger.load()
      record = registry.get(intent.toolKey)
    } catch {
      return this.finish(base, ctx, deny(base.correlationId, ['trust ledger unavailable or failed integrity verification']))
    }
    if (record) {
      ctx.trustStatus = record.status
      ctx.suspension = record.suspension?.kind ?? null
      ctx.toolDigest = record.descriptor.identity.digest ?? null
      const latest = record.decisions[record.decisions.length - 1]
      ctx.trustDecisionRef = latest?.governance.decisionRef ?? null
      if (latest && (record.status === 'APPROVED' || record.status === 'RESTRICTED')) {
        try {
          const current = await verifyGovernanceDecision(this.deps.governance, latest.governance.decisionRef, this.now())
          if (canonicalJson({ ...current, verifiedAt: null }) !==
              canonicalJson({ ...latest.governance, verifiedAt: null })) {
            return this.finish(base, ctx, deny(base.correlationId, ['TRUST_DECISION_REBOUND']))
          }
        } catch {
          return this.finish(base, ctx, deny(base.correlationId, ['the governance decision approving this tool is no longer active']))
        }
      }
    }

    let decision: ReturnType<ToolPolicy['evaluateExecution']>
    try {
      const policy = new ToolPolicy(registry, this.deps.providers, { now: this.now, ...this.deps.policy })
      decision = policy.evaluateExecution(intent, { authority, approval, invocation })
    } catch {
      decision = deny(base.correlationId, ['POLICY_EVALUATION_ERROR'])
    }
    return this.finish(base, ctx, decision)
  }

  /** Install evaluation for a governed installer; agents are always denied. */
  async evaluateInstall(input: unknown, installApprovalRef: string | null): Promise<GateDecision> {
    const parsed = toolInstallRequestSchema.safeParse(input)
    const req: ToolInstallRequest = parsed.success ? parsed.data : {
      requestedBy: { kind: 'AGENT', id: 'invalid' }, toolKey: 'invalid',
      digest: undefined, packageCoordinates: undefined, isolatedEnvironment: false,
      licenseAccepted: false, dependencyInspectionRef: undefined, auditCorrelationId: 'invalid',
    }
    const base = {
      type: 'INSTALL_POLICY' as const,
      correlationId: req.auditCorrelationId || 'unknown',
      requestingAgentId: req.requestedBy.kind === 'AGENT' ? req.requestedBy.id : null,
      capability: null,
      toolKey: req.toolKey,
      commandSha256: null,
      argCount: 0,
      argsSha256: null,
      envKeyCount: 0,
      secretRefCount: 0,
      sideEffects: [] as string[],
    }
    const ctx: AuditContext = { trustStatus: null, suspension: null, toolDigest: null, trustDecisionRef: null, authority: null, approval: null }

    let installApproval: VerifiedGovernanceDecision | null = null
    if (!parsed.success) {
      return this.finish(base, ctx, deny('invalid', ['INSTALL_AUTHORIZATION_CLOSED_INVALID_REQUEST']))
    }
    if (installApprovalRef) {
      try {
        installApproval = await verifyGovernanceDecision(this.deps.governance, installApprovalRef, this.now())
        ctx.approval = { decisionRef: installApproval.decisionRef, status: installApproval.status }
      } catch (err) {
        return this.finish(base, ctx, deny(base.correlationId, [denyReason(err, 'installation approval could not be verified')]))
      }
    }
    let registry
    try {
      registry = await this.deps.ledger.load()
    } catch {
      return this.finish(base, ctx, deny(base.correlationId, ['trust ledger unavailable or failed integrity verification']))
    }
    const record = registry.get(req.toolKey)
    if (record) {
      ctx.trustStatus = record.status
      ctx.suspension = record.suspension?.kind ?? null
      ctx.toolDigest = record.descriptor.identity.digest ?? null
      ctx.trustDecisionRef = record.decisions[record.decisions.length - 1]?.governance.decisionRef ?? null
    }
    const policy = new ToolPolicy(registry, this.deps.providers, { now: this.now, ...this.deps.policy })
    return this.finish(base, ctx, policy.evaluateInstall(req, { installApproval }))
  }

  private async finish(
    base: Omit<ToolAuditEvent, 'trustStatus' | 'suspension' | 'toolDigest' | 'trustDecisionRef' | 'authority' | 'approval' | 'outcome' | 'reasons'>,
    ctx: AuditContext,
    decision: PolicyDecision,
  ): Promise<GateDecision> {
    const event: ToolAuditEvent = {
      ...base,
      ...ctx,
      requestingAgentId: ctx.authenticatedActor?.subject ?? null,
      correlationId: /^[A-Za-z0-9][A-Za-z0-9:._/@-]{0,159}$/.test(base.correlationId) ? base.correlationId : 'invalid',
      toolKey: /^[A-Za-z0-9][A-Za-z0-9:._/@-]{0,159}$/.test(base.toolKey ?? '') ? base.toolKey : null,
      capability: /^[A-Za-z0-9][A-Za-z0-9:._/@-]{0,159}$/.test(base.capability ?? '') ? base.capability : null,
      outcome: 'DENIED',
      reasons: decision.allowed ? ['POLICY_ELIGIBLE_EXECUTION_CLOSED'] : ['POLICY_DENIED'],
    }
    try {
      const auditEntryId = await this.deps.audit.record(event)
      return {
        ...decision, allowed: false, brokerDirectives: null,
        policyEligible: decision.allowed, executionAuthorized: false, installAuthorized: false,
        reasons: decision.allowed ? ['POLICY_ELIGIBLE_EXECUTION_AUTHORIZATION_CLOSED'] : decision.reasons,
        auditEntryId,
      }
    } catch {
      return {
        allowed: false,
        reasons: ['audit record could not be written; request denied'],
        auditCorrelationId: decision.auditCorrelationId,
        brokerDirectives: null,
        auditEntryId: null,
        policyEligible: false,
        executionAuthorized: false,
        installAuthorized: false,
      }
    }
  }
}

interface AuditContext {
  authenticatedActor?: {
    subject: string; organizationId: string; missionId: string; invocationRef: string; source: string
  }
  trustStatus: string | null
  suspension: string | null
  toolDigest: string | null
  trustDecisionRef: string | null
  authority: ToolAuditEvent['authority']
  approval: ToolAuditEvent['approval']
}

function deny(correlationId: string, reasons: string[]): PolicyDecision {
  return { allowed: false, reasons, auditCorrelationId: correlationId, brokerDirectives: null }
}

function readString(raw: unknown, key: string): string | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = (raw as Record<string, unknown>)[key]
  return typeof v === 'string' && v.length > 0 ? v.slice(0, 120) : null
}
