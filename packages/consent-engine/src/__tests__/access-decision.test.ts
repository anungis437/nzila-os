import { describe, it, expect } from 'vitest'
import { decideAccess, ROLE_SCOPE_MAP } from '../access-decision.js'
import { ConsentRole, ConsentScope } from '../types.js'

const baseInput = {
  actorId: 'actor-001',
  patientId: 'patient-001',
  organizationId: 'org-001',
  siteId: 'site-001',
}

describe('decideAccess', () => {
  it('CLINICIAN can READ_LABS', () => {
    const result = decideAccess({
      ...baseInput,
      role: ConsentRole.CLINICIAN,
      requestedScope: ConsentScope.READ_LABS,
    })
    expect(result.allowed).toBe(true)
    expect(result.requiresBreakGlass).toBe(false)
  })

  it('CLINICIAN can READ_TIMELINE', () => {
    const result = decideAccess({
      ...baseInput,
      role: ConsentRole.CLINICIAN,
      requestedScope: ConsentScope.READ_TIMELINE,
    })
    expect(result.allowed).toBe(true)
  })

  it('CLINICIAN cannot FULL_ACCESS', () => {
    const result = decideAccess({
      ...baseInput,
      role: ConsentRole.CLINICIAN,
      requestedScope: ConsentScope.FULL_ACCESS,
    })
    expect(result.allowed).toBe(false)
    expect(result.requiresBreakGlass).toBe(false)
  })

  it('BREAK_GLASS is always allowed and flags requiresBreakGlass', () => {
    const result = decideAccess({
      ...baseInput,
      role: ConsentRole.CLINICIAN,
      requestedScope: ConsentScope.BREAK_GLASS,
      reason: 'Emergency access required',
    })
    expect(result.allowed).toBe(true)
    expect(result.requiresBreakGlass).toBe(true)
  })

  it('BREAK_GLASS without reason uses default reason string', () => {
    const result = decideAccess({
      ...baseInput,
      role: ConsentRole.NURSE,
      requestedScope: ConsentScope.BREAK_GLASS,
    })
    expect(result.allowed).toBe(true)
    expect(result.requiresBreakGlass).toBe(true)
    expect(result.reason).toBeTruthy()
  })

  it('ADMIN can FULL_ACCESS', () => {
    const result = decideAccess({
      ...baseInput,
      role: ConsentRole.ADMIN,
      requestedScope: ConsentScope.FULL_ACCESS,
    })
    expect(result.allowed).toBe(true)
    expect(result.requiresBreakGlass).toBe(false)
  })

  it('NURSE cannot WRITE_NOTES', () => {
    const result = decideAccess({
      ...baseInput,
      role: ConsentRole.NURSE,
      requestedScope: ConsentScope.WRITE_NOTES,
    })
    expect(result.allowed).toBe(false)
  })

  it('AUDITOR can only READ_TIMELINE', () => {
    const result = decideAccess({
      ...baseInput,
      role: ConsentRole.AUDITOR,
      requestedScope: ConsentScope.READ_LABS,
    })
    expect(result.allowed).toBe(false)
  })
})

describe('ROLE_SCOPE_MAP', () => {
  it('CLINICIAN has READ_LABS in scope map', () => {
    expect(ROLE_SCOPE_MAP[ConsentRole.CLINICIAN]).toContain(ConsentScope.READ_LABS)
  })

  it('ADMIN has FULL_ACCESS in scope map', () => {
    expect(ROLE_SCOPE_MAP[ConsentRole.ADMIN]).toContain(ConsentScope.FULL_ACCESS)
  })
})
