import { describe, it, expect } from 'vitest'
import { Scope, ROLE_DEFAULT_SCOPES } from '../scopes'
import { ConsoleRole, PartnerRole, UERole, SystemRole } from '../roles'

describe('scopes', () => {
  describe('Scope constants', () => {
    it('has governance scopes', () => {
      expect(Scope.GOVERNANCE_READ).toBe('governance:read')
      expect(Scope.GOVERNANCE_WRITE).toBe('governance:write')
      expect(Scope.GOVERNANCE_EXECUTE).toBe('governance:execute')
      expect(Scope.GOVERNANCE_ADMIN).toBe('governance:admin')
    })

    it('has finance scopes', () => {
      expect(Scope.FINANCE_READ).toBe('finance:read')
      expect(Scope.FINANCE_CLOSE).toBe('finance:close')
    })

    it('has all expected scopes', () => {
      const values = Object.values(Scope)
      expect(values.length).toBeGreaterThanOrEqual(20)
      // Each scope should be colon-separated lowercase segments
      for (const s of values) {
        expect(s).toMatch(/^[a-z_]+(:[a-z_]+)+$/)
      }
    })
  })

  describe('ROLE_DEFAULT_SCOPES', () => {
    it('SUPER_ADMIN gets all scopes', () => {
      const allScopes = Object.values(Scope)
      const superScopes = ROLE_DEFAULT_SCOPES[ConsoleRole.SUPER_ADMIN]
      expect(superScopes).toEqual(allScopes)
    })

    it('VIEWER gets read-only scopes', () => {
      const viewerScopes = ROLE_DEFAULT_SCOPES[ConsoleRole.VIEWER]
      expect(viewerScopes).toContain(Scope.GOVERNANCE_READ)
      expect(viewerScopes).toContain(Scope.FINANCE_READ)
      expect(viewerScopes).not.toContain(Scope.GOVERNANCE_WRITE)
    })

    it('FINANCE_ADMIN has FINANCE_WRITE and FINANCE_CLOSE', () => {
      const scopes = ROLE_DEFAULT_SCOPES[ConsoleRole.FINANCE_ADMIN]
      expect(scopes).toContain(Scope.FINANCE_WRITE)
      expect(scopes).toContain(Scope.FINANCE_CLOSE)
    })

    it('ML_ENGINEER has ML-related scopes', () => {
      const scopes = ROLE_DEFAULT_SCOPES[ConsoleRole.ML_ENGINEER]
      expect(scopes).toContain(Scope.ML_MODELS_WRITE)
      expect(scopes).toContain(Scope.ML_MODELS_ACTIVATE)
    })

    it('CHANNEL_SALES has partner read scopes only', () => {
      const scopes = ROLE_DEFAULT_SCOPES[PartnerRole.CHANNEL_SALES]
      expect(scopes).toContain(Scope.PARTNER_READ)
      expect(scopes).not.toContain(Scope.PARTNER_WRITE)
    })

    it('WEBHOOK_PROCESSOR has webhook read + governance write', () => {
      const scopes = ROLE_DEFAULT_SCOPES[SystemRole.WEBHOOK_PROCESSOR]
      expect(scopes).toContain(Scope.WEBHOOK_READ)
      expect(scopes).toContain(Scope.GOVERNANCE_WRITE)
    })

    it('every role has an entry', () => {
      const allRoles = [
        ...Object.values(ConsoleRole),
        ...Object.values(PartnerRole),
        ...Object.values(UERole),
        ...Object.values(SystemRole),
      ]
      for (const role of allRoles) {
        expect(ROLE_DEFAULT_SCOPES).toHaveProperty(role)
        expect(Array.isArray(ROLE_DEFAULT_SCOPES[role])).toBe(true)
      }
    })
  })
})
