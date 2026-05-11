/**
 * @nzila/governance-middleware — Emitter
 *
 * Process-scoped governance emitter with pluggable sinks. Sinks receive
 * validated envelopes only. Forbidden payload keys are rejected at the
 * emitter boundary even if a caller bypassed the schema layer.
 *
 * @module @nzila/governance-middleware/emitter
 */
import type {
  GovernanceEventEnvelope,
  GovernanceSink,
  GovernanceSeverity,
} from './types'

const FORBIDDEN_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'userId',
  'user_id',
  'employeeId',
  'employee_id',
  'email',
  'phone',
  'ip',
  'ipAddress',
  'sessionId',
  'session_id',
])

export class ForbiddenPayloadKeyError extends Error {
  readonly key: string
  constructor(key: string) {
    super(
      `forbidden_payload_key: "${key}" is structurally refused by the governance emitter`,
    )
    this.name = 'ForbiddenPayloadKeyError'
    this.key = key
  }
}

function assertCleanPayload(envelope: GovernanceEventEnvelope): void {
  for (const k of Object.keys(envelope.payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(k)) {
      throw new ForbiddenPayloadKeyError(k)
    }
  }
}

export class GovernanceEmitter {
  private readonly sinks: GovernanceSink[] = []

  addSink(sink: GovernanceSink): void {
    this.sinks.push(sink)
  }

  removeSink(name: string): void {
    const idx = this.sinks.findIndex((s) => s.name === name)
    if (idx >= 0) this.sinks.splice(idx, 1)
  }

  /**
   * Emit an envelope to every registered sink. Errors from individual
   * sinks are isolated — one failing sink does not prevent the others
   * from receiving the envelope.
   */
  async emit(envelope: GovernanceEventEnvelope): Promise<void> {
    assertCleanPayload(envelope)
    await Promise.all(
      this.sinks.map(async (sink) => {
        try {
          await sink.emit(envelope)
        } catch {
          /* sinks must not crash the request path */
        }
      }),
    )
  }

  /** For test inspection. Not part of the public production contract. */
  listSinks(): readonly string[] {
    return this.sinks.map((s) => s.name)
  }
}

/**
 * In-memory sink useful for tests and for the E2E harness.
 */
export class InMemoryGovernanceSink implements GovernanceSink {
  readonly name = 'in-memory'
  private readonly buffer: GovernanceEventEnvelope[] = []

  emit(envelope: GovernanceEventEnvelope): void {
    this.buffer.push(envelope)
  }

  drain(): readonly GovernanceEventEnvelope[] {
    const out = this.buffer.slice()
    this.buffer.length = 0
    return out
  }

  peek(): readonly GovernanceEventEnvelope[] {
    return this.buffer.slice()
  }
}

/** Process-scoped singleton. Apps should add sinks during startup. */
export const governanceEmitter = new GovernanceEmitter()

/**
 * Convenience helper. Builds an envelope id from `type` + `subject.id`
 * + `emittedAt` if not provided. Returns the constructed envelope so
 * callers can attach it to traces or test assertions.
 */
export async function emit(
  partial: Omit<GovernanceEventEnvelope, 'id' | 'schemaVersion' | 'emittedAt'> & {
    readonly id?: string
    readonly schemaVersion?: string
    readonly emittedAt?: string
    readonly severity?: GovernanceSeverity
  },
): Promise<GovernanceEventEnvelope> {
  const emittedAt = partial.emittedAt ?? new Date().toISOString()
  const envelope: GovernanceEventEnvelope = {
    id:
      partial.id ??
      `evt.${partial.type}.${partial.subject.id}.${emittedAt}`,
    schemaVersion: partial.schemaVersion ?? '1.0.0',
    type: partial.type,
    severity: partial.severity ?? 'info',
    scope: partial.scope,
    subject: partial.subject,
    doctrineCitations: partial.doctrineCitations,
    decision: partial.decision,
    releaseId: partial.releaseId,
    emittedAt,
    payload: partial.payload,
    correlationKey: partial.correlationKey,
  }
  await governanceEmitter.emit(envelope)
  return envelope
}
