/**
 * Zonga — Governance Guards Test Suite
 *
 * Validates G1-G5 governance and security invariant guards.
 */
import { describe, it, expect } from 'vitest'
import {
  guardAdminActionReason,
  guardRoleAuthorization,
  guardRateLimit,
  guardAuditCompleteness,
  guardEnvironmentRestriction,
} from '../guards/governance-guards'

describe('Governance invariant guards', () => {
  describe('G1: guardAdminActionReason', () => {
    it('passes when reason is long enough', () => {
      expect(guardAdminActionReason('Resolving case after investigation').passed).toBe(true)
    })

    it('fails when reason is too short', () => {
      const result = guardAdminActionReason('short')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('G1_ADMIN_REASON_REQUIRED')
    })

    it('fails when reason is undefined', () => {
      expect(guardAdminActionReason(undefined).passed).toBe(false)
    })

    it('respects custom minimum length', () => {
      expect(guardAdminActionReason('ok', 2).passed).toBe(true)
      expect(guardAdminActionReason('ok', 5).passed).toBe(false)
    })
  })

  describe('G2: guardRoleAuthorization', () => {
    it('passes when actor has required role', () => {
      expect(guardRoleAuthorization('admin', ['admin', 'operator']).passed).toBe(true)
    })

    it('fails when actor lacks required role', () => {
      const result = guardRoleAuthorization('viewer', ['admin', 'operator'])
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('G2_ROLE_AUTHORIZATION')
    })
  })

  describe('G3: guardRateLimit', () => {
    it('passes when under limit', () => {
      expect(guardRateLimit(5, 10).passed).toBe(true)
    })

    it('fails when at limit', () => {
      const result = guardRateLimit(10, 10)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('G3_RATE_LIMIT')
    })

    it('fails when over limit', () => {
      expect(guardRateLimit(15, 10).passed).toBe(false)
    })
  })

  describe('G4: guardAuditCompleteness', () => {
    it('passes when audit entry exists', () => {
      expect(guardAuditCompleteness(true, 'payout', 'p-1').passed).toBe(true)
    })

    it('fails when audit entry is missing', () => {
      const result = guardAuditCompleteness(false, 'payout', 'p-1')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('G4_AUDIT_COMPLETENESS')
    })
  })

  describe('G5: guardEnvironmentRestriction', () => {
    it('passes in development', () => {
      expect(guardEnvironmentRestriction('seed_data', 'development').passed).toBe(true)
    })

    it('fails in production for blocked operations', () => {
      const result = guardEnvironmentRestriction('seed_data', 'production')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('G5_ENVIRONMENT_RESTRICTION')
    })

    it('respects custom blocked environments', () => {
      expect(guardEnvironmentRestriction('op', 'staging', ['staging']).passed).toBe(false)
      expect(guardEnvironmentRestriction('op', 'staging', ['production']).passed).toBe(true)
    })
  })
})
