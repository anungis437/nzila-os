import { createHash } from 'node:crypto';
import { z } from 'zod';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { complianceAlerts, employerReports, employers, grievances, statutoryRuleVersions } from '@/db/schema';
import { productionGrievanceCondition } from '@/lib/pilot/demo-provenance';

export const dynamic = 'force-dynamic';
const EVALUATOR_VERSION = 'employer-grievance-compliance-v1';
type AlertInsert = typeof complianceAlerts.$inferInsert;

const bodySchema = z.object({ sourceEventType: z.literal('grievance'), sourceEventId: zUUID }).strict();
const ALERT_TYPES = new Set(['contract_violation', 'safety_violation', 'dispatch_non_compliance', 'reporting_overdue', 'grievance_spike', 'dues_non_remittance']);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

const jurisdictionFromProvince = (value: unknown) => {
  if (typeof value !== 'string') return 'CA-FED';
  const province = value.trim().toUpperCase();
  return province.length === 2 ? `CA-${province}` : 'CA-FED';
};

const canonicalDigest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const POST = withApi(
  { auth: { required: true, minRole: 'steward' }, requireOrg: true, body: bodySchema, openapi: { tags: ['Compliance'], summary: 'Evaluate an authentic employer event with reviewed compliance rules' } },
  async ({ organizationId, userId, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    return withRLSContext({ organizationId }, async (tx) => {
      const [event] = await tx
        .select({
          id: grievances.id,
          employerId: grievances.employerId,
          organizationId: grievances.organizationId,
          type: grievances.type,
          status: grievances.status,
          priority: grievances.priority,
          incidentDate: grievances.incidentDate,
          createdAt: grievances.createdAt,
          updatedAt: grievances.updatedAt,
          employerAddress: employers.mainAddress,
        })
        .from(grievances)
        .innerJoin(employers, and(eq(employers.id, grievances.employerId), eq(employers.organizationId, organizationId)))
        .where(and(eq(grievances.id, body.sourceEventId), eq(grievances.organizationId, organizationId), productionGrievanceCondition()))
        .limit(1);
      if (!event) throw ApiError.notFound('Employer grievance event');
      if (!event.employerId) throw ApiError.conflict('The grievance is not bound to an employer');

      const eventDate = event.incidentDate ?? event.createdAt;
      const jurisdiction = jurisdictionFromProvince((event.employerAddress as Record<string, unknown> | null)?.province);
      const rules = await tx.select().from(statutoryRuleVersions).where(and(
        eq(statutoryRuleVersions.jurisdiction, jurisdiction),
        eq(statutoryRuleVersions.category, 'employer_compliance'),
        eq(statutoryRuleVersions.status, 'reviewed'),
        lte(statutoryRuleVersions.effectiveFrom, eventDate),
        or(isNull(statutoryRuleVersions.effectiveUntil), gt(statutoryRuleVersions.effectiveUntil, eventDate)),
      ));
      const duplicateKeys = rules.some((rule, index) => rules.findIndex((candidate) => candidate.ruleKey === rule.ruleKey) !== index);
      const governed = rules.length > 0 && !duplicateKeys;
      const sourceRevision = canonicalDigest({ id: event.id, employerId: event.employerId, type: event.type, status: event.status, priority: event.priority, incidentDate: event.incidentDate?.toISOString() ?? null, updatedAt: event.updatedAt.toISOString() });

      const [existing] = await tx.select().from(employerReports).where(and(
        eq(employerReports.employerId, event.employerId),
        eq(employerReports.sourceEventType, body.sourceEventType),
        eq(employerReports.sourceEventId, event.id),
        eq(employerReports.sourceRevision, sourceRevision),
        eq(employerReports.evaluatorVersion, EVALUATOR_VERSION),
      )).limit(1);
      if (existing) return { data: existing, replayed: true };

      const matches = governed ? rules.flatMap((rule) => {
        const payload = rule.payload as Record<string, unknown>;
        const when = payload.when && typeof payload.when === 'object' ? payload.when as Record<string, unknown> : {};
        const includes = (key: string, actual: unknown) => !Array.isArray(when[key]) || (when[key] as unknown[]).includes(actual);
        if (!includes('priorityIn', event.priority) || !includes('statusIn', event.status) || !includes('typeIn', event.type)) return [];
        const alert = payload.alert && typeof payload.alert === 'object' ? payload.alert as Record<string, unknown> : null;
        if (!alert || typeof alert.type !== 'string' || !ALERT_TYPES.has(alert.type) || typeof alert.severity !== 'string' || !SEVERITIES.has(alert.severity)) return [];
        return [{ rule, alertType: alert.type, severity: alert.severity, message: typeof alert.message === 'string' ? alert.message.slice(0, 2000) : `Reviewed rule ${rule.ruleKey} matched employer event ${event.id}` }];
      }) : [];

      const now = new Date();
      await tx.update(complianceAlerts).set({ resolvedAt: now }).where(and(eq(complianceAlerts.orgId, organizationId), eq(complianceAlerts.sourceEventType, body.sourceEventType), eq(complianceAlerts.sourceEventId, event.id), isNull(complianceAlerts.resolvedAt)));
      const [report] = await tx.insert(employerReports).values({
        employerId: event.employerId,
        reportType: 'incident_report',
        sourceEventType: body.sourceEventType,
        sourceEventId: event.id,
        sourceRevision,
        evaluatorVersion: EVALUATOR_VERSION,
        ruleVersionId: matches.length === 1 ? matches[0].rule.id : null,
        evaluationStatus: governed ? 'governed' : 'unknown',
        dataJson: governed
          ? { jurisdiction, eventDate: eventDate.toISOString(), ruleVersions: rules.map((rule) => ({ id: rule.id, key: rule.ruleKey, version: rule.version, sourceDigest: rule.sourceDigest })), matchedAlertCount: matches.length }
          : { jurisdiction, eventDate: eventDate.toISOString(), result: 'unknown', reason: duplicateKeys ? 'overlapping_reviewed_versions' : 'no_reviewed_rule_for_event_date' },
      }).returning();
      const alerts = [];
      for (const match of matches) {
        const [alert] = await tx.insert(complianceAlerts).values({ orgId: organizationId, employerId: event.employerId, alertType: match.alertType as AlertInsert['alertType'], severity: match.severity as AlertInsert['severity'], message: match.message, sourceEventType: body.sourceEventType, sourceEventId: event.id, sourceRevision, evaluatorVersion: EVALUATOR_VERSION, ruleVersionId: match.rule.id }).onConflictDoNothing().returning();
        if (alert) alerts.push(alert);
      }
      await persistAtomicAudit(tx, { organizationId, userId, action: 'compliance.employer_event.evaluated', resourceType: 'employer_reports', resourceId: report.id, details: { sourceEventType: body.sourceEventType, sourceEventId: event.id, sourceRevision, evaluatorVersion: EVALUATOR_VERSION, evaluationStatus: report.evaluationStatus, ruleVersionIds: rules.map((rule) => rule.id), alertIds: alerts.map((alert) => alert.id) } });
      return { data: report, alerts, replayed: false };
    });
  },
);
