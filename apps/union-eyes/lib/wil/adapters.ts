/**
 * WIL Data Adapters
 *
 * Implements the WorkItemSource and IntakeSource ports required by
 * the WIL orchestrator, backed by the union-eyes grievances table.
 */

import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { eq } from 'drizzle-orm';
import type {
  WorkItemSource,
  IntakeSource,
  WorkItem,
  IntakeSubmission,
} from '@nzila/workload-intelligence';

const ACTIVE_CASE_STATUSES = ['filed', 'step_1', 'step_2', 'step_3', 'arbitration', 'mediation'];
const PENDING_INTAKE_STATUSES = ['draft'];

/**
 * Fetches active official cases from the grievances table.
 */
export function createWorkItemSource(): WorkItemSource {
  return {
    async fetchActiveWorkItems(orgId: string): Promise<readonly WorkItem[]> {
      const rows = await db
        .select()
        .from(grievances)
        .where(eq(grievances.organizationId, orgId));

      return rows
        .filter((r) => ACTIVE_CASE_STATUSES.includes(r.status))
        .map((r) => ({
          id: r.id,
          orgId: r.organizationId,
          type: 'grievance' as const,
          title: r.title ?? 'Untitled',
          description: r.description ?? undefined,
          createdAt: new Date(r.createdAt).toISOString(),
          dueAt: undefined,
          stakeholders: r.createdBy ? [r.createdBy] : [],
          urgencySignals: mapUrgencyFromPriority(r.priority),
          riskSignals: [],
          strategicSignals: [],
          metadata: { grievanceNumber: r.grievanceNumber, status: r.status },
        }));
    },
  };
}

/**
 * Fetches pending intake submissions from the grievances table.
 */
export function createIntakeSource(): IntakeSource {
  return {
    async fetchPendingIntakes(orgId: string): Promise<readonly IntakeSubmission[]> {
      const rows = await db
        .select()
        .from(grievances)
        .where(eq(grievances.organizationId, orgId));

      return rows
        .filter((r) => PENDING_INTAKE_STATUSES.includes(r.status))
        .map((r) => ({
          id: r.id,
          orgId: r.organizationId,
          submittedByMemberId: r.createdBy ?? 'unknown',
          title: r.title ?? 'Untitled',
          description: r.description ?? '',
          submittedAt: new Date(r.createdAt).toISOString(),
          attachments: [],
          urgencyIndicators: mapUrgencyFromPriority(r.priority),
          status: 'new' as const,
          metadata: { grievanceNumber: r.grievanceNumber },
        }));
    },
  };
}

function mapUrgencyFromPriority(priority: string | null) {
  if (priority === 'urgent') {
    return [{ type: 'escalation' as const, weight: 0.9 }];
  }
  if (priority === 'high') {
    return [{ type: 'member_pressure' as const, weight: 0.7 }];
  }
  return [];
}
