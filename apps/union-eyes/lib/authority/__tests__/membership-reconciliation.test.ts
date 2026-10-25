import { describe, expect, it } from 'vitest'
import {
  canonicalMembershipStatus,
  projectionMembershipStatus,
  reconcileMembershipProjection,
  type CanonicalMembershipRow,
  type ProjectionMembershipRow,
} from '../store/membership-reconciliation'

const ORG = '00000000-0000-4000-8000-00000000000a'
const ORG_B = '00000000-0000-4000-8000-00000000000b'
const NOW = new Date('2026-10-24T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms)
const ahead = (ms: number) => new Date(NOW.getTime() + ms)
const DAY = 86_400_000

const proj = (userId: string, over: Partial<ProjectionMembershipRow> = {}): ProjectionMembershipRow => ({
  userId, organizationId: ORG, role: 'steward', memberActive: true, userActive: true, lifecycleState: 'active', ...over,
})
const canon = (userId: string, over: Partial<CanonicalMembershipRow> = {}): CanonicalMembershipRow => ({
  platformUserId: userId, organizationId: ORG, role: 'steward', state: 'active', effectiveFrom: ago(DAY), effectiveTo: null, revokedAt: null, ...over,
})
const run = (p: ProjectionMembershipRow[], c: CanonicalMembershipRow[], options = {}) => reconcileMembershipProjection(p, c, { now: NOW, ...options })

describe('canonical membership status at a point in time', () => {
  it.each([
    [{}, 'active'],
    [{ state: 'suspended' }, 'suspended'],
    [{ state: 'revoked' }, 'revoked'],
    [{ state: 'invited' }, 'inactive'],
    [{ revokedAt: ago(1) }, 'revoked'],
    [{ effectiveFrom: ahead(DAY) }, 'inactive'],
    [{ effectiveTo: ago(1) }, 'inactive'],
    [{ effectiveTo: ahead(DAY) }, 'active'],
  ] as const)('%j is %s', (over, expected) => {
    expect(canonicalMembershipStatus(canon('u', over as Partial<CanonicalMembershipRow>), NOW)).toBe(expected)
  })

  it('an unknown state or an unreadable timestamp throws (fail closed, never "active")', () => {
    expect(() => canonicalMembershipStatus(canon('u', { state: 'pending_review' }), NOW)).toThrow(/unknown canonical membership state/)
    expect(() => canonicalMembershipStatus(canon('u', { effectiveFrom: 'not a date' }), NOW)).toThrow(/unmappable timestamp/)
  })
})

describe('projection membership status is the kernel’s own mapping', () => {
  it.each([
    [{}, 'active'],
    [{ memberActive: false }, 'inactive'],
    [{ userActive: false }, 'inactive'],
    [{ userActive: null }, 'inactive'],
    [{ lifecycleState: 'suspended' }, 'suspended'],
    [{ lifecycleState: 'deprovisioned' }, 'revoked'],
    [{ lifecycleState: null }, 'inactive'],
    [{ lifecycleState: 'something_else' }, 'inactive'],
  ] as const)('%j is %s', (over, expected) => {
    expect(projectionMembershipStatus(proj('u', over as Partial<ProjectionMembershipRow>))).toBe(expected)
  })
})

describe('reconcileMembershipProjection', () => {
  it('two agreeing snapshots are consistent', () => {
    const r = run([proj('a'), proj('b', { role: 'member' })], [canon('a'), canon('b', { role: 'member' })])
    expect(r).toMatchObject({ consistent: true, drifts: [], staleGrants: 0, projectionRows: 2, canonicalRows: 2 })
  })

  it('an empty comparison is consistent', () => {
    expect(run([], []).consistent).toBe(true)
  })

  it('an ACTIVE projection row with no canonical membership is a stale grant', () => {
    const r = run([proj('a')], [])
    expect(r.drifts).toEqual([expect.objectContaining({ kind: 'MISSING_IN_CANONICAL', risk: 'PROJECTION_GRANTS_CANONICAL_DENIES', projectionStatus: 'active', canonicalStatus: null })])
    expect(r.staleGrants).toBe(1)
  })

  it('an inactive projection row with no canonical membership is neutral', () => {
    const r = run([proj('a', { memberActive: false })], [])
    expect(r.drifts[0]).toMatchObject({ kind: 'MISSING_IN_CANONICAL', risk: 'NEUTRAL' })
    expect(r.staleGrants).toBe(0)
  })

  it('an active canonical membership with no projection row is an availability drift (the kernel would deny)', () => {
    const r = run([], [canon('a')])
    expect(r.drifts[0]).toMatchObject({ kind: 'MISSING_IN_PROJECTION', risk: 'CANONICAL_GRANTS_PROJECTION_DENIES', canonicalStatus: 'active' })
    expect(r.staleGrants).toBe(0)
  })

  it('projection active while canonical is revoked / suspended / lapsed / not yet effective is a stale grant', () => {
    for (const over of [{ state: 'revoked' }, { state: 'suspended' }, { revokedAt: ago(1) }, { effectiveTo: ago(1) }, { effectiveFrom: ahead(DAY) }, { state: 'invited' }]) {
      const r = run([proj('a')], [canon('a', over as Partial<CanonicalMembershipRow>)])
      expect(r.drifts, JSON.stringify(over)).toEqual([expect.objectContaining({ kind: 'STATUS_MISMATCH', risk: 'PROJECTION_GRANTS_CANONICAL_DENIES' })])
      expect(r.staleGrants).toBe(1)
    }
  })

  it('projection deactivated / suspended / deprovisioned while canonical is active denies what the canonical record grants', () => {
    for (const over of [{ memberActive: false }, { userActive: false }, { lifecycleState: 'suspended' }, { lifecycleState: 'deprovisioned' }]) {
      const r = run([proj('a', over as Partial<ProjectionMembershipRow>)], [canon('a')])
      expect(r.drifts, JSON.stringify(over)).toEqual([expect.objectContaining({ kind: 'STATUS_MISMATCH', risk: 'CANONICAL_GRANTS_PROJECTION_DENIES' })])
    }
  })

  it('two different non-active states are a neutral mismatch (nobody is granted anything)', () => {
    const r = run([proj('a', { lifecycleState: 'suspended' })], [canon('a', { state: 'revoked' })])
    expect(r.drifts).toEqual([expect.objectContaining({ kind: 'STATUS_MISMATCH', risk: 'NEUTRAL', projectionStatus: 'suspended', canonicalStatus: 'revoked' })])
    expect(r.consistent).toBe(false)
  })

  it('role differences are reported, flagged when the eligibility capacities differ, and mapped through normalizeRole', () => {
    const r = run([proj('a', { role: 'steward' })], [canon('a', { role: 'president' })])
    expect(r.drifts[0]).toMatchObject({ kind: 'ROLE_MISMATCH', risk: 'NEUTRAL' })
    expect(r.drifts[0].detail).toContain('eligibility capacities differ')
    const cosmetic = run([proj('a', { role: 'Steward ' })], [canon('a', { role: 'steward' })])
    expect(cosmetic.consistent).toBe(true)
    const vocabulary = run([proj('a', { role: 'admin' })], [canon('a', { role: 'org_admin' })], { normalizeRole: (role: string) => (role === 'admin' ? 'org_admin' : role) })
    expect(vocabulary.consistent).toBe(true)
  })

  it('duplicates on either side are reported and not guessed at', () => {
    const a = run([proj('a'), proj('a', { role: 'member' })], [canon('a')])
    expect(a.drifts).toEqual([expect.objectContaining({ kind: 'DUPLICATE_PROJECTION' })])
    const b = run([proj('a')], [canon('a'), canon('a', { role: 'member' })])
    expect(b.drifts).toEqual([expect.objectContaining({ kind: 'DUPLICATE_CANONICAL' })])
  })

  it('an unreadable canonical row is reported and treated as dangerous when the projection grants', () => {
    const r = run([proj('a')], [canon('a', { state: 'mystery' })])
    expect(r.drifts).toEqual([expect.objectContaining({ kind: 'UNREADABLE_ROW', risk: 'PROJECTION_GRANTS_CANONICAL_DENIES' })])
    expect(r.staleGrants).toBe(1)
  })

  it('the same person in two organizations is judged per organization (and organization ids compare case-insensitively)', () => {
    const r = run(
      [proj('a'), proj('a', { organizationId: ORG_B })],
      [canon('a', { organizationId: ORG.toUpperCase() }), canon('a', { organizationId: ORG_B, state: 'revoked' })],
    )
    expect(r.drifts).toEqual([expect.objectContaining({ kind: 'STATUS_MISMATCH', organizationId: ORG_B, risk: 'PROJECTION_GRANTS_CANONICAL_DENIES' })])
  })

  it('summarises by kind, is deterministic, and does not mutate its inputs', () => {
    const p = [proj('b'), proj('a', { memberActive: false }), proj('c')]
    const c = [canon('a'), canon('d')]
    const before = JSON.stringify([p, c])
    const first = run(p, c)
    const second = run([...p].reverse(), [...c].reverse())
    expect(JSON.stringify([p, c])).toBe(before)
    expect(first.summary).toMatchObject({ MISSING_IN_CANONICAL: 2, MISSING_IN_PROJECTION: 1, STATUS_MISMATCH: 1, ROLE_MISMATCH: 0 })
    expect(first.drifts.map((d) => `${d.kind}:${d.userId}`)).toEqual(second.drifts.map((d) => `${d.kind}:${d.userId}`))
  })
})
