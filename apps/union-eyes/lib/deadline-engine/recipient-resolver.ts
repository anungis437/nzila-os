/**
 * Union Eyes Deadline Engine — recipient resolver
 *
 * Resolves the set of recipients for a grievance deadline reminder. The
 * resolved set is CAPTURED at schedule time (see reminder-scheduler.ts) so
 * the DB row holds an immutable snapshot; the worker never re-resolves at
 * delivery time.
 *
 * Wave 1 Phase A scope: grievor (email captured on the grievance) +
 * assigned officer (looked up via users.userId). Org admin escalation is
 * marked NOT_IMPLEMENTED for Phase A and MUST land in Phase B.
 */
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { grievances } from '@/db/schema/grievance-schema';
import { users } from '@/db/schema/user-management-schema';
import { logger } from '@/lib/logger';
import type { RecipientSnapshot } from './types';

export interface ResolveRecipientsInput {
  sourceTable: 'grievance_deadlines' | 'claim_deadlines';
  sourceDeadlineId: string;
  grievanceId?: string | null;
  correlationId: string;
}

export interface ResolveRecipientsResult {
  organizationId: string;
  recipients: RecipientSnapshot[];
  skipped: Array<{ role: string; reason: string }>;
}

/**
 * Resolve the recipient snapshot for a grievance deadline reminder.
 * Throws if the caller's assumptions cannot be satisfied (unknown deadline,
 * missing grievance, etc.). Returns a stable snapshot the scheduler can
 * persist alongside the reminder row.
 */
export async function resolveGrievanceDeadlineRecipients(
  input: ResolveRecipientsInput,
): Promise<ResolveRecipientsResult> {
  if (input.sourceTable !== 'grievance_deadlines') {
    // Phase A only supports grievance-schema deadlines. claim_deadlines
    // (from db/schema/deadlines-schema.ts) requires additional wiring:
    // claim.assigneeId, claim.organizationId, escalatedTo lookup. That
    // arrives in Phase B; fail loudly rather than silently missing a
    // reminder path.
    throw new Error(
      `deadline-engine.recipient: source table ${input.sourceTable} not yet supported (Phase A grievance-only)`,
    );
  }

  if (!input.grievanceId) {
    throw new Error('deadline-engine.recipient: grievanceId is required for grievance deadlines');
  }

  const [grievance] = await db
    .select({
      id: grievances.id,
      organizationId: grievances.organizationId,
      grievantId: grievances.grievantId,
      grievantEmail: grievances.grievantEmail,
      grievantName: grievances.grievantName,
      unionRepId: grievances.unionRepId,
    })
    .from(grievances)
    .where(eq(grievances.id, input.grievanceId))
    .limit(1);

  if (!grievance) {
    throw new Error(
      `deadline-engine.recipient: grievance ${input.grievanceId} not found (deadline ${input.sourceDeadlineId})`,
    );
  }

  const recipients: RecipientSnapshot[] = [];
  const skipped: Array<{ role: string; reason: string }> = [];

  // 1. Grievor (from intake-time snapshot on the grievance row)
  if (grievance.grievantEmail) {
    recipients.push({
      userId: grievance.grievantId ?? null,
      role: 'grievor',
      email: grievance.grievantEmail.trim().toLowerCase(),
      locale: 'en',
    });
  } else {
    skipped.push({
      role: 'grievor',
      reason: 'grievance has no grievant email captured at intake',
    });
  }

  // 2. Assigned union rep / officer — look up email via users table
  if (grievance.unionRepId) {
    const [rep] = await db
      .select({ userId: users.userId, email: users.email, locale: users.locale })
      .from(users)
      .where(
        and(
          eq(users.userId, String(grievance.unionRepId)),
          eq(users.isActive, true),
          isNull(users.accountLockedUntil),
          isNotNull(users.email),
        ),
      )
      .limit(1);

    if (rep?.email) {
      recipients.push({
        userId: rep.userId,
        role: 'assigned_officer',
        email: rep.email.trim().toLowerCase(),
        locale: normaliseLocale(rep.locale),
      });
    } else {
      skipped.push({
        role: 'assigned_officer',
        reason: `user ${grievance.unionRepId} not found, inactive, or missing email`,
      });
    }
  } else {
    skipped.push({ role: 'assigned_officer', reason: 'grievance has no unionRepId' });
  }

  // 3. Org admin escalation — Phase B (requires org.slug → members.organizationId lookup)
  skipped.push({
    role: 'org_admin',
    reason: 'Phase B — escalation recipients not implemented in Wave 1 Phase A',
  });

  // Dedupe by email (a single user may hold multiple roles on a grievance).
  // First-wins so the primary role (grievor, then officer) is preserved.
  const seen = new Set<string>();
  const deduped = recipients.filter((r) => {
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  logger.info('deadline-engine.recipient: resolved', {
    correlationId: input.correlationId,
    sourceDeadlineId: input.sourceDeadlineId,
    grievanceId: input.grievanceId,
    resolvedCount: deduped.length,
    skippedCount: skipped.length,
  });

  return {
    organizationId: grievance.organizationId,
    recipients: deduped,
    skipped,
  };
}

function normaliseLocale(raw: string | null | undefined): string {
  if (!raw) return 'en';
  const trimmed = raw.trim();
  if (!trimmed) return 'en';
  // Reduce full BCP-47 tags (en-CA, fr-CA) to the primary language for the
  // reminder template. The template layer decides whether to honour the
  // regional variant.
  return trimmed.slice(0, 2).toLowerCase();
}
