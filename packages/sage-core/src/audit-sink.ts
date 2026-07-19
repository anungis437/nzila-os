// ─── @nzila/sage-core — audit sink port ──────────────────────────────────────
// Shaped to @nzila/audit. Services build payloads via buildSageAuditPayload and
// record them here. A real sink appends to the @nzila/audit hash chain; this is
// NOT a parallel audit log — it is the SAGE-side port into the audit system.

import type { SageAuditPayload } from './audit-events'

export interface SageAuditSink {
  record(input: SageAuditPayload): Promise<void>
}

/** Collecting sink for tests: records payloads in order. */
export class InMemorySageAuditSink implements SageAuditSink {
  readonly records: SageAuditPayload[] = []

  async record(input: SageAuditPayload): Promise<void> {
    this.records.push(input)
  }

  actions(): string[] {
    return this.records.map((r) => r.action)
  }

  has(action: string): boolean {
    return this.records.some((r) => r.action === action)
  }
}
