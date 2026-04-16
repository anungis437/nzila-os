import { db } from '@/db';
import {
  alertExecutions,
  alertRules,
  inAppNotifications,
  notificationTracking,
} from '@/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

interface AlertSignal {
  organizationId: string;
  kind: 'sla_breach_imminent' | 'ingestion_failures' | 'payment_reconciliation_failures';
  count: number;
  severity: 'high' | 'critical';
  message: string;
}

interface EmitResult {
  emitted: number;
  byKind: Record<string, number>;
}

async function getOrCreateRealtimeRule(signal: AlertSignal) {
  const ruleName = `realtime:${signal.kind}`;

  const [existing] = await db
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

  const [created] = await db
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

async function emitSignal(signal: AlertSignal) {
  const rule = await getOrCreateRealtimeRule(signal);

  const [execution] = await db
    .insert(alertExecutions)
    .values({
      alertRuleId: rule.id,
      triggeredBy: 'threshold',
      triggerData: {
        organizationId: signal.organizationId,
        signal: signal.kind,
        count: signal.count,
      },
      status: 'success',
      conditionsMet: true,
      conditionsEvaluated: {
        thresholdMet: true,
        count: signal.count,
      },
      actionsExecuted: {
        channels: ['email', 'in_app'],
      },
      startedAt: new Date(),
      completedAt: new Date(),
      executionTimeMs: 1,
    })
    .returning();

  await db.insert(notificationTracking).values({
    organizationId: signal.organizationId,
    type: signal.kind === 'payment_reconciliation_failures' ? 'payment_failed' : 'system_announcement',
    status: 'pending',
    priority: signal.severity === 'critical' ? 'urgent' : 'high',
    subject: `[${signal.severity.toUpperCase()}] ${signal.kind.replaceAll('_', ' ')}`,
    body: signal.message,
    templateData: {
      signal: signal.kind,
      count: signal.count,
      executionId: execution.id,
    },
    metadata: {
      source: 'system:observability-alerts',
      executionId: execution.id,
      organizationId: signal.organizationId,
    },
  });

  await db.insert(inAppNotifications).values({
    userId: 'system:observability-alerts',
    organizationId: signal.organizationId,
    title: 'Realtime Alert',
    message: signal.message,
    type: signal.severity === 'critical' ? 'error' : 'warning',
    data: {
      signal: signal.kind,
      executionId: execution.id,
    },
  });

  return execution;
}

export async function runRealtimeObservabilitySweep(): Promise<EmitResult> {
  const slaRows = await db.execute<{
    organization_id: string;
    count: number;
  }>(sql`
    SELECT organization_id::text, COUNT(*)::int AS count
    FROM ml_predictions
    WHERE prediction_type = 'sla_breach_risk'
      AND created_at >= NOW() - INTERVAL '60 minutes'
      AND predicted_value::numeric >= 0.80
    GROUP BY organization_id
  `);

  const ingestionRows = await db.execute<{
    organization_id: string;
    count: number;
  }>(sql`
    SELECT organization_id::text, COUNT(*)::int AS count
    FROM ingestion_batches
    WHERE created_at >= NOW() - INTERVAL '60 minutes'
      AND status IN ('failed', 'partial')
    GROUP BY organization_id
  `);

  const paymentFailureRows = await db.execute<{
    organization_id: string;
    count: number;
  }>(sql`
    SELECT organization_id::text, COUNT(*)::int AS count
    FROM platform_payments
    WHERE created_at >= NOW() - INTERVAL '60 minutes'
      AND status = 'failed'
    GROUP BY organization_id
  `);

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

  for (const signal of signals) {
    await emitSignal(signal);
    byKind[signal.kind] += 1;
  }

  return {
    emitted: signals.length,
    byKind,
  };
}

export async function getRecentRealtimeAlerts(organizationId: string, limit = 25) {
  const rows = await db
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
    .limit(limit);

  return rows;
}
