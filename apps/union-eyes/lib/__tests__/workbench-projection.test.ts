import { describe, expect, it } from 'vitest';
import type { CaseActor } from '../cases/case-authorization';
import { projectWorkbenchRow, workbenchAccess, workbenchCapabilities } from '../cases/workbench-projection';

const steward: CaseActor = { userId: 'steward-1', organizationId: 'org-1', role: 'steward' };
const chief: CaseActor = { userId: 'chief-1', organizationId: 'org-1', role: 'chief_steward' };

const row = {
  claimId: 'c1', claimNumber: 'CLM-1', organizationId: 'org-1', memberId: 'member-9', isAnonymous: false,
  claimType: 'grievance_pay', status: 'submitted', priority: 'high', assignedTo: 'steward-1', assignedAt: null,
  description: 'narrative', desiredOutcome: 'outcome', witnessDetails: 'witness', attachments: ['a'],
  voiceTranscriptions: ['t'], metadata: { k: 1 }, memberName: 'Pat', memberEmail: 'p@example.test',
  memberPhone: '555', createdAt: 'x', updatedAt: 'y', closedAt: null,
};

describe('workbench projection', () => {
  it('gives case-level detail to the assigned representative', () => {
    expect(workbenchAccess(steward, row)).toBe('case');
    expect(projectWorkbenchRow(steward, row)).toMatchObject({ access: 'case', memberEmail: 'p@example.test' });
  });

  it('reduces unassigned-to-me matters to triage metadata without member PII or narrative', () => {
    const projected = projectWorkbenchRow(chief, row);
    expect(projected.access).toBe('triage');
    for (const leaked of ['memberId', 'memberName', 'memberEmail', 'memberPhone', 'description', 'desiredOutcome',
      'witnessDetails', 'attachments', 'voiceTranscriptions', 'metadata']) {
      expect(projected).not.toHaveProperty(leaked);
    }
    expect(projected).toMatchObject({ claimId: 'c1', claimNumber: 'CLM-1', status: 'submitted' });
  });

  it('lets the filing member see their own matter in full', () => {
    const member: CaseActor = { userId: 'member-9', organizationId: 'org-1', role: 'steward' };
    expect(workbenchAccess(member, row)).toBe('case');
  });

  it('exposes assignment only where case_assign policy allows it', () => {
    expect(workbenchCapabilities(steward).canAssign).toBe(false);
    expect(workbenchCapabilities(chief).canAssign).toBe(true);
  });
});
