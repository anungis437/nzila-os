import { describe, expect, it } from 'vitest';
import { readClaimRow } from './claim-row';

// What GET /api/cases lists for a case the caller may read in full, as JSON.
const full = {
  claimId: 'c1',
  claimNumber: 'CLM-20260101-0001',
  organizationId: 'o1',
  memberId: 'u1',
  isAnonymous: true,
  claimType: 'grievance_pay',
  status: 'under_review',
  priority: 'critical',
  incidentDate: '2026-01-02T14:00:00.000Z',
  createdAt: '2026-01-03T15:00:00.000Z',
  assignedTo: 'u2',
  memberName: 'Ana Roy',
  assignedToName: 'Sam Lee',
};

describe('readClaimRow', () => {
  it('reads a case with its member and assignee', () => {
    expect(readClaimRow(full)).toEqual({
      claimId: 'c1',
      claimNumber: 'CLM-20260101-0001',
      memberName: 'Ana Roy',
      claimType: 'grievance_pay',
      status: 'under_review',
      priority: 'critical',
      incidentDate: new Date('2026-01-02T14:00:00.000Z'),
      createdAt: new Date('2026-01-03T15:00:00.000Z'),
      assigned: true,
      assignedToName: 'Sam Lee',
      triageOnly: false,
    });
  });

  it('keeps what the database leaves empty empty: no member, assignee, number, type or incident date is made up', () => {
    const row = readClaimRow({ claimId: 'c2', status: 'submitted', priority: 'medium', createdAt: '2026-01-03T15:00:00.000Z', claimNumber: null, claimType: null, incidentDate: null, memberName: null, assignedTo: null, assignedToName: null });
    expect(row).toMatchObject({ claimNumber: null, claimType: null, incidentDate: null, memberName: null, assigned: false, assignedToName: null, triageOnly: false });
  });

  it('says a case is assigned even when the assignee has no name any more, instead of calling it unassigned', () => {
    expect(readClaimRow({ ...full, assignedToName: null })).toMatchObject({ assigned: true, assignedToName: null });
  });

  it('reads a row of the triage queue, which has no member and no assignee by design', () => {
    expect(readClaimRow({ claimId: 'c3', claimNumber: 'CLM-3', claimType: 'other', status: 'submitted', priority: 'low', createdAt: '2026-01-03T15:00:00.000Z', filedDate: null, triageOnly: true })).toMatchObject({ triageOnly: true, assigned: false, memberName: null });
  });

  it('refuses a row without the columns the database never leaves empty', () => {
    expect(() => readClaimRow({ ...full, claimId: undefined })).toThrow(/claimId is missing/);
    expect(() => readClaimRow({ ...full, status: '' })).toThrow(/status is missing/);
    expect(() => readClaimRow({ ...full, createdAt: 'yesterday' })).toThrow(/createdAt is not a date/);
    expect(() => readClaimRow('not a row')).toThrow(/case is not a record/);
  });
});
