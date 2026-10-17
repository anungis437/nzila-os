import { describe, expect, it } from 'vitest'
import { LocalInstitutionalStore } from './local-store'
import { ScopedBindingAdapter, bindingRegistryScope } from './bindings'

describe('Checkpoint 3 Gate B explicit bindings', () => {
  it('rejects missing, conflicting, revoked and raw-equality mappings', () => {
    const store = new LocalInstitutionalStore(':memory:')
    const adapter = new ScopedBindingAdapter(store)
    const now = '2026-10-12T21:00:00.000Z'
    const scope = { type: 'PLATFORM_INSTITUTION', id: 'fictional-I' } as const
    const binding = {
      institutionId: scope.id, governanceOrgId: '00000000-0000-4000-8000-000000000001',
      status: 'EFFECTIVE', version: 1, approvedBy: 'fictional-H1', authorityRef: 'fixture',
      effectiveAt: '2026-10-12T20:00:00.000Z', revokedAt: null,
    }
    try {
      expect(() => adapter.institution(scope, now)).toThrow('MISSING_OR_REVOKED_BINDING')
      store.transaction(() => store.append(bindingRegistryScope, 'InstitutionBinding', 'one', 0, binding))
      expect(adapter.institution(scope, now).version).toBe(1)
      store.transaction(() => store.append(bindingRegistryScope, 'InstitutionBinding', 'two', 0, binding))
      expect(() => adapter.institution(scope, now)).toThrow('AMBIGUOUS_BINDING')
      store.transaction(() => {
        for (const id of ['one', 'two']) store.append(bindingRegistryScope, 'InstitutionBinding', id, 1,
          { ...binding, status: 'REVOKED', revokedAt: now })
      })
      expect(() => adapter.institution(scope, now)).toThrow('MISSING_OR_REVOKED_BINDING')
      expect(() => adapter.source('graph', 'tenant_id', scope.id, now)).toThrow('MISSING_OR_REVOKED_SOURCE_BINDING')
      store.transaction(() => store.append(bindingRegistryScope, 'SourceScopeBinding', 'graph', 0, {
        namespace: 'graph', legacyIdentityKind: 'tenant_id', legacyIdentityValue: 'fictional-tenant',
        canonicalScope: scope, mappingVersion: 3, authorityRef: 'fixture', effectiveAt: binding.effectiveAt,
        revokedAt: now,
      }))
      expect(() => adapter.source('graph', 'tenant_id', 'fictional-tenant', now)).toThrow('MISSING_OR_REVOKED_SOURCE_BINDING')
      expect(adapter.source('graph', 'tenant_id', 'fictional-tenant', now, 3).canonicalScope).toEqual(scope)
      const prior = adapter.source('graph', 'tenant_id', 'fictional-tenant', now, 3)
      store.transaction(() => store.append(bindingRegistryScope, 'SourceScopeBinding', 'graph', 1, {
        ...prior, mappingVersion: 4, revokedAt: null,
      }))
      expect(adapter.source('graph', 'tenant_id', 'fictional-tenant', now, 3).revokedAt).toBe(now)
      expect(adapter.source('graph', 'tenant_id', 'fictional-tenant', now).mappingVersion).toBe(4)
      expect(() => adapter.assertSource('graph', 'tenant_id', 'fictional-tenant',
        { type: 'SYSTEM', id: scope.id }, now)).toThrow('SOURCE_SCOPE_MISMATCH')
    } finally {
      store.close()
    }
  })
})
