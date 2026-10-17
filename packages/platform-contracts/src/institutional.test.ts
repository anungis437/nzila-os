import { describe, expect, it } from 'vitest'
import {
  institutionalScopeSchema,
  institutionalReferenceSchema,
  institutionBindingSchema,
  sourceScopeBindingSchema,
  sameInstitutionalScope,
} from './institutional'

describe('Checkpoint 3 Gate A contracts', () => {
  const scope = { type: 'PLATFORM_INSTITUTION', id: 'fictional-I' } as const

  it('requires an explicit discriminated scope and rejects wildcard/system inference', () => {
    for (const invalid of [{}, { id: 'I' }, { type: 'TENANT', id: 'I' },
      { type: 'SYSTEM', id: '*' }, { ...scope, orgId: 'inferred' }]) {
      expect(institutionalScopeSchema.safeParse(invalid).success).toBe(false)
    }
    expect(institutionalScopeSchema.parse(scope)).toEqual(scope)
    expect(sameInstitutionalScope(scope, { type: 'SYSTEM', id: scope.id })).toBe(false)
    expect(sameInstitutionalScope(scope, scope)).toBe(true)
  })

  it('references require source identity, revision and explicit scope', () => {
    const reference = { scope, kind: 'Mission', namespace: 'institutional', sourceId: 'M', revision: 1 }
    expect(institutionalReferenceSchema.parse(reference)).toEqual(reference)
    expect(institutionalReferenceSchema.safeParse({ ...reference, revision: 0 }).success).toBe(false)
    expect(institutionalReferenceSchema.safeParse({ ...reference, permissions: ['deploy'] }).success).toBe(false)
  })

  it('bindings preserve mapping versions and governed attribution', () => {
    const binding = {
      institutionId: scope.id, governanceOrgId: '00000000-0000-4000-8000-000000000001',
      status: 'EFFECTIVE', version: 1, approvedBy: 'fixture-H1',
      authorityRef: 'fixture-enrollment', effectiveAt: '2026-10-12T20:00:00.000Z',
      revokedAt: null,
    }
    expect(institutionBindingSchema.parse(binding)).toEqual(binding)
    expect(institutionBindingSchema.safeParse({ ...binding, version: 0 }).success).toBe(false)
    const source = {
      namespace: 'graph', legacyIdentityKind: 'tenant_id', legacyIdentityValue: 'fictional-tenant',
      canonicalScope: scope, mappingVersion: 2, authorityRef: 'fixture-mapping',
      effectiveAt: binding.effectiveAt, revokedAt: null,
    }
    expect(sourceScopeBindingSchema.parse(source).mappingVersion).toBe(2)
    expect(sourceScopeBindingSchema.safeParse({ ...source, authorityRef: '' }).success).toBe(false)
  })
})
