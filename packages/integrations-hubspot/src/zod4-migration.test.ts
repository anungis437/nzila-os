import { describe, expect, it } from 'vitest'
import { hubspotContactSchema } from './contacts'
import { hubspotDealSchema } from './deals'

describe('Zod 4 HubSpot boundary compatibility', () => {
  it('preserves nullable contact defaults', () => {
    const parsed = hubspotContactSchema.parse({ id: 'contact-1', properties: {} })
    expect(parsed.properties.firstname).toBeNull()
    expect(parsed.properties.email).toBeNull()
  })

  it('rejects invalid external contact and deal payloads', () => {
    expect(hubspotContactSchema.safeParse({ id: 'contact-1', properties: { email: 'not-an-email' } }).success).toBe(false)
    expect(hubspotContactSchema.safeParse({ id: 10, properties: {} }).success).toBe(false)
    expect(hubspotDealSchema.safeParse({ id: null, properties: {} }).success).toBe(false)
  })
})
