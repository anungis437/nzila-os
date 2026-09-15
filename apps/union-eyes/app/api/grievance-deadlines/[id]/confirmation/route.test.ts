import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn((handler: (...args: any[]) => unknown) => handler),
  hasMinRole: vi.fn(),
  confirmDeadline: vi.fn(),
  overrideDeadline: vi.fn(),
  supersedeDeadline: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: mocks.withOrganizationAuth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: mocks.hasMinRole }));
vi.mock('@/lib/services/deadline-confirmation-service', () => ({
  confirmDeadline: mocks.confirmDeadline,
  overrideDeadline: mocks.overrideDeadline,
  supersedeDeadline: mocks.supersedeDeadline,
}));

const { POST } = await import('@/app/api/grievance-deadlines/[id]/confirmation/route');

describe('POST /api/grievance-deadlines/[id]/confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasMinRole.mockResolvedValue(true);
    mocks.confirmDeadline.mockResolvedValue({ id: 'deadline-1', confirmationStatus: 'HUMAN_CONFIRMED' });
    mocks.overrideDeadline.mockResolvedValue({ id: 'deadline-1', confirmationStatus: 'OVERRIDDEN' });
    mocks.supersedeDeadline.mockResolvedValue({ id: 'deadline-1', confirmationStatus: 'SUPERSEDED' });
  });

  it('routes confirmation requests through the deadline confirmation service', async () => {
    const response = await POST(
      new Request('https://example.test/api/grievance-deadlines/deadline-1/confirmation', {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm' }),
      }),
      { organizationId: 'org-1', userId: 'user-1' },
      { id: 'deadline-1' },
    );

    expect(response.status).toBe(200);
    expect(mocks.confirmDeadline).toHaveBeenCalledWith({
      deadlineId: 'deadline-1',
      organizationId: 'org-1',
      actorId: 'user-1',
    });
  });

  it('denies non-steward callers', async () => {
    mocks.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(
      new Request('https://example.test/api/grievance-deadlines/deadline-1/confirmation', {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm' }),
      }),
      { organizationId: 'org-1', userId: 'user-1' },
      { id: 'deadline-1' },
    );

    expect(response.status).toBe(403);
    expect(mocks.confirmDeadline).not.toHaveBeenCalled();
  });
});

