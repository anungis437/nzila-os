/**
 * Automated Award Triggers Service
 * Handles automatic award creation based on predefined rules and milestones
 */

import { db } from '@/db';
import { automationRules } from '@/db/schema/recognition-rewards-schema';
import { createAwardRequest, issueAward } from './award-service';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

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

    // Find members with anniversaries today
    const query = sql`
      SELECT 
        om.user_id,
        om.user_name,
        om.joined_at,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, om.joined_at)) as years_of_service
      FROM organization_members om
      WHERE om.organization_id = ${orgId}
        AND EXTRACT(MONTH FROM om.joined_at) = ${currentMonth}
        AND EXTRACT(DAY FROM om.joined_at) = ${currentDay}
        AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, om.joined_at)) > 0
    `;

    const result = await db.execute(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anniversaries = result as any[];
    // Get anniversary award type (should be configured in settings)
    const anniversaryAwardType = await db.query.recognitionAwardTypes.findFirst({
      where: (types, { eq, and }) =>
        and(
          eq(types.name, 'Work Anniversary'),
          eq(types.kind, 'automated')
        ),
    });

    if (!anniversaryAwardType) {
      logger.warn('[Automation] No anniversary award type found', { orgId });
      return { success: true, processed: 0 };
    }

    let processed = 0;

    for (const anniversary of anniversaries) {
      try {
        const yearsOfService = Number(anniversary.years_of_service);
        const _creditsToAward = calculateAnniversaryCredits(yearsOfService);
        const reason = `Congratulations on ${yearsOfService} ${yearsOfService === 1 ? 'year' : 'years'} with ${orgId}! Thank you for your dedication and commitment.`;

        // Create and auto-issue the award
        const award = await createAwardRequest({
          orgId,
          programId: anniversaryAwardType.programId,
          awardTypeId: anniversaryAwardType.id,
          recipientUserId: anniversary.user_id,
          issuerUserId: 'system', // System-generated
          reason,
        });

        // Automatically approve and issue anniversary awards
        if (award && !anniversaryAwardType.requiresApproval) {
          await issueAward({
            awardId: award.id,
            orgId,
          });
        }

        processed++;
      } catch (error) {
        logger.error('[Automation] Failed to process anniversary', {
          error,
          orgId,
          userId: anniversary.user_id,
        });
      }
    }

    return { success: true, processed };
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(automationRules.orgId, orgId as any),
          eq(automationRules.triggerType, 'milestone'),
          eq(automationRules.isActive, true)
        )
      );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const triggeredRules = rules.filter((rule: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions = rule.conditions as any;
      if (conditions?.metric !== milestoneType) return false;

      switch (conditions?.operator) {
        case 'eq':
          return currentValue === conditions?.value;
        case 'gt':
          return currentValue > conditions?.value;
        case 'gte':
          return currentValue >= conditions?.value;
        case 'lt':
          return currentValue < conditions?.value;
        case 'lte':
          return currentValue <= conditions?.value;
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
    // Get scheduled automation rules from database
    const rules = await db
      .select()
      .from(automationRules)
      .where(
        and(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(automationRules.orgId, orgId as any),
          eq(automationRules.triggerType, 'scheduled'),
          eq(automationRules.isActive, true)
        )
      );

    let processed = 0;

    for (const rule of rules) {
      try {
        // Implement scheduled logic based on rule.conditions.schedule
        // This is a placeholder for cron-based scheduling
        logger.info('[Automation] Processing scheduled rule', {
          orgId,
          ruleId: rule.id,
          ruleName: rule.name,
        });
        processed++;
      } catch (error) {
        logger.error('[Automation] Failed to process scheduled rule', {
          error,
          orgId,
          ruleId: rule.id,
        });
      }
    }

    return { success: true, processed };
  } catch (error) {
    logger.error('[Automation] Error processing scheduled awards', { error, orgId });
    return { success: false, error };
  }
}

/**
 * Helper: Calculate anniversary credits based on years of service
 */
function calculateAnniversaryCredits(years: number): number {
  // Progressive scale: more years = more credits
  if (years <= 1) return 50;
  if (years <= 3) return 100;
  if (years <= 5) return 200;
  if (years <= 10) return 300;
  return 500; // 10+ years
}

/**
 * Create automation rule
 */
export async function createAutomationRule(rule: {
  orgId: string;
  name: string;
  description?: string;
  triggerType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditions?: Record<string, any>;
  awardTypeId: string;
  creditAmount?: number;
  schedule?: string;
  createdBy?: string;
}) {
  try {
    const [newRule] = await db
      .insert(automationRules)
      .values({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orgId: rule.orgId as any,
        name: rule.name,
        description: rule.description,
        triggerType: rule.triggerType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        conditions: rule.conditions as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        awardTypeId: rule.awardTypeId as any,
        creditAmount: rule.creditAmount || 0,
        schedule: rule.schedule,
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createdBy: rule.createdBy as any,
      })
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
export async function updateAutomationRule(ruleId: string, updates: Partial<{
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditions: Record<string, any>;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(automationRules.id, ruleId as any))
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
export async function deleteAutomationRule(ruleId: string) {
  try {
    const _result = await db
      .delete(automationRules)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(automationRules.id, ruleId as any));

    logger.info('[Automation] Rule deleted successfully', { ruleId });
    return { success: true };
  } catch (error) {
    logger.error('[Automation] Failed to delete automation rule', { error, ruleId });
    return { success: false, error };
  }
}

