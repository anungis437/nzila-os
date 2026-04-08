/**
 * CLC Executive Intelligence — Audit Logger
 *
 * Structured audit logging for feedback loop operations.
 * Captures all state-changing events with correlation support.
 *
 * Design:
 * - In-memory log with org-scoped filtering
 * - Correlation IDs for tracing related events
 * - Immutable entries — append-only
 * - Query by event type, org, and time window
 *
 * @module audit/logger
 */

import type {
  FeedbackAuditEntry,
  AuditEventType,
} from '../contracts/index';

// ── Audit Logger ────────────────────────────────────────────────────────────

let auditLogIdCounter = 0;

/**
 * In-memory audit log for feedback loop operations.
 * For production use, pipe entries to a persistent store.
 */
export class FeedbackAuditLogger {
  private readonly entries: FeedbackAuditEntry[] = [];

  /**
   * Log an audit entry.
   */
  log(entry: FeedbackAuditEntry): void {
    this.entries.push({ ...entry });
  }

  /**
   * Create and log an audit entry.
   */
  record(
    eventType: AuditEventType,
    payload: Record<string, unknown>,
    options?: {
      organizationId?: string;
      userId?: string;
      correlationId?: string;
    },
  ): FeedbackAuditEntry {
    const entry: FeedbackAuditEntry = {
      id: `audit-${++auditLogIdCounter}`,
      timestamp: new Date().toISOString(),
      eventType,
      organizationId: options?.organizationId,
      userId: options?.userId,
      payload,
      correlationId: options?.correlationId,
    };
    this.entries.push(entry);
    return entry;
  }

  /**
   * Get all entries.
   */
  getAll(): FeedbackAuditEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by event type.
   */
  getByEventType(eventType: AuditEventType): FeedbackAuditEntry[] {
    return this.entries.filter((e) => e.eventType === eventType);
  }

  /**
   * Get entries by organization.
   */
  getByOrganization(organizationId: string): FeedbackAuditEntry[] {
    return this.entries.filter((e) => e.organizationId === organizationId);
  }

  /**
   * Get entries within a time window.
   */
  getInWindow(windowStart: string, windowEnd: string): FeedbackAuditEntry[] {
    const start = new Date(windowStart).getTime();
    const end = new Date(windowEnd).getTime();
    return this.entries.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= start && t <= end;
    });
  }

  /**
   * Get entries by correlation ID.
   */
  getByCorrelationId(correlationId: string): FeedbackAuditEntry[] {
    return this.entries.filter((e) => e.correlationId === correlationId);
  }

  /**
   * Get total entry count.
   */
  getCount(): number {
    return this.entries.length;
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.entries.length = 0;
    auditLogIdCounter = 0;
  }
}

/**
 * Reset the audit logger ID counter (for testing).
 */
export function resetAuditLogCounter(): void {
  auditLogIdCounter = 0;
}
