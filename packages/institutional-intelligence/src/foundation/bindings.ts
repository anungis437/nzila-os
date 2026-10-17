import {
  institutionBindingSchema, sourceScopeBindingSchema, sameInstitutionalScope,
  type InstitutionalScope, type InstitutionBinding, type SourceScopeBinding,
} from '@nzila/platform-contracts'
import type { LocalInstitutionalStore } from './local-store'
import { z } from 'zod'

export const bindingRegistryScope: InstitutionalScope = { type: 'SYSTEM', id: 'institutional-bindings' }

export class ScopedBindingAdapter {
  constructor(private readonly store: LocalInstitutionalStore) {}

  institution(scope: InstitutionalScope, at: string): InstitutionBinding {
    if (scope.type !== 'PLATFORM_INSTITUTION') throw new Error('INSTITUTION_SCOPE_REQUIRED')
    const matches = this.store.list(bindingRegistryScope, 'InstitutionBinding')
      .map(row => institutionBindingSchema.parse(row.data))
      .filter(binding => binding.institutionId === scope.id && binding.effectiveAt <= at)
    const effective = matches.filter(binding => binding.status === 'EFFECTIVE' && binding.revokedAt === null)
    if (effective.length !== 1) throw new Error(effective.length > 1 ? 'AMBIGUOUS_BINDING' : 'MISSING_OR_REVOKED_BINDING')
    const enrollment = this.store.get(scope, 'InstitutionBinding', scope.id)
    if (enrollment) {
      const metadata = z.object({ auditEventId: z.string().uuid() }).parse(enrollment.data)
      const proof = this.store.get(scope, 'AuditProofState', metadata.auditEventId)
      if (!proof || z.object({ status: z.string() }).parse(proof.data).status !== 'RECORDED') throw new Error('ENROLLMENT_PROOF_PENDING')
    }
    return effective[0]!
  }

  source(namespace: string, identityKind: SourceScopeBinding['legacyIdentityKind'], value: string,
    at: string, mappingVersion?: number): SourceScopeBinding {
    const records = mappingVersion === undefined
      ? this.store.list(bindingRegistryScope, 'SourceScopeBinding')
      : this.store.revisions(bindingRegistryScope, 'SourceScopeBinding')
    const matches = records
      .map(row => sourceScopeBindingSchema.parse(row.data))
      .filter(binding => binding.namespace === namespace && binding.legacyIdentityKind === identityKind
        && binding.legacyIdentityValue === value && binding.effectiveAt <= at
        && (mappingVersion === undefined ? binding.revokedAt === null : binding.mappingVersion === mappingVersion))
    if (matches.length !== 1) throw new Error(matches.length > 1 ? 'AMBIGUOUS_SOURCE_BINDING' : 'MISSING_OR_REVOKED_SOURCE_BINDING')
    return matches[0]!
  }

  assertSource(namespace: string, kind: SourceScopeBinding['legacyIdentityKind'], value: string,
    expected: InstitutionalScope, at: string): SourceScopeBinding {
    const binding = this.source(namespace, kind, value, at)
    if (!sameInstitutionalScope(binding.canonicalScope, expected)) throw new Error('SOURCE_SCOPE_MISMATCH')
    return binding
  }
}
