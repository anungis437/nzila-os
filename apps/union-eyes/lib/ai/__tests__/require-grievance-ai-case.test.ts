import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.access }));
import { requireGrievanceAiCaseAccess, GrievanceAiCaseAccessDenied } from '../require-grievance-ai-case';

const subject = { userId: 'u1', organizationId: 'org-a', grievanceId: 'case-1' };
beforeEach(() => vi.clearAllMocks());

describe('AI grievance processing case authority', () => {
  it('allows only a current case-level read relationship', async () => {
    m.access.mockResolvedValue({ canViewCase: true });
    await expect(requireGrievanceAiCaseAccess(subject)).resolves.toBeUndefined();
    expect(m.access).toHaveBeenCalledWith(subject);
  });
  it('denies a steward with no case relationship', async () => {
    m.access.mockResolvedValue({ canViewCase: false });
    await expect(requireGrievanceAiCaseAccess(subject)).rejects.toBeInstanceOf(GrievanceAiCaseAccessDenied);
  });
  it('denies missing identity or case without any DB request', async () => {
    await expect(requireGrievanceAiCaseAccess({ ...subject, userId: '' })).rejects.toBeInstanceOf(GrievanceAiCaseAccessDenied);
    await expect(requireGrievanceAiCaseAccess({ ...subject, grievanceId: '' })).rejects.toBeInstanceOf(GrievanceAiCaseAccessDenied);
    expect(m.access).not.toHaveBeenCalled();
  });
  it('denies if the authority kernel cannot resolve a mandate', async () => {
    m.access.mockRejectedValue(new Error('authority database down'));
    await expect(requireGrievanceAiCaseAccess(subject)).rejects.toThrow('authority database down');
  });
});
