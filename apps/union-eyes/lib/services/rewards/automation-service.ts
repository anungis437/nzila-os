/**
 * Automated Award Triggers Service
 * Handles automatic award creation based on predefined rules and milestones
 */

import { db } from '@/db';
import { automationRules } from '@/db/schema/recognition-rewards-schema';
import { organizations } from '@/db/schema';
import { createAwardRequest, issueAward } from './award-service';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

type AutomationRuleRow = typeof automationRules.$inferSelect;
type AutomationRuleInsert = typeof automationRules.$inferInsert;

interface AnniversaryRow {
  user_id: string;
  user_name: string | null;
  joined_at: Date | string;
  years_of_service: number | string;
}

type AutomationConditions = {
  metric?: string;
  operator?: 'eq' | 'gt' | 'gte' | 'lt' | 'lte';
  value?: number;
  schedule?: string;
};

function getAutomationConditions(value: unknown): AutomationConditions {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    metric: typeof record.metric === 'string' ? record.metric : undefined,
    operator:
      record.operator === 'eq' ||
      record.operator === 'gt' ||
      record.operator === 'gte' ||
      record.operator === 'lt' ||
      record.operator === 'lte'
        ? record.operator
        : undefined,
    value: typeof record.value === 'number' ? record.value : undefined,
    schedule: typeof record.schedule === 'string' ? record.schedule : undefined,
  };
}

export interface AutomationRule {
  id: string;
  orgId: string;
  name: string;
  triggerType: 'anniversary' | 'milestone' | 'metric' | 'scheduled';
  awardTypeId: string;
  conditions: {
    metric?: string; // e.g., 'years_of_service', 'contracts_closed', 'satisfaction_score'
    operator?: 'eq' | 'gt' | 'gte' | 'lt' | 'lte';
    value?: number;
    schedule?: string; // cron expression for scheduled awards
  };
  creditsToAward: number;
  message?: string;
  isActive: boolean;
}

/**
 * Check and trigger anniversary awards
 * Should be run daily as a scheduled job
 */
export async function processAnniversaryAwards(orgId: string) {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // Get anniversary award type (should be configured in settings)
    // ROUND 50 SECURITY FIX: previously matched by name+kind alone with no
    // org filter, so a cron run for one organization could pick up ANOTHER
    // organization's "Work Anniversary" award type (cross-tenant data
    // confusion in a system-invoked job) and issue awards using its
    // programId/credit rules/approval settings.
    const anniversaryAwardType = await db.query.recognitionAwardTypes.findFirst({
      where: (types, { eq, and }) =>
        and(
          eq(types.orgId, orgId),
          eq(types.name, 'Work Anniversary'),
          eq(types.kind, 'automated')
        ),
    });

    if (!anniversaryAwardType) {
      logger.warn('[Automation] No anniversary award type found', { orgId });
      return { success: true, processed: 0 };
    }

    // Two overlapping runs (retries, a slow run still going when the next fires) must not both read "not yet awarded" and
    // both issue. A transaction-scoped advisory lock keyed on organization and award type makes the second run wait until
    // the first has committed its awards, and then it sees them. The lock is released when this transaction ends.
    return await db.transaction(async (lockTx) => {
    await lockTx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`anniversary-awards:${orgId}:${anniversaryAwardType.id}`}, 0))`);

    // Find active members with anniversaries today who have not already been given today's award. The job is triggered by a
    // schedule that can fire more than once a day; an award already created today for this member and type, in any state,
    // means this anniversary has been handled. Only active members are rewarded: a suspended or removed member is not.
    const query = sql`
      SELECT 
        om.user_id,
        om.name AS user_name,
        om.joined_at,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, om.joined_at)) as years_of_service
      FROM organization_members om
      WHERE om.organization_id = ${orgId}
        AND om.status = 'active'
        AND om.deleted_at IS NULL
        AND EXTRACT(MONTH FROM om.joined_at) = ${currentMonth}
        AND EXTRACT(DAY FROM om.joined_at) = ${currentDay}
        AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, om.joined_at)) > 0
        AND NOT EXISTS (
          SELECT 1 FROM recognition_awards ra
          WHERE ra.org_id = om.organization_id
            AND ra.recipient_user_id = om.user_id
            AND ra.award_type_id = ${anniversaryAwardType.id}
            AND ra.created_at >= date_trunc('day', now())
        )
    `;

    const result = await lockTx.execute(query);
    const anniversaries = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as unknown as AnniversaryRow[];
    const [organization] = await lockTx
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    const organizationName = organization?.name?.trim() || 'the union';

    let processed = 0;
    let failed = 0;

    for (const anniversary of anniversaries) {
      try {
        const yearsOfService = Number(anniversary.years_of_service);
        // The credits are the award type's own configured amount (issueAward reads it); the union sets them per award type. A
        // years-of-service scale computed here was never applied, so none is implied.
        const reason = `Congratulations on ${yearsOfService} ${yearsOfService === 1 ? 'year' : 'years'} with ${organizationName}! Thank you for your dedication and commitment.`;

        // Creating and issuing one member's award is one savepoint: a failure in either step rolls back both, so no approved award is
        // left un-issued and never retried, and one member's failure does not abort the others' work in this transaction.
        await lockTx.transaction(async (memberTx) => {
          const member = memberTx as unknown as typeof db;
          const award = await createAwardRequest({
            orgId,
            programId: anniversaryAwardType.programId,
            awardTypeId: anniversaryAwardType.id,
            recipientUserId: anniversary.user_id,
            issuerUserId: 'system', // System-generated
            reason,
            metadataJson: { anniversaryYears: yearsOfService },
            executor: member,
          });

          // Automatically approve and issue anniversary awards
          if (award && !anniversaryAwardType.requiresApproval) {
            await issueAward({ awardId: award.id, orgId, executor: member });
          }
        });

        processed++;
      } catch (error) {
        failed++;
        logger.error('[Automation] Failed to process anniversary', {
          error,
          orgId,
          userId: anniversary.user_id,
        });
      }
    }

    // A member whose award could not be made is a failed run for the scheduler, not a processed count of fewer.
    return { success: failed === 0, processed, failed };
    });
  } catch (error) {
    logger.error('[Automation] Error processing anniversary awards', { error, orgId });
    return { success: false, error };
  }
}


/**
 * Check and trigger milestone-based awards
 * Examples: First contract closed, 100 cases resolved, etc.
 */
export async function processMilestoneAwards(
  orgId: string,
  userId: string,
  milestoneType: string,
  currentValue: number
) {
  try {
    // Get milestone automation rules from database
    const rules = await db
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.orgId, orgId),
          eq(automationRules.triggerType, 'milestone'),
          eq(automationRules.isActive, true)
        )
      );

    const triggeredRules = rules.filter((rule: AutomationRuleRow) => {
      const conditions = getAutomationConditions(rule.conditions);
      if (conditions.metric !== milestoneType) return false;

      switch (conditions.operator) {
        case 'eq':
          return currentValue === conditions.value;
        case 'gt':
          return currentValue > (conditions.value ?? Number.NaN);
        case 'gte':
          return currentValue >= (conditions.value ?? Number.NaN);
        case 'lt':
          return currentValue < (conditions.value ?? Number.NaN);
        case 'lte':
          return currentValue <= (conditions.value ?? Number.NaN);
        default:
          return false;
      }
    });

    let processed = 0;

    for (const rule of triggeredRules) {
      try {
        // Check if award already issued for this milestone
        const existingAward = await db.query.recognitionAwards.findFirst({
          where: (awards, { eq, and }) =>
            and(
              eq(awards.orgId, orgId),
              eq(awards.recipientUserId, userId),
              eq(awards.awardTypeId, rule.awardTypeId),
              sql`awards.metadata->>'milestone_value' = ${currentValue.toString()}`
            ),
        });

        if (existingAward) {
          continue; // Already awarded for this milestone
        }

        const award = await createAwardRequest({
          orgId,
          programId: '',
          awardTypeId: rule.awardTypeId,
          recipientUserId: userId,
          issuerUserId: 'system',
          reason: rule.description || `Congratulations on reaching ${currentValue} ${milestoneType}!`,
          metadataJson: {
            automation_rule_id: rule.id,
            milestone_type: milestoneType,
            milestone_value: currentValue,
          },
        });

        // Auto-issue if no approval required
        const awardType = await db.query.recognitionAwardTypes.findFirst({
          where: (types, { eq }) => eq(types.id, rule.awardTypeId),
        });

        if (award && awardType && !awardType.requiresApproval) {
          await issueAward({
            awardId: award.id,
            orgId,
          });
        }

        processed++;
      } catch (error) {
        logger.error('[Automation] Failed to process milestone award', {
          error,
          orgId,
          userId,
          ruleId: rule.id,
        });
      }
    }

    return { success: true, processed };
  } catch (error) {
    logger.error('[Automation] Error processing milestone awards', {
      error,
      orgId,
      userId,
      milestoneType,
    });
    return { success: false, error };
  }
}

/**
 * Check and trigger metric-based awards
 * Examples: Performance rating threshold, customer satisfaction score
 */
export async function processMetricAwards(
  orgId: string,
  userId: string,
  metricName: string,
  metricValue: number
) {
  try {
    // Similar to milestone awards but for continuous metrics
    return await processMilestoneAwards(orgId, userId, metricName, metricValue);
  } catch (error) {
    logger.error('[Automation] Error processing metric awards', {
      error,
      orgId,
      userId,
      metricName,
    });
    return { success: false, error };
  }
}

/**
 * Process scheduled awards (e.g., monthly top performer)
 * Should be triggered by cron job
 */
export async function processScheduledAwards(orgId: string) {
  try {
    // A scheduled rule names an award type and a cron expression but nothing that says who earns the award (a top performer by
    // which measure, over what period), so no award can be derived from it. The rules are reported as skipped, never as processed,
    // so a response cannot claim work that was not done.
    const rules = await db
      .select({ id: automationRules.id })
      .from(automationRules)
      .where(
        and(
          eq(automationRules.orgId, orgId),
          eq(automationRules.triggerType, 'scheduled'),
          eq(automationRules.isActive, true)
        )
      );

    if (rules.length > 0) {
      logger.warn('[Automation] Scheduled award rules are not evaluated: they define no recipient selection', {
        orgId,
        rules: rules.length,
      });
    }

    return { success: true, processed: 0, skipped: rules.length };
  } catch (error) {
    logger.error('[Automation] Error processing scheduled awards', { error, orgId });
    return { success: false, error };
  }
}

/**
 * Create automation rule
 */
export async function createAutomationRule(rule: {
  orgId: string;
  name: string;
  description?: string;
  triggerType: string;
  conditions?: Record<string, unknown>;
  awardTypeId: string;
  creditAmount?: number;
  schedule?: string;
  createdBy?: string;
}) {
  try {
    const newRuleValues: AutomationRuleInsert = {
      orgId: rule.orgId,
      name: rule.name,
      description: rule.description,
      triggerType: rule.triggerType,
      conditions: rule.conditions,
      awardTypeId: rule.awardTypeId,
      creditAmount: rule.creditAmount || 0,
      schedule: rule.schedule,
      isActive: true,
      createdBy: rule.createdBy,
    };

    const [newRule] = await db
      .insert(automationRules)
      .values(newRuleValues)
      .returning();

    logger.info('[Automation] Rule created successfully', { ruleId: newRule.id, name: rule.name });
    return { success: true, rule: newRule };
  } catch (error) {
    logger.error('[Automation] Failed to create automation rule', { error, orgId: rule.orgId });
    return { success: false, error };
  }
}

/**
 * Update automation rule
 */
export async function updateAutomationRule(ruleId: string, organizationId: string, updates: Partial<{
  name: string;
  description: string;
  conditions: Record<string, unknown>;
  creditAmount: number;
  schedule: string;
  isActive: boolean;
}>) {
  try {
    const [updatedRule] = await db
      .update(automationRules)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(automationRules.id, ruleId), eq(automationRules.orgId, organizationId)))
      .returning();

    if (!updatedRule) {
      return { success: false, error: 'Rule not found' };
    }

    logger.info('[Automation] Rule updated successfully', { ruleId });
    return { success: true, rule: updatedRule };
  } catch (error) {
    logger.error('[Automation] Failed to update automation rule', { error, ruleId });
    return { success: false, error };
  }
}

/**
 * Delete automation rule
 */
export async function deleteAutomationRule(ruleId: string, organizationId: string) {
  try {
    const _result = await db
      .delete(automationRules)
      .where(and(eq(automationRules.id, ruleId), eq(automationRules.orgId, organizationId)));

    logger.info('[Automation] Rule deleted successfully', { ruleId });
    return { success: true };
  } catch (error) {
    logger.error('[Automation] Failed to delete automation rule', { error, ruleId });
    return { success: false, error };
  }
}

