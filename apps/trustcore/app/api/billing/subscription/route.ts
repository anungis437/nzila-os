/**
 * TrustCore — Billing: Get Subscription
 *
 * GET /api/billing/subscription
 *
 * Returns the resolved subscription for the authenticated org.
 * Accessible by: org_admin, staff, auditor
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { getResolvedSubscription } from '@/lib/billing/getSubscription'
import {
  canExportAudit,
  canAccessTrustCenter,
  canExportEvidence,
  FREE_REMINDER_LIMIT,
} from '@/lib/billing/featureAccess'

export const GET = withRequiredRole(
  ['org_admin', 'staff', 'auditor', 'platform_admin'],
  async (_req: NextRequest, ctx) => {
    const subscription = await getResolvedSubscription(ctx.orgId)

    return NextResponse.json({
      success: true,
      data: {
        plan: subscription.plan,
        status: subscription.status,
        isActive: subscription.isActive,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        features: {
          auditExport: canExportAudit(subscription),
          trustCenter: canAccessTrustCenter(subscription),
          evidenceExport: canExportEvidence(subscription),
          unlimitedReminders: subscription.plan !== 'free',
          reminderLimit: subscription.plan === 'free' ? FREE_REMINDER_LIMIT : null,
        },
      },
    })
  },
)
