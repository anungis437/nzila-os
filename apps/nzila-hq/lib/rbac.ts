/**
 * RBAC permission matrix for Nzila HQ (Phase 13).
 *
 * Roles map to capabilities, not raw routes — pages enforce capabilities so that
 * future role additions don't require route audits.
 */
import type { HqRole } from '@nzila/hq-domain'

export type HqCapability =
  | 'view:executive-home'
  | 'view:portfolio'
  | 'view:crm'
  | 'view:pipeline'
  | 'view:dependency'
  | 'view:delegation'
  | 'view:finance'
  | 'view:documents'
  | 'view:integrations'
  | 'view:allocation'
  | 'view:cadence'
  | 'view:chief-of-staff'
  | 'edit:venture'
  | 'edit:opportunity'
  | 'edit:task'
  | 'reassign:task'
  | 'export:report'
  | 'view:audit-log'

const PERMISSIONS: Record<HqRole, HqCapability[]> = {
  founder: [
    'view:executive-home',
    'view:portfolio',
    'view:crm',
    'view:pipeline',
    'view:dependency',
    'view:delegation',
    'view:finance',
    'view:documents',
    'view:integrations',
    'view:allocation',
    'view:cadence',
    'view:chief-of-staff',
    'edit:venture',
    'edit:opportunity',
    'edit:task',
    'reassign:task',
    'export:report',
    'view:audit-log',
  ],
  president: [
    'view:executive-home',
    'view:portfolio',
    'view:crm',
    'view:pipeline',
    'view:dependency',
    'view:delegation',
    'view:finance',
    'view:documents',
    'view:integrations',
    'view:allocation',
    'view:cadence',
    'view:chief-of-staff',
    'edit:venture',
    'edit:opportunity',
    'reassign:task',
    'export:report',
    'view:audit-log',
  ],
  'ops-lead': [
    'view:executive-home',
    'view:portfolio',
    'view:crm',
    'view:pipeline',
    'view:dependency',
    'view:delegation',
    'view:documents',
    'view:integrations',
    'view:cadence',
    'view:chief-of-staff',
    'edit:opportunity',
    'edit:task',
    'reassign:task',
    'export:report',
  ],
  partnerships: [
    'view:executive-home',
    'view:portfolio',
    'view:crm',
    'view:pipeline',
    'view:documents',
    'edit:opportunity',
    'edit:task',
  ],
  finance: [
    'view:executive-home',
    'view:portfolio',
    'view:pipeline',
    'view:dependency',
    'view:finance',
    'view:documents',
    'view:allocation',
    'export:report',
    'view:audit-log',
  ],
  'board-viewer': [
    'view:executive-home',
    'view:portfolio',
    'view:pipeline',
    'view:dependency',
    'view:finance',
    'view:allocation',
    'export:report',
  ],
}

export function hasCapability(role: HqRole, capability: HqCapability): boolean {
  return PERMISSIONS[role]?.includes(capability) ?? false
}

export function assertCapability(role: HqRole, capability: HqCapability): void {
  if (!hasCapability(role, capability)) {
    throw new Error(`NZILA_HQ_RBAC_DENIED: role "${role}" lacks capability "${capability}"`)
  }
}

export function capabilitiesOf(role: HqRole): readonly HqCapability[] {
  return PERMISSIONS[role] ?? []
}
