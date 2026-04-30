import { NextRequest, NextResponse } from 'next/server'
import { type ActorRole } from '@/lib/access-control'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { getMaestriaDb } from '@/lib/maestria-persistence'

interface RouteContext {
  params: Promise<{ id: string }>
}

const VALID_ROLES: ActorRole[] = [
  'owner',
  'production_staff',
  'customer_service',
  'finance_admin',
  'marketing_staff',
  'seasonal_temp',
  'corporate_client',
]

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams)
  const auth = requireOrgAccess(searchParams, 'user.manage', 'users.role.update', 'workspace:user-access')
  if (auth.response) return auth.response

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !('role' in body) ||
    typeof (body as Record<string, unknown>).role !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing role field' }, { status: 400 })
  }

  const newRole = (body as { role: string }).role as ActorRole
  if (!VALID_ROLES.includes(newRole)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 },
    )
  }

  const db = getMaestriaDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      invited_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  const user = db
    .prepare('SELECT id, email, status FROM pending_users WHERE id = ?')
    .get(id) as { id: string; email: string; status: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  db.prepare('UPDATE pending_users SET role = ?, updated_at = ? WHERE id = ?').run(
    newRole,
    now,
    id,
  )

  return NextResponse.json({ id, email: user.email, role: newRole, status: user.status })
}
