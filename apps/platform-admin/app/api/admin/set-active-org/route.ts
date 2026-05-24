/**
 * Platform Admin — Set active-org cookie
 *
 * POST /api/admin/set-active-org
 * Body: { orgId: string }
 *
 * Persists the user's currently selected organisation as the
 * `nzila_active_org` cookie so every server page can pick it up without
 * forwarding `?orgId=` through every link. The cookie is verified against
 * the actor's org_members rows before being set — we never trust a
 * client-supplied orgId without an active membership check.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'
import { and, eq } from 'drizzle-orm'
import { ORG_COOKIE_NAME } from '../../../../lib/page-org-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function platformAdminIds(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Auth required' } },
      { status: 401 },
    )
  }

  let body: { orgId?: string }
  try {
    body = (await request.json()) as { orgId?: string }
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    )
  }

  const orgId = body.orgId
  if (!orgId || !UUID_RE.test(orgId)) {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_ORG_ID', message: 'orgId must be a UUID' } },
      { status: 400 },
    )
  }

  let isMember = platformAdminIds().has(session.userId)
  if (!isMember) {
    const [row] = await platformDb
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, orgId),
          eq(orgMembers.userId, session.userId),
          eq(orgMembers.status, 'active'),
        ),
      )
      .limit(1)
    isMember = Boolean(row)
  }

  if (!isMember) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'ORG_FORBIDDEN',
          message: 'Actor is not an active member of the requested org',
        },
      },
      { status: 403 },
    )
  }

  const res = NextResponse.json({ ok: true, data: { orgId } })
  res.cookies.set(ORG_COOKIE_NAME, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
