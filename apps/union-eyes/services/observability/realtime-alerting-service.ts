import { withRLSContext, withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import {
  alertExecutions,
  alertRules,
  inAppNotifications,
  organizationMembers,
} from '@/db/schema';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';
import { SLA_MODEL_VERSION } from '@/lib/ml/sla-breach-score';

interface AlertSignal {
  organizationId: string;
  kind: 'sla_breach_imminent' | 'ingestion_failures' | 'payment_reconciliation_failures';
  count: number;
  severity: 'high' | 'critical';
  message: string;
}

interface EmitResult {
  emitted: number;
  alreadyAlerted: number;
  byKind: Record<string, number>;
  failures: Array<{ organizationId: string; kind: string; reason: string }>;
}

/** Organization members who receive a realtime alert in their inbox. */
export const ALERT_RECIPIENT_ROLES = ['admin', 'president'] as const;

type CountRow = { organization_id: string; count: number };

/** A raw query answers an array on the production driver and { rows } on others; both are rows. */
const rowsOf = (result: unknown): CountRow[] =>
  Array.isArray(result) ? (result as CountRow[]) : ((result as { rows?: CountRow[] } | null)?.rows ?? []);

async function getOrCreateRealtimeRule(signal: AlertSignal, tx: RLSTx) {
  const ruleName = `realtime:${signal.kind}`;

  const [existing] = await tx
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.organizationId, signal.organizationId),
        eq(alertRules.name, ruleName),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await tx
    .insert(alertRules)
    .values({
      organizationId: signal.organizationId,
      name: ruleName,
      description: `Real-time observability signal for ${signal.kind}`,
      category: 'realtime-observability',
      triggerType: 'threshold',
      triggerConfig: {
        kind: signal.kind,
        source: 'system:observability-alerts',
      },
      severity: signal.severity,
      frequency: 'every_occurrence',
      isEnabled: true,
      createdBy: 'system:observability-alerts',
    })
    .returning();

  return created;
}

/** One alert per organization, signal and clock hour: the sweep runs on a schedule and its window overlaps the previous run. */
export const alertDedupeKey = (signal: Pick<AlertSignal, 'organizationId' | 'kind'>, at: Date) =>
  `obs:${signal.organizationId}:${signal.kind}:${at.toISOString().slice(0, 13)}`;

export type SignalOutcome = 'emitted' | 'already_alerted' | 'no_recipient';

/**
 * Emits one signal. The rule, the inbox notices, the execution record and the audit entry are written on the sweep's transaction
 * inside a savepoint, so they commit together or not at all and one organization's failure leaves the others untouched.
 *
 * The alert reaches the organization's administrators through the in-app inbox, which is the one channel with a reader. No e-mail
 * is sent or queued, so the execution records only the channel that delivered; it used to record e-mail as an executed action
 * although the queued row it wrote had no sender.
 */
async function emitSignal(signal: AlertSignal, tx: RLSTx, at: Date): Promise<SignalOutcome> {
  const startedAt = Date.now();
  return tx.transaction(async (inner) => {
    const scoped = inner as unknown as RLSTx;
    const recipients = await scoped
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, signal.organizationId),
        inArray(organizationMembers.role, [...ALERT_RECIPIENT_ROLES]),
        eq(organizationMembers.status, 'active'),
        isNull(organizationMembers.deletedAt),
      ))
      .limit(50);

    const rule = await getOrCreateRealtimeRule(signal, scoped);
    const executionId = randomUUID();
    const key = alertDedupeKey(signal, at);

    if (recipients.length === 0) {
      await scoped.insert(alertExecutions).values({
        id: executionId,
        alertRuleId: rule.id,
        triggeredBy: 'threshold',
        triggerData: { organizationId: signal.organizationId, signal: signal.kind, count: signal.count },
        status: 'failed',
        conditionsMet: true,
        conditionsEvaluated: { thresholdMet: true, count: signal.count },
        actionsExecuted: { channels: [], recipients: 0 },
        errorMessage: 'No active administrator to notify',
        startedAt: new Date(startedAt),
        completedAt: new Date(),
        executionTimeMs: Date.now() - startedAt,
      });
      return 'no_recipient' as const;
    }

    const delivered = await scoped
      .insert(inAppNotifications)
      .values(recipients.map((recipient) => ({
        userId: recipient.userId,
        organizationId: signal.organizationId,
        title: 'Realtime Alert',
        message: signal.message,
        type: signal.severity === 'critical' ? 'error' : 'warning',
        actionLabel: 'View alerts',
        actionUrl: '/dashboard/alerts',
        data: { origin: 'system:observability-alerts', signal: signal.kind, executionId, dedupeKey: key, count: signal.count },
      })))
      .onConflictDoNothing()
      .returning({ id: inAppNotifications.id });

    // Every recipient already holds this hour's alert: nothing new happened, so no execution or audit entry is added.
    if (delivered.length === 0) return 'already_alerted' as const;

    await scoped.insert(alertExecutions).values({
      id: executionId,
      alertRuleId: rule.id,
      triggeredBy: 'threshold',
      triggerData: { organizationId: signal.organizationId, signal: signal.kind, count: signal.count },
      status: 'success',
      conditionsMet: true,
      conditionsEvaluated: { thresholdMet: true, count: signal.count },
      actionsExecuted: { channels: ['in_app'], recipients: delivered.length },
      startedAt: new Date(startedAt),
      completedAt: new Date(),
      executionTimeMs: Date.now() - startedAt,
    });

    // Each organization's alert is audited under that organization, in the same savepoint as the alert itself.
    await persistAtomicAudit(scoped, {
      organizationId: signal.organizationId,
      userId: 'system:cron:observability-alerts',
      action: 'observability.alert.emit',
      resourceType: 'alert_executions',
      resourceId: executionId,
      details: { signal: signal.kind, count: signal.count, severity: signal.severity, recipients: delivered.length },
    });

    return 'emitted' as const;
  });
}

export async function runRealtimeObservabilitySweep(): Promise<EmitResult> {
  // Cross-organization signals are read by SYSTEM authority, and every write of an alert goes through the same transaction handle,
  // so the alert and its audit entry commit together (one savepoint per signal).
  return withSystemContext(async (tx) => {
  const slaRows = rowsOf(await tx.execute(sql`
    SELECT organization_id::text, COUNT(*)::int AS count
    FROM ml_predictions
    WHERE prediction_type = 'sla_breach_risk'
      -- Never turn legacy v1 caller-controlled scores into institutional alerts.
      -- v2's uncalibrated score does not currently reach the historical 0.80 threshold;
      -- the SLA watchdog remains the operational overdue/at-risk alert authority.
      AND model_version = ${SLA_MODEL_VERSION}
      AND created_at >= NOW() - INTERVAL '60 minutes'
      AND predicted_value::numeric >= 0.80
    GROUP BY organization_id
  `));

  const ingestionRows = rowsOf(await tx.execute(sql`
    SELECT organization_id::text, COUNT(*)::int AS count
    FROM ingestion_batches
    WHERE created_at >= NOW() - INTERVAL '60 minutes'
      AND status IN ('failed', 'partial')
    GROUP BY organization_id
  `));

  const paymentFailureRows = rowsOf(await tx.execute(sql`
    SELECT organization_id::text, COUNT(*)::int AS count
    FROM platform_payments
    WHERE created_at >= NOW() - INTERVAL '60 minutes'
      AND status = 'failed'
    GROUP BY organization_id
  `));

  const signals: AlertSignal[] = [
    ...slaRows
      .filter((r) => Number(r.count) > 0)
      .map((r) => ({
        organizationId: r.organization_id,
        kind: 'sla_breach_imminent' as const,
        count: Number(r.count),
        severity: Number(r.count) >= 5 ? 'critical' as const : 'high' as const,
        message: `${Number(r.count)} high-risk SLA breach predictions detected in the last 60 minutes.`,
      })),
    ...ingestionRows
      .filter((r) => Number(r.count) > 0)
      .map((r) => ({
        organizationId: r.organization_id,
        kind: 'ingestion_failures' as const,
        count: Number(r.count),
        severity: Number(r.count) >= 3 ? 'critical' as const : 'high' as const,
        message: `${Number(r.count)} ingestion batch failures detected in the last 60 minutes.`,
      })),
    ...paymentFailureRows
      .filter((r) => Number(r.count) > 0)
      .map((r) => ({
        organizationId: r.organization_id,
        kind: 'payment_reconciliation_failures' as const,
        count: Number(r.count),
        severity: Number(r.count) >= 2 ? 'critical' as const : 'high' as const,
        message: `${Number(r.count)} payment reconciliation failures detected in the last 60 minutes.`,
      })),
  ];

  const byKind: Record<string, number> = {
    sla_breach_imminent: 0,
    ingestion_failures: 0,
    payment_reconciliation_failures: 0,
  };
  const failures: EmitResult['failures'] = [];
  let emitted = 0;
  let alreadyAlerted = 0;
  const at = new Date();

  for (const signal of signals) {
    try {
      const outcome = await emitSignal(signal, tx, at);
      if (outcome === 'emitted') {
        emitted += 1;
        byKind[signal.kind] += 1;
      } else if (outcome === 'already_alerted') {
        alreadyAlerted += 1;
      } else {
        failures.push({ organizationId: signal.organizationId, kind: signal.kind, reason: 'no active administrator to notify' });
      }
    } catch (error) {
      logger.error('Observability alert was not emitted', { organizationId: signal.organizationId, kind: signal.kind, error: String(error) });
      failures.push({ organizationId: signal.organizationId, kind: signal.kind, reason: 'alert write failed' });
    }
  }

  return { emitted, alreadyAlerted, byKind, failures };
  });
}

/** Only expose stable, non-identifying signal facts; triggerData is an untrusted JSON payload and may later contain case/member detail. */
const PUBLIC_REALTIME_SIGNALS = new Set([
  'sla_breach_imminent',
  'ingestion_failures',
  'payment_reconciliation_failures',
]);

function publicRealtimeTriggerData(value: unknown): { signal?: string; count?: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  if (typeof data.signal !== 'string' || !PUBLIC_REALTIME_SIGNALS.has(data.signal)) return {};
  if (typeof data.count !== 'number' || !Number.isSafeInteger(data.count) || data.count < 0) {
    return { signal: data.signal };
  }
  return { signal: data.signal, count: data.count };
}

export async function getRecentRealtimeAlerts(organizationId: string, limit = 25) {
  if (!organizationId) throw new Error('Organization context required');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid alert page size');
  // A tenant predicate is not a substitute for executing under the tenant's runtime RLS role.
  const rows = await withRLSContext({ organizationId }, (tx) => tx
    .select({
      executionId: alertExecutions.id,
      status: alertExecutions.status,
      triggerData: alertExecutions.triggerData,
      startedAt: alertExecutions.startedAt,
      completedAt: alertExecutions.completedAt,
      ruleId: alertRules.id,
      ruleName: alertRules.name,
      severity: alertRules.severity,
      category: alertRules.category,
    })
    .from(alertExecutions)
    .innerJoin(alertRules, eq(alertRules.id, alertExecutions.alertRuleId))
    .where(
      and(
        eq(alertRules.organizationId, organizationId),
        eq(alertRules.category, 'realtime-observability'),
      ),
    )
    .orderBy(desc(alertExecutions.createdAt))
    .limit(limit));
  // Redact at the service boundary, so all callers receive the same allowlisted payload.
  return rows.map(({ triggerData, ...row }) => ({ ...row, triggerData: publicRealtimeTriggerData(triggerData) }));
}
