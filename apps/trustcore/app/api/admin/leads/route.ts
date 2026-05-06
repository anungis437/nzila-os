/**
 * TrustCore — Admin Lead List API
 *
 * GET /api/admin/leads
 *
 * Returns all captured leads for the admin view.
 * Access: platform_admin only.
 *
 * Response: { leads: TrustcoreLead[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { listTrustcoreLeads } from '@nzila/db/queries/trustcore'

export const GET = withRequiredRole(
  ['platform_admin'],
  async (_req: NextRequest) => {
    const leads = await listTrustcoreLeads()
    return NextResponse.json({ leads })
  },
)
