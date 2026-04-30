import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'


const requireOrgAccess = authorize
export async function POST(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(searchParams, 'user.manage', 'access.mutation', 'workspace:user-access')
  if (auth.response) return auth.response

  const body = (await request.json()) as {
    operation?: 'invite' | 'deactivate' | 'role_change'
    targetUserId?: string
    newRole?: string
  }

  return NextResponse.json({
    ok: true,
    performedBy: auth.actor.displayName,
    operation: body.operation ?? 'invite',
    targetUserId: body.targetUserId ?? 'user-unknown',
    newRole: body.newRole ?? null,
    status: 'queued',
  })
}
