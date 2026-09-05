/**
 * Automated Billing Scheduler
 * 
 * Phase 2: Dues & Payments - Automated Billing
 * 
 * Schedules and executes automated billing cycles for all organizations
 * based on their billing frequency configuration.
 * 
 * Execution Schedule:
 * - Monthly: 1st of month at 00:00 UTC
 * - Bi-weekly: Every other Monday at 00:00 UTC
 * - Weekly: Every Monday at 00:00 UTC
 * 
 * Features:
 * - Multi-organization support
 * - Error handling with retry logic
 * - Notification on completion/failure
 * - Execution logging for audit
 * 
 * @module lib/jobs/billing-scheduler
 */

import { db } from '@/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { organizationBillingConfig } from '@/db/schema/domains/finance/billing-config';
import { BillingCycleService, type BillingFrequency } from '@/lib/services/billing-cycle-service';
import { logger } from '@/lib/logger';
import { eq, and, inArray, or } from 'drizzle-orm';
import { getNotificationService } from '@/lib/services/notification-service';

// =============================================================================
// TYPES
// =============================================================================

interface BillingScheduleConfig {
  organizationId: string;
  organizationName: string;
  frequency: BillingFrequency;
  enabled: boolean;
}

interface BillingSchedulerResult {
  totalOrganizations: number;
  successful: number;
  failed: number;
  skipped: number;
  results: Array<{
    organizationId: string;
    organizationName: string;
    success: boolean;
    transactionsCreated?: number;
    totalAmount?: number;
    error?: string;
  }>;
  executedAt: Date;
  executionTimeMs: number;
}

// =============================================================================
// BILLING SCHEDULER
// =============================================================================

export class BillingScheduler {
  /**
   * Run automated billing for all organizations with the given frequency
   *
   * This is called by cron jobs at scheduled intervals:
   * - Monthly: 1st of month
   * - Bi-weekly: Every other Monday
   * - Weekly: Every Monday
   *
   * The ENTIRE cross-org operation — organization enumeration, each org's
   * billing-cycle generation, and completion/failure notifications — runs
   * inside a single withSystemContext() so every nested call to the
   * canonical `db` import (in this file, in BillingCycleService, in the
   * notification service, in audit-service) resolves to the
   * union_eyes_system connection via AsyncLocalStorage, not just the
   * initial organization_billing_config enumeration (see db/db.ts's `db`
   * Proxy and lib/db/with-rls-context.ts's systemContextStorage).
   * Request-facing authorization (platform_lead) is still enforced
   * entirely at the route level, before this is ever called —
   * withSystemContext is only the execution mechanism.
   *
   * KNOWN LIMITATION (pre-existing, not introduced here):
   * BillingCycleService.generateBillingCycle() internally calls
   * withRLSContext()'s no-context overload, which calls auth()
   * unconditionally and throws if there is no authenticated session — that
   * check happens before any DB access and does not consult the active
   * system context. This is fine for the only currently-wired caller (the
   * platform_lead-authenticated admin route, which has a real session),
   * but if runMonthlyBilling/runWeeklyBilling/runBiWeeklyBilling are ever
   * invoked from a truly headless cron trigger with no HTTP session,
   * generateBillingCycle will throw "Unauthorized" regardless of this
   * SYSTEM wrapper. Fixing that requires BillingCycleService to offer a
   * system-aware entrypoint — out of scope for this correction.
   *
   * PERMANENT DEFENSE-IN-DEPTH CONTRACT (PR #752 round 6): SYSTEM_RUNTIME
   * bypasses tenant RLS by design — union_eyes_system's own policies grant
   * unconditional access, so the nested withRLSContext() session variables
   * set inside this boundary are NOT a security boundary once execution is
   * already on the system connection. Every per-org query
   * BillingCycleService issues MUST therefore keep an explicit
   * organizationId predicate (see its getActiveMembersForBilling query),
   * proven in lib/jobs/__tests__/billing-scheduler-system-boundary-proof.test.ts.
   * Do NOT ever remove that predicate on the theory that "we're in system
   * context, so scoping is unnecessary" — doing so would turn this
   * single-org iteration into a platform-wide cross-org mutation with no
   * RLS policy left to catch it.
   */
  static async runScheduledBilling(frequency: BillingFrequency): Promise<BillingSchedulerResult> {
    return withSystemContext((_tx) => this.runScheduledBillingInSystemContext(frequency));
  }

  private static async runScheduledBillingInSystemContext(frequency: BillingFrequency): Promise<BillingSchedulerResult> {
    const startTime = Date.now();

    logger.info(`Starting scheduled billing run for frequency: ${frequency}`);

    try {
      // Get all organizations with this billing frequency
      const orgs = await this.getOrganizationsForBilling(frequency);

      logger.info(`Found ${orgs.length} organizations configured for ${frequency} billing`);

      const results: BillingSchedulerResult['results'] = [];
      let successful = 0;
      let failed = 0;
      let skipped = 0;

      // Process each organization
      for (const org of orgs) {
        try {
          if (!org.enabled) {
            logger.info(`Skipping disabled billing for organization: ${org.organizationName}`, {
              organizationId: org.organizationId,
            });
            skipped++;
            results.push({
              organizationId: org.organizationId,
              organizationName: org.organizationName,
              success: true,
              error: 'Billing disabled for this organization',
            });
            continue;
          }

          logger.info(`Processing billing for organization: ${org.organizationName}`, {
            organizationId: org.organizationId,
            frequency,
          });

          // Calculate period dates
          const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates(frequency);

          // Generate billing cycle
          const result = await BillingCycleService.generateBillingCycle({
            organizationId: org.organizationId,
            periodStart,
            periodEnd,
            frequency,
            dryRun: false,
            executedBy: 'system_scheduler', // System-triggered
          });

          successful++;
          results.push({
            organizationId: org.organizationId,
            organizationName: org.organizationName,
            success: true,
            transactionsCreated: result.transactionsCreated,
            totalAmount: result.totalAmount,
          });

          logger.info(`Billing completed for organization: ${org.organizationName}`, {
            organizationId: org.organizationId,
            transactionsCreated: result.transactionsCreated,
            totalAmount: result.totalAmount,
          });

          // Optional: Send notification to org admins
          await this.notifyBillingCompleted(org.organizationId, result);
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          logger.error(`Billing failed for organization: ${org.organizationName}`, {
            organizationId: org.organizationId,
            error: errorMessage,
          });

          results.push({
            organizationId: org.organizationId,
            organizationName: org.organizationName,
            success: false,
            error: errorMessage,
          });

          // Optional: Send failure notification
          await this.notifyBillingFailed(org.organizationId, errorMessage);
        }
      }

      const executionTimeMs = Date.now() - startTime;

      logger.info(`Scheduled billing run completed`, {
        frequency,
        totalOrganizations: orgs.length,
        successful,
        failed,
        skipped,
        executionTimeMs,
      });

      return {
        totalOrganizations: orgs.length,
        successful,
        failed,
        skipped,
        results,
        executedAt: new Date(),
        executionTimeMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Scheduled billing run failed`, {
        frequency,
        error: errorMessage,
      });

      throw new Error(`Scheduled billing failed: ${errorMessage}`);
    }
  }

  /**
   * Get organizations configured for a specific billing frequency.
   *
   * Deliberately cross-organization (organization_billing_config is
   * SYSTEM_ONLY — see db/rls-storage-authority-manifest.ts). Uses the
   * canonical `db` import directly rather than opening its own
   * withSystemContext: this is always called from within
   * runScheduledBilling's outer withSystemContext, so `db` already
   * resolves to the union_eyes_system connection via AsyncLocalStorage.
   * Opening a second, nested withSystemContext here would start an
   * unrelated second transaction rather than participating in the same
   * system execution boundary as the rest of the scheduled-billing run.
   */
  private static async getOrganizationsForBilling(
    frequency: BillingFrequency
  ): Promise<BillingScheduleConfig[]> {
    try {
      const configured = await db
        .select({
          organizationId: organizationBillingConfig.organizationId,
          organizationName: organizations.name,
          frequency: organizationBillingConfig.billingFrequency,
          enabled: organizationBillingConfig.enabled,
        })
        .from(organizationBillingConfig)
        .innerJoin(
          organizations,
          eq(organizationBillingConfig.organizationId, organizations.id)
        )
        .where(
          and(
            eq(organizationBillingConfig.enabled, true),
            eq(organizationBillingConfig.billingFrequency, frequency)
          )
        );

      if (configured.length > 0) {
        return configured as BillingScheduleConfig[];
      }

      // Fallback: get all active organizations and assume monthly billing
      const orgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          status: organizations.status,
        })
        .from(organizations)
        .where(eq(organizations.status, 'active'));

      return orgs
        .filter((org) => org.status === 'active')
        .map((org) => {
          // Per-org billing frequency is not yet persisted on the organizations
          // table. Hardcoding 'monthly' here means quarterly/annual contracts
          // would be over-billed by this scheduler. Surface loudly until we
          // either add a column or a billing_subscription table.
          logger.warn(
            'billing-scheduler: org billing frequency is hardcoded to monthly; per-org frequency is not persisted',
            { organizationId: org.id }
          );
          return {
            organizationId: org.id,
            organizationName: org.name,
            frequency: 'monthly' as BillingFrequency,
            enabled: true,
          };
        });
    } catch (error) {
      logger.error('Error fetching organizations for billing', { error });
      throw error;
    }
  }

  /**
   * Notify organization admins that billing was completed
   */
  private static async notifyBillingCompleted(
    organizationId: string,
    result: { transactionsCreated?: number; totalAmount?: number }
  ): Promise<void> {
    const recipients = await this.getBillingRecipients(organizationId);
    if (recipients.length === 0) {
      logger.warn('No billing recipients found', { organizationId });
      return;
    }

    const notificationService = getNotificationService();
    const subject = 'Billing cycle completed';
    const body = `Billing has completed for your organization.\n` +
      `Transactions created: ${result.transactionsCreated ?? 0}\n` +
      `Total amount: ${result.totalAmount ?? '0.00'}\n`;

    await Promise.all(
      recipients.map((recipient) =>
        notificationService.send({
          organizationId,
          recipientEmail: recipient,
          type: 'email',
          priority: 'normal',
          subject,
          title: subject,
          body,
          htmlBody: body.replace(/\n/g, '<br />'),
          metadata: {
            type: 'billing_cycle_completed',
            transactionsCreated: result.transactionsCreated,
            totalAmount: result.totalAmount,
          },
        })
      )
    );
  }

  /**
   * Notify organization admins that billing failed
   */
  private static async notifyBillingFailed(
    organizationId: string,
    error: string
  ): Promise<void> {
    const recipients = await this.getBillingRecipients(organizationId);
    if (recipients.length === 0) {
      logger.warn('No billing recipients found', { organizationId });
      return;
    }

    const notificationService = getNotificationService();
    const subject = 'Billing cycle failed';
    const body = `Billing failed for your organization.\n` +
      `Error: ${error}`;

    await Promise.all(
      recipients.map((recipient) =>
        notificationService.send({
          organizationId,
          recipientEmail: recipient,
          type: 'email',
          priority: 'high',
          subject,
          title: subject,
          body,
          htmlBody: body.replace(/\n/g, '<br />'),
          metadata: {
            type: 'billing_cycle_failed',
            error,
          },
        })
      )
    );
  }

  private static async getBillingRecipients(organizationId: string): Promise<string[]> {
    const [org] = await db
      .select({ id: organizations.id, slug: organizations.slug, email: organizations.email })
      .from(organizations)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(or(eq(organizations.id, organizationId as any), eq(organizations.slug, organizationId)))
      .limit(1);

    const orgIdentifiers = new Set<string>();
    orgIdentifiers.add(organizationId);
    if (org?.id) orgIdentifiers.add(String(org.id));
    if (org?.slug) orgIdentifiers.add(org.slug);

    const roles = ['admin', 'super_admin', 'billing_manager', 'billing_specialist'];
    const members = await db
      .select({ email: organizationMembers.email })
      .from(organizationMembers)
      .where(
        and(
          inArray(organizationMembers.organizationId, Array.from(orgIdentifiers)),
          inArray(organizationMembers.role, roles)
        )
      );

    const recipients = new Set<string>();
    for (const member of members) {
      if (member.email) recipients.add(member.email);
    }
    if (org?.email) recipients.add(org.email);

    return Array.from(recipients);
  }

  /**
   * Manual trigger for scheduled billing (for testing)
   */
  static async manualTrigger(frequency: BillingFrequency): Promise<BillingSchedulerResult> {
    logger.info(`Manual trigger for ${frequency} billing`);
    return this.runScheduledBilling(frequency);
  }
}

// =============================================================================
// CRON JOB HANDLERS
// =============================================================================

/**
 * Monthly billing job - Runs on 1st of month at 00:00 UTC
 * 
 * Usage with cron library:
 * ```
 * cron.schedule('0 0 1 * *', async () => {
 *   await runMonthlyBilling();
 * });
 * ```
 */
export async function runMonthlyBilling(): Promise<BillingSchedulerResult> {
  return BillingScheduler.runScheduledBilling('monthly');
}

/**
 * Bi-weekly billing job - Runs every other Monday at 00:00 UTC
 * 
 * Note: Implementing bi-weekly requires tracking last run date
 */
export async function runBiWeeklyBilling(): Promise<BillingSchedulerResult> {
  return BillingScheduler.runScheduledBilling('bi_weekly');
}

/**
 * Weekly billing job - Runs every Monday at 00:00 UTC
 * 
 * Usage with cron library:
 * ```
 * cron.schedule('0 0 * * 1', async () => {
 *   await runWeeklyBilling();
 * });
 * ```
 */
export async function runWeeklyBilling(): Promise<BillingSchedulerResult> {
  return BillingScheduler.runScheduledBilling('weekly');
}

/**
 * Quarterly billing job - Runs on 1st of quarter at 00:00 UTC
 */
export async function runQuarterlyBilling(): Promise<BillingSchedulerResult> {
  return BillingScheduler.runScheduledBilling('quarterly');
}

/**
 * Annual billing job - Runs on January 1st at 00:00 UTC
 */
export async function runAnnualBilling(): Promise<BillingSchedulerResult> {
  return BillingScheduler.runScheduledBilling('annual');
}
