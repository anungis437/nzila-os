/**
 * Gate 13: Background Job & Provider Artifact Cancellation — Governance Runtime Schema
 *
 * Purpose: Track local state for background job cancellation with idempotency guarantees
 * and comprehensive audit trails. This enables Union Eyes to record cancellation requests
 * and enforce terminal state, without relying on provider-side coordination.
 *
 * Scope: LOCAL STATE ONLY
 *   IN-SCOPE:
 *   - Job execution invocation state (pending, running, completed, cancelled)
 *   - Cancellation request recording with idempotency keys
 *   - Terminal state enforcement (prevents re-dispatch after cancellation)
 *   - Audit event trails (who requested, when, why, what happened)
 *   - Reconciliation scans for orphaned job states
 *
 *   OUT-OF-SCOPE (explicit operating limitations):
 *   - Provider artifact cleanup (SaaS, cloud storage, etc. remain after cancellation)
 *   - IdP token revocation (tokens continue until natural expiration)
 *   - Browser cache invalidation (cached client data not cleared)
 *   - SAS recall operations (shared access signatures cannot be revoked retroactively)
 *   - Async continuation callbacks (provider may still invoke after cancellation)
 *
 * Architecture:
 * - Governance runtime schema (Drizzle-owned, scoped, ue_governance namespace)
 * - Organization-level isolation via RLS policies
 * - Idempotency enforced at schema level (unique constraint on cancellation key)
 * - Audit-trail triggers for all state changes
 * - No foreign keys to Django entities (read-only governance relationship)
 *
 * Reference: docs/categories/products-and-market/union-eyes/liuna-opdc-cecof-readiness/27-gate-13-background-job-provider-artifact-cancellation-proof.md
 */

import { pgTable, uuid, text, timestamp, jsonb, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Job Execution State
 *
 * Tracks each background job invocation to enable cancellation requests and terminal state enforcement.
 * A jobRunId + jobType combination uniquely identifies a single invocation.
 */
export const jobExecutionState = pgTable(
  'ue_governance_job_execution_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Organizational Isolation (RLS)
    organizationId: uuid('organization_id').notNull(),

    // Job Identity
    jobType: text('job_type').notNull(), // dues_calculation, arrears_management, payment_collection, analytics_processor, stipend_processing
    jobRunId: uuid('job_run_id').notNull(), // Unique identifier for this invocation
    jobBatchId: uuid('job_batch_id'), // Optional: batch identifier for correlated jobs

    // Execution State Machine
    status: text('status')
      .notNull()
      .default('pending'), // pending → running → completed | failed | cancelled
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    failedAt: timestamp('failed_at'),
    cancelledAt: timestamp('cancelled_at'),

    // Cancellation State
    cancellationRequested: boolean('cancellation_requested').notNull().default(false),
    cancellationIdempotencyKey: text('cancellation_idempotency_key'), // Deduplicate cancellation requests
    cancellationRequestedAt: timestamp('cancellation_requested_at'),
    cancellationAcknowledgedAt: timestamp('cancellation_acknowledged_at'),
    cancelledBy: text('cancelled_by'), // User, service, or system identifier

    // Job Metadata
    context: jsonb('context').$type<Record<string, unknown>>(), // Job-specific invocation context
    result: jsonb('result').$type<Record<string, unknown>>(), // Completion result (if succeeded)
    error: jsonb('error').$type<Record<string, unknown>>(), // Error details (if failed)
    cancellationReason: text('cancellation_reason'), // Why was this cancelled?

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (table) => ({
    // Governance isolation: query by organization
    orgIdIdx: index('ue_governance_job_execution_state_org_id_idx').on(table.organizationId),

    // Job identity: prevent duplicate invocation records
    jobIdentityIdx: uniqueIndex('ue_governance_job_execution_state_job_identity_idx').on(
      table.organizationId,
      table.jobType,
      table.jobRunId
    ),

    // Cancellation idempotency: deduplicate cancellation requests
    cancellationIdempotencyIdx: index('ue_governance_job_execution_state_cancellation_idempotency_idx').on(
      table.organizationId,
      table.cancellationIdempotencyKey
    ),

    // Query patterns: find jobs by status
    statusIdx: index('ue_governance_job_execution_state_status_idx').on(table.status),
    jobTypeIdx: index('ue_governance_job_execution_state_job_type_idx').on(table.jobType),
  })
);

/**
 * Job Cancellation Request
 *
 * Records explicit cancellation requests with idempotency keys to prevent duplicate processing.
 * Idempotency key must be unique within organization to ensure exactly-once semantics.
 */
export const jobCancellationRequest = pgTable(
  'ue_governance_job_cancellation_request',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Organizational Isolation (RLS)
    organizationId: uuid('organization_id').notNull(),

    // Request Identity
    jobExecutionStateId: uuid('job_execution_state_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(), // Caller-provided request ID
    requestedBy: text('requested_by').notNull(), // User, service, or system identifier

    // Request Metadata
    reason: text('reason'), // Why is this cancellation being requested?
    metadata: jsonb('metadata').$type<Record<string, unknown>>(), // Arbitrary request metadata

    // Processing State
    processedAt: timestamp('processed_at'),
    acknowledged: boolean('acknowledged').notNull().default(false),

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (table) => ({
    // Organizational isolation
    orgIdIdx: index('ue_governance_job_cancellation_request_org_id_idx').on(table.organizationId),

    // Idempotency guarantee: one request per (org, idempotency_key) pair
    idempotencyIdx: uniqueIndex('ue_governance_job_cancellation_request_idempotency_idx').on(
      table.organizationId,
      table.idempotencyKey
    ),

    // Query patterns: find pending requests
    acknowledgedIdx: index('ue_governance_job_cancellation_request_acknowledged_idx').on(
      table.acknowledged
    ),
  })
);

/**
 * Job Cancellation Audit Event
 *
 * Comprehensive audit trail of all cancellation-related events: request initiation,
 * acknowledgment, termination, and reconciliation completion. Enables forensic analysis
 * and regulatory compliance auditing.
 */
export const jobCancellationAuditEvent = pgTable(
  'ue_governance_job_cancellation_audit_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Organizational Isolation (RLS)
    organizationId: uuid('organization_id').notNull(),

    // Event Identity
    jobExecutionStateId: uuid('job_execution_state_id').notNull(),
    eventType: text('event_type').notNull(), // cancellation_requested, acknowledged, terminated, reconciliation_complete, error
    eventSequence: text('event_sequence').notNull(), // Sequential event ordering within job execution

    // Event Actor
    actor: text('actor').notNull(), // User, service, or system identifier
    actorType: text('actor_type').notNull(), // user | service | system | job

    // Event Details
    details: jsonb('details').$type<Record<string, unknown>>(), // Event-specific metadata
    message: text('message'), // Human-readable event description

    // Terminal State Enforcement
    isTerminal: boolean('is_terminal').notNull().default(false), // If true, no further cancellations allowed

    // Audit
    timestamp: timestamp('timestamp').notNull().defaultNow(),
  },
  (table) => ({
    // Organizational isolation
    orgIdIdx: index('ue_governance_job_cancellation_audit_event_org_id_idx').on(table.organizationId),

    // Query patterns: find events for a job
    jobIdIdx: index('ue_governance_job_cancellation_audit_event_job_id_idx').on(
      table.jobExecutionStateId
    ),

    // Query patterns: find by event type
    eventTypeIdx: index('ue_governance_job_cancellation_audit_event_type_idx').on(table.eventType),

    // Query patterns: timeline analysis
    timestampIdx: index('ue_governance_job_cancellation_audit_event_timestamp_idx').on(
      table.timestamp
    ),
  })
);

/**
 * Job Reconciliation Pass
 *
 * Tracks reconciliation scans for orphaned job states (jobs that were cancelled but
 * never acknowledged). Used for operational diagnostics and provider-artifact cleanup
 * correlation (though actual cleanup remains a provider responsibility).
 */
export const jobReconciliationPass = pgTable(
  'ue_governance_job_reconciliation_pass',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Organizational Isolation (RLS)
    organizationId: uuid('organization_id').notNull(),

    // Pass Identity
    passStartedAt: timestamp('pass_started_at').notNull(),
    passCompletedAt: timestamp('pass_completed_at'),

    // Reconciliation Results
    jobsScanned: jsonb('jobs_scanned').$type<string[]>(), // Array of jobRunId strings found
    jobsCancelled: jsonb('jobs_cancelled').$type<string[]>(), // Array of cancelled jobs identified
    jobsReconciled: jsonb('jobs_reconciled').$type<string[]>(), // Array of successfully reconciled jobs
    jobsUnreconcilable: jsonb('jobs_unreconcilable').$type<string[]>(), // Array of jobs needing manual intervention

    // Pass Metadata
    scanType: text('scan_type').notNull().default('automatic'), // automatic | manual | emergency
    triggeredBy: text('triggered_by'), // User or system identifier
    details: jsonb('details').$type<Record<string, unknown>>(), // Arbitrary reconciliation metadata

    // Pass Status
    status: text('status')
      .notNull()
      .default('in_progress'), // in_progress | completed | failed

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (table) => ({
    // Organizational isolation
    orgIdIdx: index('ue_governance_job_reconciliation_pass_org_id_idx').on(table.organizationId),

    // Query patterns: find recent passes
    passStartedIdx: index('ue_governance_job_reconciliation_pass_started_idx').on(
      table.passStartedAt
    ),

    // Query patterns: find incomplete passes
    statusIdx: index('ue_governance_job_reconciliation_pass_status_idx').on(table.status),
  })
);

// Relations
export const jobExecutionStateRelations = relations(jobExecutionState, ({ many }) => ({
  cancellationRequests: many(jobCancellationRequest),
  auditEvents: many(jobCancellationAuditEvent),
}));

export const jobCancellationRequestRelations = relations(jobCancellationRequest, ({ one }) => ({
  jobExecution: one(jobExecutionState, {
    fields: [jobCancellationRequest.jobExecutionStateId],
    references: [jobExecutionState.id],
  }),
}));

export const jobCancellationAuditEventRelations = relations(jobCancellationAuditEvent, ({ one }) => ({
  jobExecution: one(jobExecutionState, {
    fields: [jobCancellationAuditEvent.jobExecutionStateId],
    references: [jobExecutionState.id],
  }),
}));
