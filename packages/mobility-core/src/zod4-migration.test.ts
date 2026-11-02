import { describe, expect, it } from 'vitest'
import { createComplianceEventSchema, paginationSchema, createFamilyMemberSchema } from './schemas/index.js'

describe('Zod 4 mobility ingress compatibility', () => {
  const event={caseId:'11111111-1111-4111-8111-111111111111',
    eventType:'kyc_completed',severity:'info'}
  it('retains default metadata and nested record values', () => {
    expect(createComplianceEventSchema.parse(event).metadata).toEqual({})
    expect(createComplianceEventSchema.parse({...event,metadata:{source:'api',nested:{flag:true}}}).metadata)
      .toEqual({source:'api',nested:{flag:true}})
  })
  it('rejects malformed metadata, UUIDs and enums', () => {
    expect(createComplianceEventSchema.safeParse({...event,metadata:[]}).success).toBe(false)
    expect(createComplianceEventSchema.safeParse({...event,caseId:'invalid'}).success).toBe(false)
    expect(createComplianceEventSchema.safeParse({...event,severity:'unknown'}).success).toBe(false)
  })
  it('preserves bounded pagination and nullable coerced dates', () => {
    expect(paginationSchema.parse({}).pageSize).toBe(20)
    expect(paginationSchema.safeParse({pageSize:101}).success).toBe(false)
    const member={clientId:event.caseId,relation:'spouse',nationality:'CA'}
    expect(createFamilyMemberSchema.parse(member).dob).toBeNull()
    expect(createFamilyMemberSchema.parse({...member,dob:'2026-01-01'}).dob).toBeInstanceOf(Date)
  })
})
