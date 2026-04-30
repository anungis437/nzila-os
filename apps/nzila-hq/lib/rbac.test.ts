import { describe, expect, it } from 'vitest'
import { hasCapability, assertCapability, type HqCapability } from './rbac'
import type { HqRole } from '@nzila/hq-domain'

const ALL_ROLES: HqRole[] = ['founder', 'president', 'ops-lead', 'partnerships', 'finance', 'board-viewer']

describe('RBAC matrix', () => {
  it('founder has every capability', () => {
    const caps: HqCapability[] = [
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
    ]
    for (const c of caps) expect(hasCapability('founder', c)).toBe(true)
  })

  it('board-viewer is read-only', () => {
    expect(hasCapability('board-viewer', 'edit:venture')).toBe(false)
    expect(hasCapability('board-viewer', 'edit:opportunity')).toBe(false)
    expect(hasCapability('board-viewer', 'edit:task')).toBe(false)
    expect(hasCapability('board-viewer', 'reassign:task')).toBe(false)
    expect(hasCapability('board-viewer', 'view:portfolio')).toBe(true)
  })

  it('partnerships cannot view finance or allocation', () => {
    expect(hasCapability('partnerships', 'view:finance')).toBe(false)
    expect(hasCapability('partnerships', 'view:allocation')).toBe(false)
  })

  it('finance role gets allocation but not crm/cadence', () => {
    expect(hasCapability('finance', 'view:allocation')).toBe(true)
    expect(hasCapability('finance', 'view:crm')).toBe(false)
    expect(hasCapability('finance', 'view:cadence')).toBe(false)
  })

  it('chief-of-staff capability is restricted to founder/president/ops-lead', () => {
    expect(hasCapability('founder', 'view:chief-of-staff')).toBe(true)
    expect(hasCapability('president', 'view:chief-of-staff')).toBe(true)
    expect(hasCapability('ops-lead', 'view:chief-of-staff')).toBe(true)
    expect(hasCapability('partnerships', 'view:chief-of-staff')).toBe(false)
    expect(hasCapability('finance', 'view:chief-of-staff')).toBe(false)
    expect(hasCapability('board-viewer', 'view:chief-of-staff')).toBe(false)
  })

  it('every role can view executive home', () => {
    for (const r of ALL_ROLES) expect(hasCapability(r, 'view:executive-home')).toBe(true)
  })

  it('assertCapability throws NZILA_HQ_RBAC_DENIED on denied capability', () => {
    expect(() => assertCapability('partnerships', 'view:finance')).toThrow(/NZILA_HQ_RBAC_DENIED/)
  })

  it('assertCapability does not throw on allowed capability', () => {
    expect(() => assertCapability('founder', 'edit:venture')).not.toThrow()
  })
})
