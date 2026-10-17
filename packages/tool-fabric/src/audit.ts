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

export const TOOL_AUDIT_ORG = 'platform:tool-fabric:audit'

export interface ToolAuditEvent {
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
  const args = Array.isArray(r.args) ? r.args.filter((a): a is string => typeof a === 'string') : []
  const env =
    typeof r.env === 'object' && r.env !== null && typeof (r.env as { allow?: unknown }).allow === 'object'
      ? Object.keys((r.env as { allow: Record<string, unknown> }).allow ?? {})
      : []
  const refs = Array.isArray(r.secretRefs) ? r.secretRefs : []
  const effects = Array.isArray(r.sideEffects)
    ? r.sideEffects.filter((s): s is string => typeof s === 'string' && /^[A-Z_]{3,40}$/.test(s))
    : []
  return {
    commandSha256: typeof r.command === 'string' ? sha256Hex(r.command) : null,
    argCount: args.length,
    argsSha256: args.length > 0 ? sha256Hex(JSON.stringify(args)) : null,
    envKeyCount: env.length,
    secretRefCount: refs.length,
    sideEffects: effects,
  }
}

/** Persists audit events through the existing @nzila/audit engine. */
export class AuditEngineToolAuditSink implements ToolAuditSink {
  private readonly engine: AuditEngine

  constructor(store: AuditStore) {
    this.engine = new AuditEngine(store)
  }

  async record(event: ToolAuditEvent): Promise<string> {
    const entry = await this.engine.record({
      actorId: event.requestingAgentId ? `agent:${event.requestingAgentId}` : 'system:tool-fabric',
      orgId: TOOL_AUDIT_ORG,
      action: `tool_fabric.policy.${event.type.toLowerCase()}`,
      resource: 'tool-fabric-policy',
      resourceId: event.correlationId,
      payload: { ...event, reasons: event.reasons.map(scrubReason) } as unknown as Record<string, unknown>,
    })
    return entry.id
  }
}
