/**
 * Dunning Service
 *
 * Manages failed-payment retry sequences:
 *  1. Open dunning case on payment failure
 *  2. Step through policy (retry → email → escalate → cancel)
 *  3. Resolve on successful payment recovery
 *  4. Terminal action (pause/cancel) when retries exhausted
 *
 * @domain platform-economics
 * @layer 1.5 — Billing Lifecycle
 */

import { db } from '@/db';
import {
  dunningPolicies,
  dunningSteps,
  dunningCases,
  subscriptionEventsLog,
  orgSubscriptions,
} from '@/db/schema';
import { eq, and, lte, asc, sql, inArray } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

// ============================================================================
// Types
// ============================================================================

export interface OpenDunningInput {
  organizationId: string;
  subscriptionId: string;
  externalPaymentId?: string;
}

export interface StepResult {
  caseId: string;
  action: string;
  nextRetryAt: Date | null;
  isTerminal: boolean;
}

// ============================================================================
// Policy Management
// ============================================================================

/**
 * Get the default dunning policy with its steps.
 */
export async function getDefaultPolicy() {
  const [policy] = await db
    .select()
    .from(dunningPolicies)
    .where(
      and(
        eq(dunningPolicies.isDefault, true),
        eq(dunningPolicies.isActive, true),
      ),
    )
    .limit(1);

  if (!policy) return null;

  const steps = await db
    .select()
    .from(dunningSteps)
    .where(eq(dunningSteps.policyId, policy.id))
    .orderBy(asc(dunningSteps.stepOrder));

  return { policy, steps };
}

// ============================================================================
// Dunning Case Lifecycle
// ============================================================================

/**
 * Open a new dunning case when a payment fails.
 */
export async function openDunningCase(input: OpenDunningInput): Promise<string> {
  const policyData = await getDefaultPolicy();
  if (!policyData) {
    throw new Error('No default dunning policy configured');
  }

  // Don't duplicate — check for existing open case
  const [existing] = await db
    .select({ id: dunningCases.id })
    .from(dunningCases)
    .where(
      and(
        eq(dunningCases.subscriptionId, input.subscriptionId),
        inArray(dunningCases.status, ['open', 'retrying', 'escalated']),
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  const firstStep = policyData.steps[0];
  const nextRetry = firstStep
    ? new Date(Date.now() + firstStep.delayDays * 86_400_000)
    : null;

  const [dCase] = await db
    .insert(dunningCases)
    .values({
      organizationId: input.organizationId,
      subscriptionId: input.subscriptionId,
      policyId: policyData.policy.id,
      status: 'open',
      currentStepOrder: 0,
      retryCount: 0,
      nextRetryAt: nextRetry,
      externalPaymentId: input.externalPaymentId,
    })
    .returning();

  // Log subscription event
  await db.insert(subscriptionEventsLog).values({
    organizationId: input.organizationId,
    subscriptionId: input.subscriptionId,
    eventType: 'dunning_started',
    metadata: { dunningCaseId: dCase.id },
  });

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: AuditSeverity.HIGH,
    organizationId: input.organizationId,
    resource: 'dunning_case',
    resourceId: dCase.id,
    action: 'dunning_case_opened',
  });

  return dCase.id;
}

/**
 * Advance a dunning case to its next step.
 * Returns the action to execute.
 */
export async function advanceDunningStep(caseId: string): Promise<StepResult> {
  const [dCase] = await db
    .select()
    .from(dunningCases)
    .where(eq(dunningCases.id, caseId))
    .limit(1);

  if (!dCase) throw new Error(`Dunning case ${caseId} not found`);
  if (dCase.status === 'resolved' || dCase.status === 'terminal') {
    return { caseId, action: 'none', nextRetryAt: null, isTerminal: true };
  }

  const nextOrder = dCase.currentStepOrder + 1;

  // Get the next step from the policy
  const [step] = await db
    .select()
    .from(dunningSteps)
    .where(
      and(
        eq(dunningSteps.policyId, dCase.policyId),
        eq(dunningSteps.stepOrder, nextOrder),
      ),
    )
    .limit(1);

  // No more steps → terminal
  if (!step) {
    await db
      .update(dunningCases)
      .set({
        status: 'terminal',
        updatedAt: new Date(),
      })
      .where(eq(dunningCases.id, caseId));

    // Pause the subscription
    await db
      .update(orgSubscriptions)
      .set({
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(eq(orgSubscriptions.id, dCase.subscriptionId));

    await db.insert(subscriptionEventsLog).values({
      organizationId: dCase.organizationId,
      subscriptionId: dCase.subscriptionId,
      eventType: 'paused',
      reason: 'Dunning exhausted — subscription paused',
      metadata: { dunningCaseId: caseId },
    });

    return { caseId, action: 'subscription_paused', nextRetryAt: null, isTerminal: true };
  }

  // Advance to next step
  const nextRetry = new Date(Date.now() + step.delayDays * 86_400_000);
  const newStatus = step.action === 'retry_payment' ? 'retrying' : 'escalated';

  await db
    .update(dunningCases)
    .set({
      currentStepOrder: nextOrder,
      retryCount: dCase.retryCount + (step.action === 'retry_payment' ? 1 : 0),
      lastRetryAt: step.action === 'retry_payment' ? new Date() : dCase.lastRetryAt,
      nextRetryAt: nextRetry,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(dunningCases.id, caseId));

  if (step.action === 'retry_payment') {
    await db.insert(subscriptionEventsLog).values({
      organizationId: dCase.organizationId,
      subscriptionId: dCase.subscriptionId,
      eventType: 'payment_retried',
      metadata: { dunningCaseId: caseId, stepOrder: nextOrder },
    });
  } else {
    await db.insert(subscriptionEventsLog).values({
      organizationId: dCase.organizationId,
      subscriptionId: dCase.subscriptionId,
      eventType: 'dunning_escalated',
      metadata: { dunningCaseId: caseId, action: step.action },
    });
  }

  return {
    caseId,
    action: step.action,
    nextRetryAt: nextRetry,
    isTerminal: false,
  };
}

/**
 * Resolve a dunning case when payment is recovered.
 */
export async function resolveDunningCase(
  caseId: string,
  resolvedBy?: string,
) {
  const [dCase] = await db
    .update(dunningCases)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy,
      resolveReason: 'Payment recovered',
      updatedAt: new Date(),
    })
    .where(eq(dunningCases.id, caseId))
    .returning();

  if (!dCase) throw new Error(`Dunning case ${caseId} not found`);

  // Ensure subscription is active
  await db
    .update(orgSubscriptions)
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(orgSubscriptions.id, dCase.subscriptionId));

  await db.insert(subscriptionEventsLog).values({
    organizationId: dCase.organizationId,
    subscriptionId: dCase.subscriptionId,
    eventType: 'payment_recovered',
    triggeredBy: resolvedBy,
    metadata: { dunningCaseId: caseId },
  });

  await db.insert(subscriptionEventsLog).values({
    organizationId: dCase.organizationId,
    subscriptionId: dCase.subscriptionId,
    eventType: 'dunning_resolved',
    triggeredBy: resolvedBy,
    metadata: { dunningCaseId: caseId },
  });

  await auditLog({
    eventType: AuditEventType.BILLING_UPDATE,
    severity: AuditSeverity.MEDIUM,
    userId: resolvedBy ?? 'system',
    organizationId: dCase.organizationId,
    resource: 'dunning_case',
    resourceId: caseId,
    action: 'dunning_case_resolved',
    metadata: {
      subscriptionId: dCase.subscriptionId,
      detail: `Dunning case resolved — subscription ${dCase.subscriptionId} reactivated`,
    },
  });

  return dCase;
}

/**
 * Process all dunning cases that are due for their next step.
 * Called by a scheduled job (cron).
 */
export async function processDueDunningCases(): Promise<StepResult[]> {
  const dueCases = await db
    .select()
    .from(dunningCases)
    .where(
      and(
        inArray(dunningCases.status, ['open', 'retrying', 'escalated']),
        lte(dunningCases.nextRetryAt, new Date()),
      ),
    );

  const results: StepResult[] = [];
  for (const dCase of dueCases) {
    const result = await advanceDunningStep(dCase.id);
    results.push(result);
  }

  return results;
}
