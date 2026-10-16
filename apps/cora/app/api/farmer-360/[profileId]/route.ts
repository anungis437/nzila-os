import { NextResponse } from 'next/server'
import { OrgAccessDeniedError } from '@nzila/org/guards'
import { AuthorizationResolutionError } from '@nzila/platform-auth/authorization-context'
import { resolveOrgContext } from '@/lib/resolve-org'
import { createFarmer360Service } from '@/lib/farmer-360/service'
import { createFarmer360RuntimePorts } from '@/lib/farmer-360/adapters'

const farmer360 = createFarmer360Service(createFarmer360RuntimePorts())

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

function noStoreJson(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Vary', 'Cookie, Authorization')
  return response
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  let context
  try {
    context = await resolveOrgContext({ requiredPermissions: ['cora:farmer360:read'] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to resolve request identity'
    if (message === 'Unauthorized') {
      return noStoreJson({ error: message }, { status: 401 })
    }
    if (error instanceof AuthorizationResolutionError) {
      console.warn('[CORA:AUTHZ:DENY]', error.audit)
      return noStoreJson({ error: 'Organization access is not authorized' }, { status: 403 })
    }
    console.error('[CORA:FARMER360:AUTH]', error)
    return noStoreJson({ error: 'Unable to resolve request identity' }, { status: 500 })
  }

  if (!context.permissions.includes('cora:farmer360:read')) {
    console.warn('[CORA:AUTHZ:DENY]', {
      ...context.authorizationAudit,
      decision: 'DENY',
      reason: 'APPLICATION_PERMISSION_REQUIRED',
    })
    return noStoreJson({ error: 'Farmer 360 access is not authorized' }, { status: 403 })
  }

  const { profileId } = await params
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)
  ) {
    return noStoreJson({ error: 'Invalid Farmer 360 profile ID' }, { status: 400 })
  }

  try {
    return noStoreJson(await farmer360.getFarmer360(context, profileId))
  } catch (error) {
    if (error instanceof OrgAccessDeniedError) {
      return noStoreJson({ error: 'Farmer 360 access is not authorized' }, { status: 403 })
    }
    if (error instanceof Error && error.message.startsWith('Farmer 360 profile not found:')) {
      return noStoreJson({ error: 'Farmer 360 profile not found' }, { status: 404 })
    }
    console.error('[CORA:FARMER360:READ]', error)
    return noStoreJson({ error: 'Unable to read Farmer 360 profile' }, { status: 500 })
  }
}
