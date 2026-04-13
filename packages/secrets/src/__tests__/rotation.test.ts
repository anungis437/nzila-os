/**
 * @nzila/secrets — SecretRotationManager comprehensive tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  SecretRotationManager,
  type RotationEvent,
} from '../rotation'

const DAY_MS = 86_400_000

describe('SecretRotationManager', () => {
  let manager: SecretRotationManager

  beforeEach(() => {
    manager = new SecretRotationManager()
  })

  describe('registerPolicy', () => {
    it('registers a policy with computed nextRotation from lastRotated', () => {
      const lastRotated = new Date('2026-01-01T00:00:00Z')
      manager.registerPolicy({
        secretName: 'db-password',
        rotationIntervalDays: 90,
        lastRotated,
        rotationType: 'database_password',
      })

      const status = manager.getRotationStatus()
      const all = [...status.overdue, ...status.upcoming, ...status.healthy]
      expect(all).toHaveLength(1)
      expect(all[0].secretName).toBe('db-password')
      expect(all[0].nextRotation).toBeDefined()
      expect(all[0].nextRotation!.getTime()).toBe(
        lastRotated.getTime() + 90 * DAY_MS,
      )
    })

    it('computes nextRotation from now when lastRotated is missing', () => {
      const before = Date.now()
      manager.registerPolicy({
        secretName: 'api-key',
        rotationIntervalDays: 30,
        rotationType: 'api_key',
      })
      const after = Date.now()

      const status = manager.getRotationStatus()
      const all = [...status.overdue, ...status.upcoming, ...status.healthy]
      expect(all).toHaveLength(1)
      const next = all[0].nextRotation!.getTime()
      expect(next).toBeGreaterThanOrEqual(before + 30 * DAY_MS)
      expect(next).toBeLessThanOrEqual(after + 30 * DAY_MS)
    })

    it('validates the policy with Zod (throws on invalid rotationType)', () => {
      expect(() =>
        manager.registerPolicy({
          secretName: 'bad',
          rotationIntervalDays: 90,
          rotationType: 'invalid_type' as never,
        }),
      ).toThrow()
    })

    it('applies default values for optional fields', () => {
      manager.registerPolicy({
        secretName: 'minimal',
        rotationType: 'oauth_secret',
      })

      const status = manager.getRotationStatus()
      const all = [...status.overdue, ...status.upcoming, ...status.healthy]
      expect(all[0].rotationIntervalDays).toBe(90)
      expect(all[0].notifyDaysBeforeExpiry).toBe(14)
      expect(all[0].autoRotate).toBe(false)
    })
  })

  describe('getRotationStatus', () => {
    it('classifies overdue policy (nextRotation in the past)', () => {
      manager.registerPolicy({
        secretName: 'overdue-secret',
        rotationIntervalDays: 30,
        lastRotated: new Date(Date.now() - 60 * DAY_MS), // 60 days ago
        rotationType: 'api_key',
      })

      const status = manager.getRotationStatus()
      expect(status.overdue).toHaveLength(1)
      expect(status.overdue[0].secretName).toBe('overdue-secret')
      expect(status.upcoming).toHaveLength(0)
      expect(status.healthy).toHaveLength(0)
    })

    it('classifies upcoming policy (within notify window)', () => {
      // lastRotated such that nextRotation is 5 days from now (inside 14-day window)
      const daysAgo = 90 - 5 // 85 days ago → next rotation in 5 days
      manager.registerPolicy({
        secretName: 'upcoming-secret',
        rotationIntervalDays: 90,
        lastRotated: new Date(Date.now() - daysAgo * DAY_MS),
        notifyDaysBeforeExpiry: 14,
        rotationType: 'certificate',
      })

      const status = manager.getRotationStatus()
      expect(status.upcoming).toHaveLength(1)
      expect(status.upcoming[0].secretName).toBe('upcoming-secret')
    })

    it('classifies healthy policy (far from expiry)', () => {
      manager.registerPolicy({
        secretName: 'healthy-secret',
        rotationIntervalDays: 90,
        lastRotated: new Date(), // just rotated
        rotationType: 'database_password',
      })

      const status = manager.getRotationStatus()
      expect(status.healthy).toHaveLength(1)
      expect(status.healthy[0].secretName).toBe('healthy-secret')
    })

    it('returns empty arrays when no policies registered', () => {
      const status = manager.getRotationStatus()
      expect(status.overdue).toHaveLength(0)
      expect(status.upcoming).toHaveLength(0)
      expect(status.healthy).toHaveLength(0)
    })

    it('handles mix of statuses', () => {
      // Overdue
      manager.registerPolicy({
        secretName: 'old',
        rotationIntervalDays: 30,
        lastRotated: new Date(Date.now() - 60 * DAY_MS),
        rotationType: 'api_key',
      })
      // Healthy
      manager.registerPolicy({
        secretName: 'fresh',
        rotationIntervalDays: 90,
        lastRotated: new Date(),
        rotationType: 'certificate',
      })

      const status = manager.getRotationStatus()
      expect(status.overdue).toHaveLength(1)
      expect(status.healthy).toHaveLength(1)
    })
  })

  describe('recordRotation', () => {
    it('updates the policy with new lastRotated and nextRotation', () => {
      manager.registerPolicy({
        secretName: 'rotate-me',
        rotationIntervalDays: 30,
        lastRotated: new Date(Date.now() - 60 * DAY_MS),
        rotationType: 'api_key',
      })

      const event: RotationEvent = {
        secretName: 'rotate-me',
        rotationType: 'api_key',
        newVersion: 'v2',
        rotatedAt: new Date(),
        rotatedBy: 'automatic',
      }

      const result = manager.recordRotation(event)
      expect(result.secretName).toBe('rotate-me')
      expect(result.rotatedBy).toBe('automatic')

      // After rotation, should be healthy
      const status = manager.getRotationStatus()
      expect(status.healthy).toHaveLength(1)
      expect(status.overdue).toHaveLength(0)
    })

    it('handles rotation for unregistered policy gracefully', () => {
      const event: RotationEvent = {
        secretName: 'unknown-secret',
        rotationType: 'database_password',
        newVersion: 'v1',
        rotatedAt: new Date(),
        rotatedBy: 'manual',
      }

      const result = manager.recordRotation(event)
      expect(result.secretName).toBe('unknown-secret')
    })

    it('validates event with Zod', () => {
      expect(() =>
        manager.recordRotation({
          secretName: 'x',
          rotationType: 'api_key',
          newVersion: 'v1',
          rotatedAt: new Date(),
          rotatedBy: 'invalid' as never,
        }),
      ).toThrow()
    })

    it('records event with optional fields', () => {
      manager.registerPolicy({
        secretName: 'traced',
        rotationType: 'oauth_secret',
      })

      const event: RotationEvent = {
        secretName: 'traced',
        rotationType: 'oauth_secret',
        previousVersion: 'v1',
        newVersion: 'v2',
        rotatedAt: new Date(),
        rotatedBy: 'manual',
        evidencePackId: 'ep-123',
        traceId: 'trace-abc',
      }

      const result = manager.recordRotation(event)
      expect(result.evidencePackId).toBe('ep-123')
      expect(result.traceId).toBe('trace-abc')
      expect(result.previousVersion).toBe('v1')
    })
  })
})
