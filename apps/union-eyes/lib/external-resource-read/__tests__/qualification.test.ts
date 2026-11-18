import { describe, expect, it } from 'vitest'
import {
  EXTERNAL_QUALIFIED_IMMUTABLE_COLUMNS,
  EXTERNAL_READ_PREQUALIFICATION,
  externalReadQualificationHash,
  parseExternalReadQualification,
  qualificationApprovalSatisfied,
  qualifiedLegacyMutationAllowed,
  type ExternalReadQualification,
  type QualificationApproval,
} from './fixtures/qualification'

const id = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const now = new Date('2026-11-17T16:00:00.000Z')
const binding = (): ExternalReadQualification => ({
  operation: EXTERNAL_READ_PREQUALIFICATION,
  qualificationId: id(1),
  approvalRequestId: id(2),
  organizationId: id(3),
  representativeUserId: 'representative-non-uuid',
  representativeOrganizationId: id(4),
  representedMemberUserId: 'member-non-uuid',
  proposedBy: 'setup-proposer',
  authority: {
    id: id(5),
    representedPersonId: id(6),
    createdBy: 'stored-grant-author',
    source: 'recorded_authority',
    scope: ['view', 'documents'],
    evidenceDocumentId: id(7),
    effectiveAt: '2026-11-17T12:00:00.000Z',
    expiresAt: '2026-11-18T18:00:00.000Z',
  },
  matter: {
    type: 'grievance',
    id: id(8),
    grantId: id(9),
    grantedBy: 'stored-grant-author',
    grantedAt: '2026-11-17T12:00:00.000Z',
    expiresAt: '2026-11-18T18:00:00.000Z',
    permissions: {
      view: true,
      comment: false,
      uploadDocuments: false,
      viewDocuments: true,
      downloadDocuments: true,
    },
  },
  document: {
    id: id(10),
    grantId: id(11),
    grantedBy: 'stored-grant-author',
    grantedAt: '2026-11-17T12:00:00.000Z',
    expiresAt: '2026-11-18T18:00:00.000Z',
    canView: true,
    canDownload: true,
    canShare: false,
    versionId: id(12),
    versionNo: 3,
    checksumSha256: 'a'.repeat(64),
    sizeBytes: 123,
    storageKeySha256: 'b'.repeat(64),
    privacyLabel: 'case_restricted',
  },
  sourceInstrument: {
    reference: 'SYNTHETIC component source; no institutional adoption claim',
    sha256: 'c'.repeat(64),
  },
  reviewedAt: '2026-11-17T13:00:00.000Z',
  effectiveAt: '2026-11-17T14:00:00.000Z',
  expiresAt: '2026-11-18T16:00:00.000Z',
})
const approval = (): QualificationApproval => ({
  id: id(2),
  organizationId: id(3),
  subjectType: EXTERNAL_READ_PREQUALIFICATION,
  subjectId: id(1),
  proposedBy: 'setup-proposer',
  subjectAuthorId: 'stored-grant-author',
  status: 'satisfied',
  riskClass: 'high',
  requiredApprovals: 2,
  namedApproverIds: ['reviewer-one', 'reviewer-two'],
  adverseUserIds: ['representative-non-uuid', 'member-non-uuid'],
  decidedAt: new Date('2026-11-17T15:00:00.000Z'),
  decisions: ['reviewer-one', 'reviewer-two'].map((approverUserId) => ({
    approverUserId,
    authorityLineUserId: approverUserId,
    delegationId: null,
    decision: 'approved',
    decidedAt: new Date('2026-11-17T15:00:00.000Z'),
  })),
})

describe('reserved external prequalification payload', () => {
  it('preserves exact non-UUID principals and hashes every source binding deterministically', () => {
    const value = binding()
    expect(parseExternalReadQualification(value)).toEqual(value)
    const hash = externalReadQualificationHash(value)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(
      externalReadQualificationHash({ ...value, matter: { ...value.matter, grantId: id(99) } }),
    ).not.toBe(hash)
    expect(
      externalReadQualificationHash({
        ...value,
        sourceInstrument: { ...value.sourceInstrument, sha256: 'd'.repeat(64) },
      }),
    ).not.toBe(hash)
    expect(
      externalReadQualificationHash({ ...value, document: { ...value.document!, versionNo: 4 } }),
    ).not.toBe(hash)
  })
  it.each([
    { expiresAt: 'infinity' },
    { expiresAt: '2026-11-17T12:00:00.000Z' },
    { reviewedAt: '2026-11-17T15:00:00.000Z' },
    { representativeUserId: ' padded ' },
    { representativeOrganizationId: id(3) },
    { approvedBy: ['untrusted'] },
    { sourceInstrument: { reference: '', sha256: 'c'.repeat(64) } },
  ])('rejects malformed, contradictory or caller-invented payload fields %j', (change) => {
    expect(() => parseExternalReadQualification({ ...binding(), ...change })).toThrow()
  })
  it('refuses parent-term widening, self-issued grants and ambiguous numeric/version fields', () => {
    const value = binding()
    expect(() =>
      parseExternalReadQualification({ ...value, expiresAt: '2026-11-19T00:00:00.000Z' }),
    ).toThrow()
    expect(() =>
      parseExternalReadQualification({
        ...value,
        authority: { ...value.authority, createdBy: value.representativeUserId },
      }),
    ).toThrow()
    expect(() =>
      parseExternalReadQualification({
        ...value,
        document: { ...value.document!, versionNo: 1.5 },
      }),
    ).toThrow()
    expect(() =>
      parseExternalReadQualification({
        ...value,
        document: { ...value.document!, sizeBytes: Number.NaN },
      }),
    ).toThrow()
  })
})

describe('prequalification reuses actual canonical approval rows', () => {
  it('requires an exact high-risk request with two distinct immutable approval decisions', () => {
    expect(qualificationApprovalSatisfied(binding(), approval(), now)).toBe(true)
    expect(qualificationApprovalSatisfied(binding(), null, now)).toBe(false)
    expect(qualificationApprovalSatisfied(binding(), { ...approval(), decisions: [] }, now)).toBe(
      false,
    )
    expect(
      qualificationApprovalSatisfied(
        binding(),
        { ...approval(), decisions: approval().decisions.slice(0, 1) },
        now,
      ),
    ).toBe(false)
  })
  it.each([
    { organizationId: id(99) },
    { subjectId: id(99) },
    { id: id(99) },
    { subjectType: 'arbitrary' },
    { proposedBy: 'another' },
    { subjectAuthorId: 'another' },
    { status: 'open' },
    { riskClass: 'low' },
    { requiredApprovals: 0 },
    { requiredApprovals: 1 },
    { requiredApprovals: 1.5 },
    { decidedAt: null },
    { decidedAt: new Date('infinity') },
    { decidedAt: new Date('2026-11-17T17:00:00.000Z') },
    { namedApproverIds: ['reviewer-one', 'reviewer-one'] },
  ])('refuses status-only, foreign, mutable or malformed request context %j', (change) => {
    expect(qualificationApprovalSatisfied(binding(), { ...approval(), ...change }, now)).toBe(false)
  })
  it('refuses duplicate, delegated, self/adverse, rejected or future votes', () => {
    for (const change of [
      { approverUserId: 'reviewer-two', authorityLineUserId: 'reviewer-two' },
      { authorityLineUserId: 'reviewer-two' },
      { delegationId: id(99) },
      { approverUserId: 'setup-proposer', authorityLineUserId: 'setup-proposer' },
      { approverUserId: 'stored-grant-author', authorityLineUserId: 'stored-grant-author' },
      { approverUserId: 'representative-non-uuid', authorityLineUserId: 'representative-non-uuid' },
      { approverUserId: 'member-non-uuid', authorityLineUserId: 'member-non-uuid' },
      { decision: 'rejected' },
      { decidedAt: new Date('2026-11-17T17:00:00.000Z') },
    ]) {
      const original = approval()
      expect(
        qualificationApprovalSatisfied(
          binding(),
          {
            ...original,
            decisions: [{ ...original.decisions[0], ...change }, original.decisions[1]],
          },
          now,
        ),
        JSON.stringify(change),
      ).toBe(false)
    }
  })
})

describe('qualified legacy authority cannot be modified and restored', () => {
  for (const table of Object.keys(
    EXTERNAL_QUALIFIED_IMMUTABLE_COLUMNS,
  ) as (keyof typeof EXTERNAL_QUALIFIED_IMMUTABLE_COLUMNS)[]) {
    const row = {
      ...Object.fromEntries(
        EXTERNAL_QUALIFIED_IMMUTABLE_COLUMNS[table].map((key) => [key, 'source-' + key]),
      ),
      status: 'active',
      revoked_at: null,
      revoked_by: null,
    }
    it(`${table}: refuses every protected source-field change and deletion`, () => {
      expect(qualifiedLegacyMutationAllowed(table, row, row)).toBe(true)
      expect(qualifiedLegacyMutationAllowed(table, row, null)).toBe(false)
      for (const column of EXTERNAL_QUALIFIED_IMMUTABLE_COLUMNS[table])
        expect(
          qualifiedLegacyMutationAllowed(table, row, { ...row, [column]: 'modified' }),
          column,
        ).toBe(false)
    })
    it(`${table}: terminal revocation never permits reactivation, backdating or a permission restore`, () => {
      const revoked = {
        ...row,
        status: 'revoked',
        revoked_by: 'known-revoker',
        revoked_at: now.toISOString(),
      }
      expect(qualifiedLegacyMutationAllowed(table, row, revoked)).toBe(true)
      expect(qualifiedLegacyMutationAllowed(table, revoked, row)).toBe(false)
      expect(
        qualifiedLegacyMutationAllowed(table, revoked, {
          ...revoked,
          revoked_at: '2026-11-17T15:00:00.000Z',
        }),
      ).toBe(false)
      expect(qualifiedLegacyMutationAllowed(table, row, { ...revoked, revoked_at: null })).toBe(
        false,
      )
      expect(qualifiedLegacyMutationAllowed(table, row, { ...revoked, revoked_by: '' })).toBe(false)
    })
  }
})
