import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isDocumentVisibleByPolicy,
  type DocumentVisibilityContext,
  type GovernancePrivacyLabel,
} from '../services/document-governance-service';

const m = vi.hoisted(() => ({ role: vi.fn() }));
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: m.role }));

import { hasSupervisoryCaseRead, roleHasSupervisoryCaseRead } from './supervisory-case-read';

describe('supervisory case-read authority', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['member', false],
    ['steward', false],
    ['union_rep', false],
    ['staff_rep', false],
    ['unknown_role', false],
    ['support_agent', false],
    [null, false],
    [undefined, false],
    ['chief_steward', true],
    ['business_agent', true],
    ['officer', true],
    ['admin', true],
    ['system_admin', true],
  ])('%s -> %s', (role, expected) => {
    expect(roleHasSupervisoryCaseRead(role as string | null | undefined)).toBe(expected);
  });

  it('resolves the role in the verified organization, not from a global role', async () => {
    m.role.mockResolvedValue('chief_steward');
    await expect(hasSupervisoryCaseRead('org-1', 'u1')).resolves.toBe(true);
    expect(m.role).toHaveBeenCalledWith('u1', 'org-1');
    m.role.mockResolvedValue(null);
    await expect(hasSupervisoryCaseRead('org-1', 'u1')).resolves.toBe(false);
  });
});

describe('document visibility without supervisory authority', () => {
  const labels: GovernancePrivacyLabel[] = [
    'public_internal', 'team_confidential', 'lro_confidential', 'privileged', 'case_restricted', 'highly_sensitive',
  ];
  const steward = (overrides: Partial<DocumentVisibilityContext> = {}): DocumentVisibilityContext => ({
    isOrgMember: true,
    isStewardPlus: false,
    isPrimaryOwner: false,
    hasCaseAccess: false,
    canViewPrivateDocuments: false,
    hasExplicitDocumentGrant: false,
    ...overrides,
  });

  it.each(labels)('hides %s documents on a case the steward cannot access', (label) => {
    expect(isDocumentVisibleByPolicy(label, steward())).toBe(false);
  });

  it('never exposes privileged or highly sensitive documents on the strength of case access alone', () => {
    for (const label of ['privileged', 'highly_sensitive'] as const) {
      expect(isDocumentVisibleByPolicy(label, steward({ hasCaseAccess: true }))).toBe(false);
    }
  });

  it('still honours an explicit document grant', () => {
    expect(isDocumentVisibleByPolicy('privileged', steward({ hasCaseAccess: true, hasExplicitDocumentGrant: true }))).toBe(true);
  });

  it('shows lro_confidential only with the collaborator private-document scope', () => {
    expect(isDocumentVisibleByPolicy('lro_confidential', steward({ hasCaseAccess: true }))).toBe(false);
    expect(isDocumentVisibleByPolicy('lro_confidential', steward({ hasCaseAccess: true, canViewPrivateDocuments: true }))).toBe(true);
  });
});
