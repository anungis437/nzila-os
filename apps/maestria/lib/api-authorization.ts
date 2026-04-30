import { NextResponse } from 'next/server'
import { hasPermission, resolveActor, type Permission, type SearchParamRecord } from '@/lib/access-control'
import { recordAudit } from '@/lib/audit-log'

export function authorize(searchParams: SearchParamRecord, permission: Permission, action: string, resource: string) {
  const actor = resolveActor(searchParams)
  const allowed = hasPermission(actor, permission)

  recordAudit({
    actorId: actor.id,
    actorName: actor.displayName,
    actorRole: actor.role,
    action,
    resource,
    result: allowed ? 'allow' : 'deny',
    note: allowed ? 'Authorized by policy.' : 'Blocked by policy.',
  })

  if (!allowed) {
    return {
      actor,
      allowed,
      response: NextResponse.json(
        { ok: false, error: 'forbidden', actor: actor.displayName, role: actor.role },
        { status: 403 },
      ),
    }
  }

  return { actor, allowed, response: null }
}

export const authorizeRequest = authorize
