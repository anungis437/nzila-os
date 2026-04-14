/**
 * @nzila/platform-integrations — Audit Hooks
 *
 * Integration-specific audit hooks that wrap @nzila/audit.
 * All integration actions must produce audit entries.
 */

// ─── Audit Action Input ──────────────────────────────────────────────────────

export interface IntegrationAuditInput {
  readonly orgId: string
  readonly actorId: string
  readonly action: string
  readonly resource: string
  readonly resourceId?: string
  readonly payload: Record<string, unknown>
  readonly traceId?: string
  readonly spanId?: string
}

// ─── Audit Hooks Interface ───────────────────────────────────────────────────

export interface IntegrationAuditHooks {
  recordIntegrationAction(input: IntegrationAuditInput): Promise<void>
}

// ─── Default Implementation (delegates to @nzila/audit) ──────────────────────

export interface AuditEnginePort {
  record(input: {
    actorId: string
    orgId: string
    action: string
    resource: string
    resourceId?: string
    payload: Record<string, unknown>
    traceId?: string
    spanId?: string
  }): Promise<unknown>
}

export class DefaultIntegrationAuditHooks implements IntegrationAuditHooks {
  private readonly engine: AuditEnginePort

  constructor(engine: AuditEnginePort) {
    this.engine = engine
  }

  async recordIntegrationAction(input: IntegrationAuditInput): Promise<void> {
    await this.engine.record({
      actorId: input.actorId,
      orgId: input.orgId,
      action: `integration.${input.action}`,
      resource: input.resource,
      resourceId: input.resourceId,
      payload: {
        ...input.payload,
        _auditSource: 'platform-integrations',
        _timestamp: new Date().toISOString(),
      },
      traceId: input.traceId,
      spanId: input.spanId,
    })
  }
}

// ─── No-op Implementation (for testing) ──────────────────────────────────────

export class NoopIntegrationAuditHooks implements IntegrationAuditHooks {
  readonly recorded: IntegrationAuditInput[] = []

  async recordIntegrationAction(input: IntegrationAuditInput): Promise<void> {
    this.recorded.push(input)
  }
}
