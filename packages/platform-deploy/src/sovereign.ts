/**
 * Nzila OS — Sovereign Egress Controls
 *
 * Enforces strict egress allowlist when the active deployment profile is
 * sovereign.  Every outbound HTTP request initiated by integrations or
 * webhooks is validated against a pre-approved hostname list.
 *
 * @module @nzila/platform-deploy/sovereign
 */
import { z } from 'zod'

// ── Schemas ─────────────────────────────────────────────────────────────────

export const EgressRuleSchema = z.object({
  /** Hostname (e.g. "api.stripe.com") */
  host: z.string().min(1),
  /** Optional port restriction (default: unknown) */
  port: z.number().int().positive().optional(),
  /** Reason documented for auditing */
  reason: z.string().min(1),
  /** Who approved this entry */
  approvedBy: z.string().optional(),
  /** ISO date of approval */
  approvedAt: z.string().optional(),
})

export type EgressRule = z.infer<typeof EgressRuleSchema>

export const EgressAllowlistSchema = z.object({
  enforced: z.boolean(),
  rules: z.array(EgressRuleSchema),
})

export type EgressAllowlist = z.infer<typeof EgressAllowlistSchema>

// ── Egress Check ────────────────────────────────────────────────────────────

export interface EgressCheckResult {
  allowed: boolean
  host: string
  port: number | undefined
  matchedRule: EgressRule | null
  reason: string
}

/**
 * Check whether a target host:port is permitted under the current allowlist.
 */
export function checkEgress(
  host: string,
  port: number | undefined,
  allowlist: EgressAllowlist,
): EgressCheckResult {
  if (!allowlist.enforced) {
    return {
      allowed: true,
      host,
      port,
      matchedRule: null,
      reason: 'Egress allowlist not enforced',
    }
  }

  const normalizedHost = host.toLowerCase().trim()

  const matched = allowlist.rules.find((rule) => {
    const ruleHost = rule.host.toLowerCase().trim()

    // Exact match
    if (ruleHost === normalizedHost) {
      // If rule has port restriction, check it
      if (rule.port !== undefined && port !== undefined && rule.port !== port) {
        return false
      }
      return true
    }

    // Wildcard subdomain match (e.g. "*.stripe.com")
    if (ruleHost.startsWith('*.')) {
      const domain = ruleHost.slice(2)
      if (normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)) {
        if (rule.port !== undefined && port !== undefined && rule.port !== port) {
          return false
        }
        return true
      }
    }

    return false
  })

  if (matched) {
    return {
      allowed: true,
      host,
      port,
      matchedRule: matched,
      reason: `Matched rule: ${matched.host} — ${matched.reason}`,
    }
  }

  return {
    allowed: false,
    host,
    port,
    matchedRule: null,
    reason: `Host "${host}" is not in the egress allowlist`,
  }
}

// ── Egress Audit Log (in-memory for proof pack) ─────────────────────────────

export interface EgressAuditEntry {
  host: string
  port: number | undefined
  allowed: boolean
  reason: string
  timestamp: string
  correlationId?: string
}

const egressAuditLog: EgressAuditEntry[] = []
const MAX_AUDIT_LOG = 2000

/**
 * Record an egress check for audit/proof-pack purposes.
 */
export function recordEgressCheck(
  result: EgressCheckResult,
  correlationId?: string,
): void {
  if (egressAuditLog.length >= MAX_AUDIT_LOG) {
    egressAuditLog.splice(0, egressAuditLog.length - MAX_AUDIT_LOG + 100)
  }

  egressAuditLog.push({
    host: result.host,
    port: result.port,
    allowed: result.allowed,
    reason: result.reason,
    timestamp: new Date().toISOString(),
    correlationId,
  })
}

/**
 * Retrieve the egress audit log (for proof packs / Console).
 */
export function getEgressAuditLog(): readonly EgressAuditEntry[] {
  return egressAuditLog
}

/**
 * Get summary statistics for egress checks.
 */
export function getEgressStats(): {
  total: number
  allowed: number
  blocked: number
  uniqueHosts: number
} {
  const allowed = egressAuditLog.filter((e) => e.allowed).length
  const uniqueHosts = new Set(egressAuditLog.map((e) => e.host)).size
  return {
    total: egressAuditLog.length,
    allowed,
    blocked: egressAuditLog.length - allowed,
    uniqueHosts,
  }
}

/**
 * Build a proof-pack section for sovereign egress controls.
 */
export function buildEgressProofSection(
  allowlist: EgressAllowlist,
): {
  section: 'sovereign_egress'
  enforced: boolean
  allowlistSize: number
  stats: ReturnType<typeof getEgressStats>
  recentBlocked: EgressAuditEntry[]
} {
  const stats = getEgressStats()
  const recentBlocked = egressAuditLog
    .filter((e) => !e.allowed)
    .slice(-50)

  return {
    section: 'sovereign_egress',
    enforced: allowlist.enforced,
    allowlistSize: allowlist.rules.length,
    stats,
    recentBlocked,
  }
}
