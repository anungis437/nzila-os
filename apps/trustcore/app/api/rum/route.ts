import { NextRequest } from 'next/server'
import { handleRUMBeacon } from '@nzila/platform-rum'
import { withRequiredRole } from '@/lib/rbac/requireRole'

export const POST = withRequiredRole(
  ['staff', 'org_admin', 'platform_admin'],
  async (request: NextRequest) => handleRUMBeacon(request),
)