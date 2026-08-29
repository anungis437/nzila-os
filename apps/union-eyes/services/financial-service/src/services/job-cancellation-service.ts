/**
 * Job Cancellation Service — Gate 13 Implementation
 * 
 * Provides unified job execution state tracking and cancellation governance
 * for financial-service background jobs. Enables Union Eyes to record local
 * cancellation intent without relying on provider-side coordination.
 * 
 * See: docs/categories/products-and-market/union-eyes/liuna-opdc-cecof-readiness/
 *      27-gate-13-background-job-provider-artifact-cancellation-proof.md
 */

import { db } from '../db';
import { jobExecutionState, jobCancellationRequest, jobCancellationAuditEvent } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type JobExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AuditEventType = 
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'cancellation_requested'
  | 'cancellation_acknowledged'
  | 'job_cancelled'
  | 'reconciliation_event';

export interface JobStartContext {
  organizationId: string;
  jobType: string;
  jobRunId: string;
  jobBatchId?: string;
  context?: Record<string, unknown>;
}

/**
 * Extended context for job start that includes optional scheduling metadata.
 * Used by workflows that want to record when a job was scheduled vs. when it started.
 */
export interface JobStartContextWithSchedule extends JobStartContext {
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CancellationRequest {
  organizationId: string;
  idempotencyKey: string;
  requestedBy: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface JobExecutionState {
  id: string;
  organizationId: string;
  jobType: string;
  jobRunId: string;
  jobBatchId?: string | null;
  status: JobExecutionStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationRequested: boolean;
  cancellationIdempotencyKey?: string | null;
  cancellationRequestedAt?: Date | null;
  cancellationAcknowledgedAt?: Date | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  context?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  error?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEventRecord {
  id: string;
  organizationId: string;
  jobExecutionStateId: string;
  eventType: AuditEventType;
  eventSequence: string;
  actor: string;
  actorType: string;
  details?: Record<string, unknown> | null;
  message?: string | null;
  isTerminal: boolean;
  timestamp: Date;
}

// ============================================================================
// JOB CANCELLATION SERVICE
// ============================================================================

export class JobCancellationService {
  /**
   * Start a new job execution tracking session.
   * Creates execution state record in ue_governance_job_execution_state.
   * 
   * Note: idempotencyKey should NOT be passed here. It belongs to cancellation requests
   * (via requestCancellation method), not job execution start. The unique constraint on
   * (organization_id, job_type, job_run_id) prevents duplicate execution records.
   */
  async startJobExecution(config: JobStartContextWithSchedule): Promise<JobExecutionState> {
    try {
      // Merge scheduledAt and metadata into the context for storage
      const fullContext = {
        ...(config.metadata || {}),
        ...(config.context || {}),
        ...(config.scheduledAt ? { scheduledAt: config.scheduledAt.toISOString() } : {}),
      };

      const [executionState] = await db
        .insert(jobExecutionState)
        .values({
          organizationId: config.organizationId,
          jobType: config.jobType,
          jobRunId: config.jobRunId,
          jobBatchId: config.jobBatchId || null,
          status: 'running',
          startedAt: new Date(),
          context: Object.keys(fullContext).length > 0 ? fullContext : null,
        })
        .returning();

      await this.recordAuditEvent({
        organizationId: config.organizationId,
        jobExecutionStateId: executionState.id,
        eventType: 'job_started',
        actor: 'system',
        actorType: 'background-job',
        message: `Job started: ${config.jobType}/${config.jobRunId}`,
      });

      return executionState as JobExecutionState;
    } catch (error) {
      logger.error('Failed to start job execution', {
        error,
        config,
      });
      throw error;
    }
  }

  /**
   * Request cancellation of a running job.
   * Idempotent via unique constraint on (organization_id, idempotency_key).
   */
  async requestCancellation(config: CancellationRequest): Promise<void> {
    try {
      // Find execution state by org and verify it exists
      const [executionState] = await db
        .select()
        .from(jobExecutionState)
        .where(
          and(
            eq(jobExecutionState.organizationId, config.organizationId),
            eq(jobExecutionState.cancellationIdempotencyKey, config.idempotencyKey),
          ),
        )
        .limit(1);

      if (!executionState) {
        logger.warn('Cancellation request for non-existent or mismatched job', {
          organizationId: config.organizationId,
          idempotencyKey: config.idempotencyKey,
        });
        return;
      }

      // Try to insert cancellation request (idempotent via unique constraint)
      try {
        const [cancellationRecord] = await db
          .insert(jobCancellationRequest)
          .values({
            organizationId: config.organizationId,
            jobExecutionStateId: executionState.id,
            idempotencyKey: config.idempotencyKey,
            requestedBy: config.requestedBy,
            reason: config.reason || null,
            metadata: config.metadata || null,
          })
          .onConflictDoNothing()
          .returning();

        if (cancellationRecord) {
          // Mark execution state as cancellation requested
          await db
            .update(jobExecutionState)
            .set({
              cancellationRequested: true,
              cancellationRequestedAt: new Date(),
              cancellationIdempotencyKey: config.idempotencyKey,
              cancelledBy: config.requestedBy,
              cancellationReason: config.reason,
              updatedAt: new Date(),
            })
            .where(eq(jobExecutionState.id, executionState.id));

          await this.recordAuditEvent({
            organizationId: config.organizationId,
            jobExecutionStateId: executionState.id,
            eventType: 'cancellation_requested',
            actor: config.requestedBy,
            actorType: 'manual_request',
            message: `Cancellation requested: ${config.reason || 'no reason provided'}`,
            details: { idempotencyKey: config.idempotencyKey },
          });
        } else {
          // Request already exists (idempotent duplicate) — still mark as requested if not already
          if (!executionState.cancellationRequested) {
            await db
              .update(jobExecutionState)
              .set({
                cancellationRequested: true,
                cancellationRequestedAt: new Date(),
                cancellationIdempotencyKey: config.idempotencyKey,
                updatedAt: new Date(),
              })
              .where(eq(jobExecutionState.id, executionState.id));
          }
        }
      } catch (conflictError: unknown) {
        // Handle unique constraint violation gracefully
        if ((conflictError as { code?: string }).code === '23505') {
          logger.debug('Cancellation request already exists (idempotent)', {
            organizationId: config.organizationId,
            idempotencyKey: config.idempotencyKey,
          });
        } else {
          throw conflictError;
        }
      }
    } catch (error) {
      logger.error('Failed to request job cancellation', {
        error,
        config,
      });
      throw error;
    }
  }

  /**
   * Check if a job should be cancelled.
   * Call regularly from job processing loops to enable graceful exit.
   */
  async isJobCancelled(executionStateId: string, organizationId: string): Promise<boolean> {
    try {
      const [state] = await db
        .select()
        .from(jobExecutionState)
        .where(
          and(
            eq(jobExecutionState.id, executionStateId),
            eq(jobExecutionState.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!state) {
        return false;
      }

      return state.cancellationRequested === true;
    } catch (error) {
      logger.error('Failed to check job cancellation status', {
        error,
        executionStateId,
        organizationId,
      });
      // On error, assume NOT cancelled to allow job to continue
      return false;
    }
  }

  /**
   * Mark a job as completed successfully.
   */
  async completeJob(
    executionStateId: string,
    organizationId: string,
    result?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await db
        .update(jobExecutionState)
        .set({
          status: 'completed',
          completedAt: new Date(),
          result: result || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobExecutionState.id, executionStateId),
            eq(jobExecutionState.organizationId, organizationId),
          ),
        );

      await this.recordAuditEvent({
        organizationId,
        jobExecutionStateId: executionStateId,
        eventType: 'job_completed',
        actor: 'system',
        actorType: 'background-job',
        message: 'Job completed successfully',
        isTerminal: true,
      });
    } catch (error) {
      logger.error('Failed to complete job', {
        error,
        executionStateId,
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Mark a job as failed.
   */
  async failJob(
    executionStateId: string,
    organizationId: string,
    error: Record<string, unknown>,
  ): Promise<void> {
    try {
      await db
        .update(jobExecutionState)
        .set({
          status: 'failed',
          failedAt: new Date(),
          error,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobExecutionState.id, executionStateId),
            eq(jobExecutionState.organizationId, organizationId),
          ),
        );

      await this.recordAuditEvent({
        organizationId,
        jobExecutionStateId: executionStateId,
        eventType: 'job_failed',
        actor: 'system',
        actorType: 'background-job',
        message: 'Job failed',
        details: error,
        isTerminal: true,
      });
    } catch (error) {
      logger.error('Failed to record job failure', {
        error,
        executionStateId,
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Mark a job as cancelled.
   */
  async cancelJob(
    executionStateId: string,
    organizationId: string,
    cancelledBy: string = 'system',
  ): Promise<void> {
    try {
      await db
        .update(jobExecutionState)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationAcknowledgedAt: new Date(),
          cancelledBy,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobExecutionState.id, executionStateId),
            eq(jobExecutionState.organizationId, organizationId),
          ),
        );

      await this.recordAuditEvent({
        organizationId,
        jobExecutionStateId: executionStateId,
        eventType: 'job_cancelled',
        actor: cancelledBy,
        actorType: 'background-job',
        message: 'Job execution cancelled',
        isTerminal: true,
      });
    } catch (error) {
      logger.error('Failed to cancel job', {
        error,
        executionStateId,
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Record an audit event for governance tracking.
   */
  async recordAuditEvent(config: {
    organizationId: string;
    jobExecutionStateId: string;
    eventType: AuditEventType;
    actor: string;
    actorType: string;
    message?: string;
    details?: Record<string, unknown>;
    isTerminal?: boolean;
  }): Promise<void> {
    try {
      await db
        .insert(jobCancellationAuditEvent)
        .values({
          organizationId: config.organizationId,
          jobExecutionStateId: config.jobExecutionStateId,
          eventType: config.eventType,
          eventSequence: `${config.eventType}:${new Date().getTime()}`,
          actor: config.actor,
          actorType: config.actorType,
          message: config.message || null,
          details: config.details || null,
          isTerminal: config.isTerminal || false,
        });
    } catch (error) {
      logger.error('Failed to record audit event', {
        error,
        config,
      });
      // Don't throw—audit logging failure shouldn't block job execution
    }
  }

  /**
   * Get current execution state for a job.
   */
  async getExecutionState(
    executionStateId: string,
    organizationId: string,
  ): Promise<JobExecutionState | null> {
    try {
      const [state] = await db
        .select()
        .from(jobExecutionState)
        .where(
          and(
            eq(jobExecutionState.id, executionStateId),
            eq(jobExecutionState.organizationId, organizationId),
          ),
        )
        .limit(1);

      return (state || null) as JobExecutionState | null;
    } catch (error) {
      logger.error('Failed to retrieve execution state', {
        error,
        executionStateId,
        organizationId,
      });
      return null;
    }
  }
}

// Export singleton instance
export const jobCancellationService = new JobCancellationService();
