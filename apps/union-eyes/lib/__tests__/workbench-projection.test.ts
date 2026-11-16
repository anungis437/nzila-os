import { describe, expect, it } from 'vitest';
import { projectWorkbenchRow, workbenchCapabilities } from '../cases/workbench-projection';

const row = {
  claimId: 'c1', claimNumber: 'CLM-1', organizationId: 'org-1', memberId: 'member-9', isAnonymous: false,
  claimType: 'grievance_pay', status: 'submitted', priority: 'high', assignedTo: 'steward-1', assignedAt: null,
  description: 'narrative', desiredOutcome: 'outcome', witnessDetails: 'witness', attachments: ['a'],
  voiceTranscriptions: ['t'], metadata: { k: 1 }, memberName: 'Pat', memberEmail: 'p@example.test',
  memberPhone: '555', createdAt: 'x', updatedAt: 'y', closedAt: null,
};

describe('workbench projection uses explicit kernel decisions', () => {
  it('keeps authorized case detail when the caller supplies a case-read allow', () => {
    expect(projectWorkbenchRow(row, 'case', false)).toMatchObject({ access: 'case', memberEmail: 'p@example.test', canAssign: false });
  });
  it('withholds identity and narrative on a triage decision even when a stale mirror names the actor', () => {
    const projected = projectWorkbenchRow(row, 'triage', true);
    expect(projected).toMatchObject({ access: 'triage', claimId: 'c1', canAssign: true });
    for (const field of ['memberId','memberEmail','memberName','description','attachments','metadata']) expect(projected).not.toHaveProperty(field);
  });
  it('does not infer assignment from rank or from permission on a different case', () => {
    expect(workbenchCapabilities([{ canAssign: false }]).canAssign).toBe(false);
    expect(workbenchCapabilities([{ canAssign: true }, { canAssign: false }]).canAssign).toBe(true);
  });
});
