/**
 * @nzila/tool-fabric — install / execution policy (deny-by-default)
 *
 * Pure decision functions. There is deliberately no executor here: a future
 * broker must call these, apply `brokerDirectives`, and write the audit
 * record. Every `allowed: true` requires every check to pass.
 */
import { HIGH_RISK_SIDE_EFFECTS, type PolicyDecision, type ToolExecutionRequest, type ToolInstallRequest } from './types'
import type { ToolProviderRegistry } from './providers'
import type { ToolRegistry } from './registry'

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

function normalizePath(p: string): string | null {
  if (p.includes('\0')) return null
  const unified = p.replace(/\\/g, '/').replace(/\/+/g, '/')
  const absolute = /^(?:[A-Za-z]:)?\//.test(unified)
  if (!absolute) return null
  if (unified.split('/').some((seg) => seg === '..' || seg === '.')) return null
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
  constructor(
    private readonly tools: ToolRegistry,
    private readonly providers: ToolProviderRegistry,
  ) {}

  evaluateInstall(req: ToolInstallRequest): PolicyDecision {
    const reasons: string[] = []
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
      if (!req.digest || req.digest !== record.descriptor.identity.digest) {
        reasons.push('digest does not match the approved digest')
      }
      if (
        !req.packageCoordinates ||
        req.packageCoordinates !== record.descriptor.identity.packageCoordinates
      ) {
        reasons.push('package coordinates do not match the approved coordinates')
      }
    }
    if (!req.isolatedEnvironment) reasons.push('installation requires an isolated environment')
    if (!req.licenseAccepted) reasons.push('licence has not been accepted')
    if (!req.dependencyInspectionRef?.trim()) reasons.push('dependency inspection record is required')

    return this.finish(reasons, req.auditCorrelationId, null)
  }

  evaluateExecution(req: ToolExecutionRequest): PolicyDecision {
    const reasons: string[] = []
    if (!req.auditCorrelationId.trim()) reasons.push('missing audit correlation id')

    const record = this.tools.get(req.toolKey)
    if (!record) {
      reasons.push('tool is not registered')
      return this.finish(reasons, req.auditCorrelationId, null)
    }
    if (record.status !== 'APPROVED' && record.status !== 'RESTRICTED') {
      reasons.push(`tool trust status is ${record.status}; execution requires APPROVED or RESTRICTED`)
      return this.finish(reasons, req.auditCorrelationId, null)
    }
    const grant = record.grant
    if (!grant) {
      reasons.push('tool has no grant')
      return this.finish(reasons, req.auditCorrelationId, null)
    }

    // Agent authority and capability binding.
    if (!req.requestedBy.permittedCapabilities.includes(req.capability)) {
      reasons.push('requesting agent is not authorised for this capability')
    }
    if (!grant.allowedAgents.includes(req.requestedBy.agentId)) {
      reasons.push('requesting agent is not granted this tool')
    }
    if (!grant.allowedCapabilities.includes(req.capability)) {
      reasons.push('capability is not granted for this tool')
    }

    // Command.
    const cmdBase = req.command.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''
    if (SHELL_AND_INTERPRETERS.has(cmdBase)) reasons.push('shells, interpreters and installers are not executable tools')
    if (!grant.allowedCommands.includes(req.command)) reasons.push('command is not granted')
    if (req.args.some((a) => a.includes('\0'))) reasons.push('arguments contain NUL')

    // Filesystem.
    const roots = req.allowedFilesystemRoots.map(normalizePath)
    if (roots.length === 0 || roots.some((r) => r === null || isFilesystemRoot(r))) {
      reasons.push('allowed filesystem roots must be explicit, absolute, normalised and not a filesystem root')
    }
    const cleanRoots = roots.filter((r): r is string => r !== null)
    const cwd = normalizePath(req.workingDirectory)
    if (cwd === null || !within(cwd, cleanRoots)) {
      reasons.push('working directory is outside the allowed filesystem roots')
    }
    for (const out of req.expectedOutputs) {
      const p = normalizePath(out)
      if (p === null || !within(p, cleanRoots)) reasons.push(`expected output "${out}" is outside the allowed roots`)
    }

    // Network.
    const wantsNetwork = req.network !== 'NONE' || req.sideEffects.includes('NETWORK_ACCESS')
    if (wantsNetwork) {
      if (!grant.allowNetwork) reasons.push('network access is not granted')
      if (req.network === 'NONE') reasons.push('network side effect declared but network policy is NONE')
    }

    // Environment and secrets.
    const forced = this.providers.forcedEnvFor(record.descriptor.identity.providerId)
    for (const [k] of Object.entries(req.env.allow)) {
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

    // Side effects and approval.
    for (const s of req.sideEffects) {
      if (!grant.allowedSideEffects.includes(s)) reasons.push(`side effect ${s} is not granted`)
    }
    const needsApproval =
      record.status === 'RESTRICTED' || req.sideEffects.some((s) => HIGH_RISK_SIDE_EFFECTS.includes(s))
    if (needsApproval && req.approvalState !== 'APPROVED') {
      reasons.push('per-request approval is required and has not been given')
    }
    if (req.approvalState === 'DENIED') reasons.push('request approval was denied')

    // Limits.
    if (!(req.timeoutMs > 0)) reasons.push('timeout must be positive')
    else if (req.timeoutMs > grant.maxTimeoutMs) reasons.push('timeout exceeds the granted maximum')

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
