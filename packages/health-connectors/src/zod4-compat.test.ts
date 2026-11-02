import { describe, expect, it } from 'vitest'
import { PatientRecord } from './types'

const valid = {id:'p1',mrn:'m1',firstName:'A',lastName:'B',dateOfBirth:'2000-01-01',sourceSystem:'ehr',organizationId:'org-a',siteId:'site-a',environment:'staging'}

describe('Zod 4 health-connectors schema compatibility', () => {
  it('accepts the canonical shape and rejects a malformed or unsafe input', () => {
    expect(PatientRecord.safeParse(valid).success).toBe(true)
    expect(PatientRecord.safeParse({id:'p1',mrn:'m1',firstName:'A',lastName:'B',dateOfBirth:'2000-01-01',sourceSystem:'ehr',siteId:'site-a',environment:'staging'}).success).toBe(false)
  })
})
