/**
 * TrustCore — Internal Billing Audit Route
 *
 * GET /api/internal/billing-audit
 *
 * Dev/admin diagnostic tool that returns the access result for every
 * gated route for the current org.
 *
 * Access: platform_admin only (never exposed to regular users).
 *
 * Returns:
 * {
 *   orgId, plan, status, isActive,
 *   gatedRoutes: [{ route, feature, allowed, reason }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { getResolvedSubscription } from '@/lib/billing/getSubscription'
import {
  canExportAudit,
  canAccessTrustCenter,
  canExportEvidence,
  canCreateReminder,
  FREE_REMINDER_LIMIT,
} from '@/lib/billing/featureAccess'
import { countActiveTrustcoreReminders } from '@nzila/db/queries/trustcore'

export const GET = withRequiredRole(
  ['platform_admin'],
  async (_req: NextRequest, ctx) => {
    const [subscription, activeReminderCount] = await Promise.all([
      getResolvedSubscription(ctx.orgId),
      countActiveTrustcoreReminders(ctx.orgId),
    ])

    const routes = [
      {
        route: 'POST /api/export/audit',
        feature: 'audit_export',
        allowed: canExportAudit(subscription),
        reason: canExportAudit(subscription)
          ? 'Plan allows audit export'
          : `Plan '${subscription.plan}' does not include audit export`,
      },
      {
        route: 'GET /api/export/evidence',
        feature: 'evidence_export',
        allowed: canExportEvidence(subscription),
        reason: canExportEvidence(subscription)
          ? 'Plan allows evidence export'
          : `Plan '${subscription.plan}' does not include evidence export`,
      },
      {
        route: 'GET /trust-center/[orgId]',
        feature: 'trust_center',
        allowed: canAccessTrustCenter(subscription),
        reason: canAccessTrustCenter(subscription)
          ? 'Plan allows trust center access'
          : `Plan '${subscription.plan}' does not include public trust center`,
      },
      {
        route: 'POST /api/reminders (create)',
        feature: 'reminders',
        allowed: canCreateReminder(subscription, activeReminderCount),
        reason: canCreateReminder(subscription, activeReminderCount)
          ? `Allowed (${activeReminderCount} active of ${subscription.plan === 'free' ? FREE_REMINDER_LIMIT : '∞'} limit)`
          : `FREE plan limit reached (${activeReminderCount}/${FREE_REMINDER_LIMIT} active reminders)`,
      },
    ]

    return NextResponse.json({
      success: true,
      data: {
        orgId: ctx.orgId,
        plan: subscription.plan,
        status: subscription.status,
        isActive: subscription.isActive,
        gatedRoutes: routes,
      },
    })
  },
)
