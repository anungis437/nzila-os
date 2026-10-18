/**
 * @nzila/tool-fabric — install / execution policy (deny-by-default)
 *
 * Pure decision functions. There is deliberately no executor here: a future
 * broker must call these, apply `brokerDirectives`, and write the audit
 * record. Every `allowed: true` requires every check to pass.
 *
 * Authority and approval are never read from the request. The intent states
 * only identity and desired action; the caller supplies separately resolved
 * context, and runtime brand checks (not types) reject anything not minted by
 * the authority / governance modules.
 */
import {
  hashIntent,
  isResolvedAgentAuthority,
  toolExecutionIntentSchema,
  toolInstallRequestSchema,
  type ToolExecutionIntent,
} from './authority'
import { isVerifiedGovernanceDecision, type VerifiedGovernanceDecision } from './governance'
import type { ToolProviderRegistry } from './providers'
import type { ToolRegistry } from './registry'
import { isAuthenticatedInvocation, type AuthenticatedInvocation } from './invocation'
import {
  HIGH_RISK_SIDE_EFFECTS,
  type PolicyDecision,
  type ResolvedAgentAuthority,
  type ToolInstallRequest,
} from './types'

const SHELL_AND_INTERPRETERS = new Set([
  'sh', 'bash', 'zsh', 'fish', 'dash', 'ksh', 'csh',
  'cmd', 'cmd.exe', 'powershell', 'powershell.exe', 'pwsh', 'pwsh.exe',
  'python', 'python3', 'node', 'perl', 'ruby', 'pip', 'pip3', 'npm', 'npx', 'pnpm', 'uv',
  'env', 'sudo', 'su', 'curl', 'wget', 'ssh',
])

const BLOCKED_ENV_KEYS = new Set([
  'PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES', 'PYTHONPATH',
  'PYTHONSTARTUP', 'NODE_OPTIONS', 'PIP_INDEX_URL', 'PIP_EXTRA_INDEX_URL', 'HOME',
])
const SECRET_LIKE_ENV = /(SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|CREDENTIAL|PRIVATE_?KEY)/i
const ENV_KEY = /^[A-Z_][A-Z0-9_]*$/
const SECRET_REF = /^secretref:[a-z0-9][a-z0-9._/-]*$/i

export const DEFAULT_MAX_AUTHORITY_AGE_MS = 5 * 60 * 1000

export interface ToolPolicyOptions {
  readonly now?: () => Date
  /** Resolved authority older than this is stale and denied. */
  readonly maxAuthorityAgeMs?: number
}

export interface ExecutionPolicyContext {
  readonly invocation?: AuthenticatedInvocation | null
  /** Produced by resolveAgentAuthority(); anything else is denied. */
  readonly authority: ResolvedAgentAuthority | null
  /** Produced by verifyGovernanceDecision() for intent.approvalRef, if any. */
  readonly approval: VerifiedGovernanceDecision | null
}

export interface InstallPolicyContext {
  readonly installApproval: VerifiedGovernanceDecision | null
}

function normalizePath(p: string): string | null {
  if (!/^[\x20-\x7e]+$/.test(p) || /[%:*?"<>|]/.test(p.replace(/^[A-Za-z]:/, '')) ||
      /^[\\/]{2}/.test(p) || /^[A-Za-z]:[^\\/]/.test(p)) return null
  const unified = p.replace(/\\/g, '/').replace(/\/+/g, '/')
  const absolute = /^(?:[A-Za-z]:)?\//.test(unified)
  if (!absolute) return null
  if (unified.split('/').some((seg) => seg === '..' || seg === '.' || /[. ]$/.test(seg) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(seg))) return null
  const trimmed = unified.length > 1 ? unified.replace(/\/$/, '') : unified
  return /^[A-Za-z]:/.test(trimmed) ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1) : trimmed
}

function isFilesystemRoot(p: string): boolean {
  return p === '/' || /^[a-z]:(\/)?$/.test(p)
}

function within(path: string, roots: readonly string[]): boolean {
  return roots.some((r) => path === r || path.startsWith(`${r}/`))
}

export class ToolPolicy {
  private readonly now: () => Date
  private readonly maxAuthorityAgeMs: number

  constructor(
    private readonly tools: ToolRegistry,
    private readonly providers: ToolProviderRegistry,
    options: ToolPolicyOptions = {},
  ) {
    this.now = options.now ?? (() => new Date())
    this.maxAuthorityAgeMs = options.maxAuthorityAgeMs ?? DEFAULT_MAX_AUTHORITY_AGE_MS
  }

  evaluateInstall(input: unknown, ctx: InstallPolicyContext = { installApproval: null }): PolicyDecision {
    const parsed = toolInstallRequestSchema.safeParse(input)
    if (!parsed.success) return this.finish(['INSTALL_AUTHORIZATION_CLOSED_INVALID_REQUEST'], 'invalid', null)
    const req: ToolInstallRequest = parsed.data
    const reasons: string[] = ['INSTALL_AUTHORIZATION_CLOSED']
    if (!req.auditCorrelationId.trim()) reasons.push('missing audit correlation id')
    if (req.requestedBy.kind !== 'GOVERNED_INSTALLER') {
      reasons.push('fleet agents may not install tools; installation is a governed installer action')
    }
    const record = this.tools.get(req.toolKey)
    if (!record) {
      reasons.push('tool is not registered')
    } else {
      if (record.status !== 'APPROVED' && record.status !== 'RESTRICTED') {
        reasons.push(`tool trust status is ${record.status}; installation requires APPROVED or RESTRICTED`)
      }
      if (record.suspension) reasons.push(`tool is suspended (${record.suspension.kind})`)
      if (!req.digest || req.digest !== record.descriptor.identity.digest) {
        reasons.push('digest does not match the approved digest')
      }
      if (
        !req.packageCoordinates ||
        req.packageCoordinates !== record.descriptor.identity.packageCoordinates
      ) {
        reasons.push('package coordinates do not match the approved coordinates')
      }
      const a = ctx.installApproval
      if (!isVerifiedGovernanceDecision(a)) {
        reasons.push('installation requires a verified TOOL_INSTALL governance decision')
      } else {
        if (a.kind !== 'TOOL_INSTALL' || a.outcome !== 'APPROVE') reasons.push('governance decision does not authorise installation')
        if (a.subject !== req.toolKey) reasons.push('installation decision applies to a different tool')
        if (a.subjectDigest !== record.descriptor.identity.digest) reasons.push('installation decision is not bound to the approved digest')
        if (a.status !== 'ACTIVE') reasons.push(`installation decision is ${a.status}`)
      }
    }
    if (!req.isolatedEnvironment) reasons.push('installation requires an isolated environment')
    if (!req.licenseAccepted) reasons.push('licence has not been accepted')
    if (!req.dependencyInspectionRef?.trim()) reasons.push('dependency inspection record is required')

    return this.finish(reasons, req.auditCorrelationId, null)
  }

  /**
   * @param intentInput untrusted request; validated against a strict schema so
   *   self-asserted authority (e.g. `permittedCapabilities`) is rejected.
   */
  evaluateExecution(intentInput: unknown, ctx: ExecutionPolicyContext): PolicyDecision {
    const parsed = toolExecutionIntentSchema.safeParse(intentInput)
    if (!parsed.success) {
      return this.finish(
        ['intent rejected: bounded strict request schema mismatch'],
        'invalid',
        null,
      )
    }
    const req: ToolExecutionIntent = parsed.data
    const reasons: string[] = []
    const invocation = ctx.invocation
    if (!isAuthenticatedInvocation(invocation)) {
      return this.finish(['INVOCATION_UNAUTHENTICATED'], req.auditCorrelationId, null)
    }
    if (invocation.subject !== req.requestingAgentId || invocation.organizationId !== req.organizationId ||
        invocation.missionId !== req.missionId || invocation.invocationRef !== req.invocationRef ||
        invocation.status !== 'ACTIVE' || Date.parse(invocation.expiresAt) <= this.now().getTime()) {
      return this.finish(['INVOCATION_BINDING_MISMATCH_OR_STALE'], req.auditCorrelationId, null)
    }
    if (!req.auditCorrelationId.trim()) reasons.push('missing audit correlation id')

    // Authority: must be a runtime-minted resolution for exactly this agent.
    const authority = ctx.authority
    if (!isResolvedAgentAuthority(authority)) {
      reasons.push('no trusted authority resolution for the requesting agent')
      return this.finish(reasons, req.auditCorrelationId, null)
    }
    if (authority.agentId !== req.requestingAgentId) {
      reasons.push('requesting agent does not match the resolved authority')
      return this.finish(reasons, req.auditCorrelationId, null)
    }
    if (authority.organizationId !== req.organizationId || authority.missionId !== req.missionId ||
        authority.authorityRef !== req.authorityRef || authority.status !== 'ACTIVE' ||
        !authority.expiresAt || Date.parse(authority.expiresAt) <= this.now().getTime()) {
      return this.finish(['AUTHORITY_SCOPE_REVOKED_OR_STALE'], req.auditCorrelationId, null)
    }
    const age = this.now().getTime() - new Date(authority.resolvedAt).getTime()
    if (!(age >= -1000 && age <= this.maxAuthorityAgeMs)) {
      reasons.push('resolved authority is stale')
      return this.finish(reasons, req.auditCorrelationId, null)
    }

    const record = this.tools.get(req.toolKey)
    if (!record) {
      reasons.push('tool is not registered')
      return this.finish(reasons, req.auditCorrelationId, null)
    }
    if (record.status !== 'APPROVED' && record.status !== 'RESTRICTED') {
      reasons.push(`tool trust status is ${record.status}; execution requires APPROVED or RESTRICTED`)
      return this.finish(reasons, req.auditCorrelationId, null)
    }
    if (record.suspension) {
      reasons.push(`tool is suspended pending a new trust decision (${record.suspension.kind})`)
      return this.finish(reasons, req.auditCorrelationId, null)
    }
    const grant = record.grant
    if (!grant) {
      reasons.push('tool has no grant')
      return this.finish(reasons, req.auditCorrelationId, null)
    }
    const trustDecision = record.decisions[record.decisions.length - 1]?.governance
    if (trustDecision?.organizationId !== req.organizationId || trustDecision?.missionId !== req.missionId) {
      reasons.push('TRUST_DECISION_SCOPE_MISMATCH')
    }
    if (req.artifactDigest !== record.descriptor.identity.digest) reasons.push('ARTIFACT_DIGEST_MISMATCH')

    // Capability binding: platform authority AND tool grant.
    if (!authority.capabilities.includes(req.capability)) {
      reasons.push('requesting agent is not authorised for this capability')
    }
    if (!grant.allowedAgents.includes(req.requestingAgentId)) {
      reasons.push('requesting agent is not granted this tool')
    }
    if (!grant.allowedCapabilities.includes(req.capability)) {
      reasons.push('capability is not granted for this tool')
    }

    // Command.
    const cmdBase = req.command.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''
    if (SHELL_AND_INTERPRETERS.has(cmdBase) ||
        /^(?:python[\d.]*|node|perl|ruby|deno|bun|busybox|env|xargs|eval|exec)(?:\.exe)?$/.test(cmdBase) ||
        /\.(?:bat|cmd|ps1|py|js|mjs|cjs|sh)$/.test(cmdBase)) {
      reasons.push('shells, interpreters and installers are not executable tools')
    }
    if (!grant.allowedCommands.includes(req.command)) reasons.push('command is not granted')
    const commands = record.descriptor.commands.filter((c) => c.name === req.command)
    if (commands.length !== 1) {
      return this.finish(['COMMAND_UNKNOWN_OR_AMBIGUOUS'], req.auditCorrelationId, null)
    }
    const declared = commands[0]!.sideEffects
    if (declared.some((effect) => !record.descriptor.declaredSideEffects.includes(effect))) {
      reasons.push('COMMAND_EFFECT_METADATA_CONTRADICTORY')
    }
    if (declared.some((effect) => !req.sideEffects.includes(effect))) reasons.push('COMMAND_EFFECTS_OMITTED')
    const effectiveEffects = [...new Set([...declared, ...req.sideEffects])]
    if (req.args.some((a) => a.includes('\0'))) reasons.push('arguments contain NUL')

    // Filesystem.
    const roots = req.allowedFilesystemRoots.map(normalizePath)
    if (roots.length === 0 || roots.some((r) => r === null || isFilesystemRoot(r))) {
      reasons.push('allowed filesystem roots must be explicit, absolute, normalised and not a filesystem root')
    }
    const cleanRoots = roots.filter((r): r is string => r !== null)
    const trustedRoots = (grant.allowedFilesystemRoots ?? []).map(normalizePath)
      .filter((r): r is string => r !== null && !isFilesystemRoot(r))
    const missionRoots = (authority.filesystemRoots ?? []).map(normalizePath)
      .filter((r): r is string => r !== null && !isFilesystemRoot(r))
    if (!cleanRoots.length || cleanRoots.some((r) => !within(r, trustedRoots) || !within(r, missionRoots))) {
      reasons.push('FILESYSTEM_SCOPE_NOT_GRANTED_BY_MISSION')
    }
    const cwd = normalizePath(req.workingDirectory)
    if (cwd === null || !within(cwd, cleanRoots)) {
      reasons.push('working directory is outside the allowed filesystem roots')
    }
    for (const out of req.expectedOutputs) {
      const p = normalizePath(out)
      if (p === null || !within(p, cleanRoots)) reasons.push(`expected output "${out}" is outside the allowed roots`)
    }

    // Network.
    const wantsNetwork = req.network !== 'NONE' || effectiveEffects.includes('NETWORK_ACCESS') || req.networkDestinations.length > 0
    if (wantsNetwork) {
      reasons.push('NETWORK_ENFORCEMENT_UNPROVEN_CLOSED')
      if (!grant.allowNetwork) reasons.push('network access is not granted')
      if (req.network === 'NONE') reasons.push('network side effect declared but network policy is NONE')
    }

    // Environment and secrets.
    const forced = this.providers.forcedEnvFor(record.descriptor.identity.providerId)
    for (const k of Object.keys(req.env.allow)) {
      if (!grant.allowedEnv?.[k]?.includes(req.env.allow[k]!)) reasons.push('ENVIRONMENT_NOT_EXPLICITLY_GRANTED')
      if (!ENV_KEY.test(k)) reasons.push(`env key "${k}" is malformed`)
      else if (BLOCKED_ENV_KEYS.has(k)) reasons.push(`env key "${k}" is blocked`)
      else if (SECRET_LIKE_ENV.test(k)) reasons.push(`env key "${k}" looks like a secret; use secret references`)
      else if (k in forced) reasons.push(`env key "${k}" is broker-controlled`)
    }
    for (const ref of req.secretRefs) {
      if (!SECRET_REF.test(ref)) reasons.push(`secret reference "${ref}" is malformed`)
      else if (!grant.allowedSecretRefs.includes(ref)) reasons.push(`secret reference "${ref}" is not granted`)
    }
    if (req.secretRefs.length > 0 && !req.sideEffects.includes('CREDENTIAL_ACCESS')) {
      reasons.push('secret references require CREDENTIAL_ACCESS to be declared')
    }

    // Side effects.
    for (const s of effectiveEffects) {
      if (!grant.allowedSideEffects.includes(s)) reasons.push(`side effect ${s} is not granted`)
    }

    // Per-request approval: a verified decision bound to exactly this intent.
    const needsApproval =
      record.status === 'RESTRICTED' || effectiveEffects.some((s) => HIGH_RISK_SIDE_EFFECTS.includes(s))
    if (needsApproval) {
      const a = ctx.approval
      if (!isVerifiedGovernanceDecision(a)) {
        reasons.push('per-request approval is required and no verified approval was supplied')
      } else {
        if (a.kind !== 'TOOL_EXECUTION_APPROVAL' || a.outcome !== 'APPROVE') {
          reasons.push('governance decision does not approve this execution')
        }
        if (a.status !== 'ACTIVE') reasons.push(`approval is ${a.status}`)
        if (!req.approvalRef || a.decisionRef !== req.approvalRef) reasons.push('APPROVAL_REFERENCE_MISMATCH')
        if (a.subject !== req.toolKey) reasons.push('approval applies to a different tool')
        if (a.subjectDigest !== record.descriptor.identity.digest) reasons.push('approval is not bound to the approved digest')
        if (a.organizationId !== req.organizationId || a.missionId !== req.missionId ||
            a.actorId !== invocation.subject || a.nonce !== req.nonce || a.decisionVersion !== 2 ||
            !a.validUntil || !a.boundIntentHash) reasons.push('APPROVAL_SCOPE_OR_VERSION_MISMATCH')
        const participants = [a.actorId, a.authorId, a.reviewerId, a.approverId]
        if (participants.some((participant) => !participant) || new Set(participants).size !== 4 ||
            a.decidedByRole !== 'tool-execution-approver') {
          reasons.push('APPROVAL_SEPARATION_OF_DUTIES_REQUIRED')
        }
        if (a.boundIntentHash !== hashIntent(req)) reasons.push('approval is not bound to this intent')
        if (a.validUntil && new Date(a.validUntil).getTime() <= this.now().getTime()) reasons.push('approval has expired')
      }
    }

    // Limits.
    if (!(req.timeoutMs > 0)) reasons.push('timeout must be positive')
    else if (req.timeoutMs > grant.maxTimeoutMs) reasons.push('timeout exceeds the granted maximum')
    for (const key of ['cpuMs', 'memoryBytes', 'diskBytes', 'outputBytes', 'processes'] as const) {
      const limit = grant.resourceLimits?.[key]
      if (!limit || req.resources[key] > limit) reasons.push('RESOURCE_LIMIT_NOT_GRANTED')
    }

    return this.finish(reasons, req.auditCorrelationId, {
      forcedEnv: forced,
      network: req.network,
    })
  }

  private finish(
    reasons: string[],
    auditCorrelationId: string,
    directives: PolicyDecision['brokerDirectives'],
  ): PolicyDecision {
    if (reasons.length > 0) {
      return { allowed: false, reasons, auditCorrelationId, brokerDirectives: null }
    }
    return { allowed: true, reasons: ['all policy checks passed'], auditCorrelationId, brokerDirectives: directives }
  }
}
