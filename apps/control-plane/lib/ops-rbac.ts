export type OpsRole = 'platform_admin' | 'ops' | 'auditor' | 'viewer'

const CONTROL_CENTER_ALLOWED = new Set<OpsRole>(['platform_admin', 'ops'])

export interface OpsPrincipal {
  id: string
  role: OpsRole
}

export function requireControlCenterAccess(request: Request): OpsPrincipal {
  const role = (request.headers.get('x-operator-role') ?? 'viewer') as OpsRole
  const id = request.headers.get('x-operator-id') ?? 'unknown-operator'

  if (!CONTROL_CENTER_ALLOWED.has(role)) {
    throw new Error(`Forbidden: role ${role} is not authorized for control-center actions`)
  }

  return { id, role }
}
