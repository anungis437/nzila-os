/**
 * Unit Tests — Data Lifecycle Manifest Engine
 */
import { describe, it, expect } from 'vitest'
import {
  generateAppManifest,
  generateAllManifests,
  validateManifest,
  APP_MANIFESTS,
  type DataLifecycleManifest,
} from './manifest'

describe('generateAppManifest', () => {
  it('returns manifest for a known app', () => {
    const manifest = generateAppManifest('abr')
    expect(manifest).not.toBeNull()
    expect(manifest!.appId).toBe('abr')
    expect(manifest!.manifestHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns null for unknown app', () => {
    expect(generateAppManifest('nonexistent')).toBeNull()
  })

  it('generates manifest for nacp-exams', () => {
    const manifest = generateAppManifest('nacp-exams')
    expect(manifest).not.toBeNull()
    expect(manifest!.appId).toBe('nacp-exams')
  })
})

describe('generateAllManifests', () => {
  it('returns manifests for all registered apps', () => {
    const manifests = generateAllManifests()
    expect(manifests.length).toBe(APP_MANIFESTS.length)
    expect(manifests.length).toBeGreaterThan(0)

    for (const m of manifests) {
      expect(m.manifestHash).toMatch(/^[a-f0-9]{64}$/)
    }
  })
})

describe('validateManifest', () => {
  it('validates all built-in manifests as valid', () => {
    for (const manifest of APP_MANIFESTS) {
      const result = validateManifest(manifest)
      expect(result.valid, `Manifest for ${manifest.appId} should be valid: ${result.errors.join(', ')}`).toBe(true)
    }
  })

  it('detects missing retention schedule', () => {
    const bad: DataLifecycleManifest = {
      appId: 'test',
      appName: 'Test',
      version: '1.0.0',
      lastUpdated: '2026-01-01',
      dataCategories: [
        { name: 'Test Data', description: 'test', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
      ],
      retentionSchedules: [],
      deletionPolicies: [
        { category: 'Test Data', method: 'hard_delete', verification: 'audit_log', authorizedRoles: ['admin'], reversible: false },
      ],
      residency: { type: 'managed', regions: ['test'], orgSelectable: false, description: 'test' },
      backup: { frequency: 'daily', provider: 'test', location: 'test', encryptedAtRest: true, backupRetention: '7d', rtoHours: 1, rpoHours: 1 },
    }

    const result = validateManifest(bad)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Data category "Test Data" has no retention schedule')
  })

  it('detects missing deletion policy', () => {
    const bad: DataLifecycleManifest = {
      appId: 'test',
      appName: 'Test',
      version: '1.0.0',
      lastUpdated: '2026-01-01',
      dataCategories: [
        { name: 'Test Data', description: 'test', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
      ],
      retentionSchedules: [
        { category: 'Test Data', retentionClass: '1_YEAR', retentionPeriod: '1 year', legalBasis: 'test' },
      ],
      deletionPolicies: [],
      residency: { type: 'managed', regions: ['test'], orgSelectable: false, description: 'test' },
      backup: { frequency: 'daily', provider: 'test', location: 'test', encryptedAtRest: true, backupRetention: '7d', rtoHours: 1, rpoHours: 1 },
    }

    const result = validateManifest(bad)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Data category "Test Data" has no deletion policy')
  })

  it('detects empty data categories', () => {
    const bad: DataLifecycleManifest = {
      appId: 'test',
      appName: 'Test',
      version: '1.0.0',
      lastUpdated: '2026-01-01',
      dataCategories: [],
      retentionSchedules: [],
      deletionPolicies: [],
      residency: { type: 'managed', regions: ['test'], orgSelectable: false, description: 'test' },
      backup: { frequency: 'daily', provider: 'test', location: 'test', encryptedAtRest: true, backupRetention: '7d', rtoHours: 1, rpoHours: 1 },
    }

    const result = validateManifest(bad)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('At least one data category is required')
  })

  it('manifest hashes are deterministic', () => {
    const m1 = generateAppManifest('abr')
    const m2 = generateAppManifest('abr')
    expect(m1!.manifestHash).toBe(m2!.manifestHash)
  })
})
