/**
 * @nzila/tool-fabric — upstream drift classification
 *
 * Compares the approved descriptor with what is observed upstream now.
 * Material drift suspends execution eligibility until a new verified trust
 * decision; historic approval evidence is never rewritten.
 */
import type { DriftFinding, ToolDescriptor } from './types'
import { canonicalJson } from './authority'

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/

export function classifyDrift(approved: ToolDescriptor, observed: ToolDescriptor | null): DriftFinding {
  if (observed === null) {
    return { kind: 'VERSION_MISSING', material: true, changedFields: ['identity.version'] }
  }
  const o = observed.identity
  const a = approved.identity

  if (!o.digest || !DIGEST_PATTERN.test(o.digest)) {
    return { kind: 'PROVENANCE_UNVERIFIABLE', material: true, changedFields: ['identity.digest'] }
  }
  if (o.digest !== a.digest) {
    return { kind: 'DIGEST_CHANGED', material: true, changedFields: ['identity.digest'] }
  }
  if (observed.provenance.mutableUpstream && !approved.provenance.mutableUpstream) {
    return { kind: 'SOURCE_BECAME_MUTABLE', material: true, changedFields: ['provenance.mutableUpstream'] }
  }
  const before = new Set(approved.declaredSideEffects)
  if (observed.declaredSideEffects.some((s) => !before.has(s))) {
    return { kind: 'SIDE_EFFECTS_WIDENED', material: true, changedFields: ['declaredSideEffects'] }
  }

  const changed: string[] = []
  if (a.packageCoordinates !== o.packageCoordinates) changed.push('identity.packageCoordinates')
  if (a.sourceRepository !== o.sourceRepository) changed.push('identity.sourceRepository')
  if (a.license !== o.license) changed.push('identity.license')
  if (approved.displayName !== observed.displayName) changed.push('displayName')
  if (JSON.stringify([...approved.claimedCapabilities].sort()) !== JSON.stringify([...observed.claimedCapabilities].sort())) {
    changed.push('claimedCapabilities')
  }
  if (JSON.stringify(approved.commands) !== JSON.stringify(observed.commands)) changed.push('commands')
  if (a.name !== o.name) changed.push('identity.name')
  if (a.version !== o.version) changed.push('identity.version')
  if (a.providerId !== o.providerId) changed.push('identity.providerId')
  if (approved.sourceClass !== observed.sourceClass) changed.push('sourceClass')
  if (canonicalJson(approved.declaredSideEffects) !== canonicalJson(observed.declaredSideEffects)) changed.push('declaredSideEffects')
  if (approved.provenance.upstreamRef !== observed.provenance.upstreamRef) changed.push('provenance.upstreamRef')
  if (approved.provenance.discoveredVia !== observed.provenance.discoveredVia) changed.push('provenance.discoveredVia')
  const material = changed.some((field) => field !== 'displayName')

  return changed.length === 0
    ? { kind: 'UNCHANGED', material: false, changedFields: [] }
    : { kind: 'METADATA_CHANGED', material, changedFields: changed }
}
