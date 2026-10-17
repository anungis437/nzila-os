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

export interface GovernedToolGateDeps {
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

  async evaluateExecution(raw: unknown): Promise<GateDecision> {
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
          await verifyGovernanceDecision(this.deps.governance, latest.governance.decisionRef, this.now())
        } catch {
          return this.finish(base, ctx, deny(base.correlationId, ['the governance decision approving this tool is no longer active']))
        }
      }
    }

    const policy = new ToolPolicy(registry, this.deps.providers, { now: this.now, ...this.deps.policy })
    return this.finish(base, ctx, policy.evaluateExecution(intent, { authority, approval }))
  }

  /** Install evaluation for a governed installer; agents are always denied. */
  async evaluateInstall(req: ToolInstallRequest, installApprovalRef: string | null): Promise<GateDecision> {
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
      outcome: decision.allowed ? 'ALLOWED' : 'DENIED',
      reasons: decision.reasons,
    }
    try {
      const auditEntryId = await this.deps.audit.record(event)
      return { ...decision, auditEntryId }
    } catch {
      return {
        allowed: false,
        reasons: ['audit record could not be written; request denied'],
        auditCorrelationId: decision.auditCorrelationId,
        brokerDirectives: null,
        auditEntryId: null,
      }
    }
  }
}

interface AuditContext {
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
