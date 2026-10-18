/**
 * @nzila/tool-fabric — policy / trust audit
 *
 * Audit events are structured and bounded. They record identifiers, hashes,
 * outcomes and reason codes; they never carry raw arguments, environment
 * values, command payloads or secret references. Denial reasons are scrubbed
 * of any quoted caller-supplied text before being stored.
 */
import { createHash } from 'node:crypto'
import { AuditEngine, type AuditStore } from '@nzila/audit'
import { TOOL_SIDE_EFFECTS } from './types'

export const TOOL_AUDIT_ORG = 'platform:tool-fabric:audit'

export interface ToolAuditEvent {
  readonly authenticatedActor?: {
    readonly subject: string; readonly organizationId: string; readonly missionId: string
    readonly invocationRef: string; readonly source: string
  }
  readonly type: 'EXECUTION_POLICY' | 'INSTALL_POLICY'
  readonly correlationId: string
  readonly requestingAgentId: string | null
  readonly capability: string | null
  readonly toolKey: string | null
  readonly toolDigest: string | null
  readonly trustStatus: string | null
  readonly suspension: string | null
  /** Latest governance decision relied on for the tool's trust, if any. */
  readonly trustDecisionRef: string | null
  readonly authority: { readonly source: string; readonly authorityRef: string; readonly resolvedAt: string } | null
  readonly approval: { readonly decisionRef: string; readonly status: string } | null
  readonly outcome: 'ALLOWED' | 'DENIED'
  readonly reasons: readonly string[]
  readonly commandSha256: string | null
  readonly argCount: number
  readonly argsSha256: string | null
  readonly envKeyCount: number
  readonly secretRefCount: number
  readonly sideEffects: readonly string[]
}

export interface ToolAuditSink {
  /** Returns the audit entry id. A thrown error means the evaluation must be denied. */
  record(event: ToolAuditEvent): Promise<string>
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Strips quoted caller-controlled fragments so reasons cannot smuggle values. */
export function scrubReason(reason: string): string {
  return reason.replace(/"[^"]*"/g, '"<redacted>"').slice(0, 240)
}

export function summarizeIntentForAudit(raw: unknown): {
  commandSha256: string | null
  argCount: number
  argsSha256: string | null
  envKeyCount: number
  secretRefCount: number
  sideEffects: string[]
} {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const argCount = Array.isArray(r.args) ? Math.min(r.args.length, 65) : 0
  const env =
    typeof r.env === 'object' && r.env !== null && typeof (r.env as { allow?: unknown }).allow === 'object'
      ? Object.keys((r.env as { allow: Record<string, unknown> }).allow ?? {})
      : []
  const secretRefCount = Array.isArray(r.secretRefs) ? Math.min(r.secretRefs.length, 17) : 0
  const effects = Array.isArray(r.sideEffects)
    ? r.sideEffects.slice(0, 10).filter((s): s is string => TOOL_SIDE_EFFECTS.some((effect) => effect === s))
    : []
  return {
    commandSha256: null,
    argCount,
    argsSha256: null,
    envKeyCount: Math.min(env.length, 17),
    secretRefCount,
    sideEffects: effects.slice(0, 10),
  }
}

/** Persists audit events through the existing @nzila/audit engine. */
export class AuditEngineToolAuditSink implements ToolAuditSink {
  private readonly engine: AuditEngine

  constructor(store: AuditStore) {
    this.engine = new AuditEngine(store)
  }

  async record(event: ToolAuditEvent): Promise<string> {
    const identifier = (v: string | null) => v !== null && /^[A-Za-z0-9][A-Za-z0-9:._/@-]{0,159}$/.test(v) ? v : null
    const safe = {
      ...event,
      correlationId: identifier(event.correlationId) ?? 'invalid',
      requestingAgentId: identifier(event.requestingAgentId),
      capability: identifier(event.capability),
      toolKey: identifier(event.toolKey),
      commandSha256: null,
      argsSha256: null,
      reasons: [event.outcome === 'DENIED' ? 'POLICY_DENIED' : 'POLICY_ELIGIBLE'],
    }
    const entry = await this.engine.record({
      actorId: event.authenticatedActor ? `agent:${event.authenticatedActor.subject}` : 'system:tool-fabric',
      orgId: TOOL_AUDIT_ORG,
      action: `tool_fabric.policy.${event.type.toLowerCase()}`,
      resource: 'tool-fabric-policy',
      resourceId: safe.correlationId,
      payload: { ...safe },
    })
    return entry.id
  }
}
