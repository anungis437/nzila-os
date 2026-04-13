import { describe, it, expect } from 'vitest'
import {
  ConsoleRole,
  PartnerRole,
  UERole,
  SystemRole,
  ROLE_HIERARCHY,
  roleIncludes,
} from '../roles'

describe('roles', () => {
  describe('role constants', () => {
    it('ConsoleRole has expected entries', () => {
      expect(ConsoleRole.SUPER_ADMIN).toBe('console:super_admin')
      expect(ConsoleRole.VIEWER).toBe('console:viewer')
      expect(Object.keys(ConsoleRole)).toHaveLength(8)
    })

    it('PartnerRole has expected entries', () => {
      expect(PartnerRole.CHANNEL_ADMIN).toBe('partner:channel_admin')
      expect(Object.keys(PartnerRole)).toHaveLength(7)
    })

    it('UERole has expected entries', () => {
      expect(UERole.SUPERVISOR).toBe('ue:supervisor')
      expect(Object.keys(UERole)).toHaveLength(4)
    })

    it('SystemRole has expected entries', () => {
      expect(SystemRole.CRON_JOB).toBe('system:cron_job')
      expect(Object.keys(SystemRole)).toHaveLength(3)
    })
  })

  describe('ROLE_HIERARCHY', () => {
    it('SUPER_ADMIN inherits all console roles', () => {
      const inherited = ROLE_HIERARCHY[ConsoleRole.SUPER_ADMIN]
      expect(inherited).toContain(ConsoleRole.ADMIN)
      expect(inherited).toContain(ConsoleRole.VIEWER)
    })

    it('VIEWER inherits nothing', () => {
      expect(ROLE_HIERARCHY[ConsoleRole.VIEWER]).toEqual([])
    })

    it('every role in hierarchy has an entry', () => {
      const allRoles = [
        ...Object.values(ConsoleRole),
        ...Object.values(PartnerRole),
        ...Object.values(UERole),
        ...Object.values(SystemRole),
      ]
      for (const role of allRoles) {
        expect(ROLE_HIERARCHY).toHaveProperty(role)
      }
    })
  })

  describe('roleIncludes', () => {
    it('role includes itself', () => {
      expect(roleIncludes(ConsoleRole.VIEWER, ConsoleRole.VIEWER)).toBe(true)
    })

    it('SUPER_ADMIN includes VIEWER', () => {
      expect(roleIncludes(ConsoleRole.SUPER_ADMIN, ConsoleRole.VIEWER)).toBe(true)
    })

    it('SUPER_ADMIN includes FINANCE_VIEWER transitively', () => {
      // SUPER_ADMIN → FINANCE_ADMIN → FINANCE_VIEWER
      expect(roleIncludes(ConsoleRole.SUPER_ADMIN, ConsoleRole.FINANCE_VIEWER)).toBe(true)
    })

    it('VIEWER does not include ADMIN', () => {
      expect(roleIncludes(ConsoleRole.VIEWER, ConsoleRole.ADMIN)).toBe(false)
    })

    it('CHANNEL_ADMIN includes CHANNEL_SALES', () => {
      expect(roleIncludes(PartnerRole.CHANNEL_ADMIN, PartnerRole.CHANNEL_SALES)).toBe(true)
    })

    it('UE SUPERVISOR includes CASE_MANAGER', () => {
      expect(roleIncludes(UERole.SUPERVISOR, UERole.CASE_MANAGER)).toBe(true)
    })

    it('UE SUPERVISOR includes VIEWER transitively', () => {
      expect(roleIncludes(UERole.SUPERVISOR, UERole.VIEWER)).toBe(true)
    })

    it('system roles do not include each other', () => {
      expect(roleIncludes(SystemRole.CRON_JOB, SystemRole.MIGRATION)).toBe(false)
    })

    it('cross-domain roles do not include each other', () => {
      expect(roleIncludes(ConsoleRole.ADMIN, PartnerRole.CHANNEL_ADMIN)).toBe(false)
    })
  })
})
