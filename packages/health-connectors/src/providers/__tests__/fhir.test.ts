import { describe, it, expect } from 'vitest'
import { FHIRProvider } from '../fhir.js'

describe('FHIRProvider', () => {
  const provider = new FHIRProvider()

  it('has the correct name', () => {
    expect(provider.name).toBe('fhir')
  })

  it('healthCheck returns ok status', async () => {
    const result = await provider.healthCheck()
    expect(result.status).toBe('ok')
  })

  it('fetchPatients returns an array of patients', async () => {
    const patients = await provider.fetchPatients('org-001', 'site-001')
    expect(Array.isArray(patients)).toBe(true)
    expect(patients.length).toBeGreaterThan(0)
  })

  it('fetchPatients scopes results to provided orgId and siteId', async () => {
    const patients = await provider.fetchPatients('org-001', 'site-001')
    for (const patient of patients) {
      expect(patient.organizationId).toBe('org-001')
      expect(patient.siteId).toBe('site-001')
    }
  })

  it('fetchEncounters returns an array', async () => {
    const encounters = await provider.fetchEncounters('syn-patient-001', 'org-001')
    expect(Array.isArray(encounters)).toBe(true)
    expect(encounters.length).toBeGreaterThan(0)
  })

  it('fetchObservations returns an array', async () => {
    const observations = await provider.fetchObservations('syn-patient-001', 'org-001')
    expect(Array.isArray(observations)).toBe(true)
    expect(observations.length).toBeGreaterThan(0)
  })
})
