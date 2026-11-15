import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const mocks = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn((handler: (...args: any[]) => unknown) => handler),
  hasMinRole: vi.fn(),
  confirmDeadline: vi.fn(),
  overrideDeadline: vi.fn(),
  supersedeDeadline: vi.fn(),
}));

vi.mock('@/lib/cases/case-authorization', () => ({ caseAuthorizationResponse: (error: { code?: string }) => error?.code === 'FORBIDDEN' ? new Response(JSON.stringify({error:'FORBIDDEN'}), { status: 403 }) : null }));
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
    mocks.confirmDeadline.mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555', confirmationStatus: 'HUMAN_CONFIRMED' });
    mocks.overrideDeadline.mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555', confirmationStatus: 'OVERRIDDEN' });
    mocks.supersedeDeadline.mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555', confirmationStatus: 'SUPERSEDED' });
  });

  it('routes confirmation requests through the deadline confirmation service', async () => {
    const response = await POST(
      new Request('https://example.test/api/grievance-deadlines/55555555-5555-4555-8555-555555555555/confirmation', {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm' }),
      }),
      { organizationId: 'org-1', userId: 'user-1' },
      { id: '55555555-5555-4555-8555-555555555555' },
    );

    expect(response.status).toBe(200);
    expect(mocks.confirmDeadline).toHaveBeenCalledWith({
      deadlineId: '55555555-5555-4555-8555-555555555555',
      organizationId: 'org-1',
      actorId: 'user-1',
    });
  });

  it('denies non-steward callers', async () => {
    mocks.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(
      new Request('https://example.test/api/grievance-deadlines/55555555-5555-4555-8555-555555555555/confirmation', {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm' }),
      }),
      { organizationId: 'org-1', userId: 'user-1' },
      { id: '55555555-5555-4555-8555-555555555555' },
    );

    expect(response.status).toBe(403);
    expect(mocks.confirmDeadline).not.toHaveBeenCalled();
  });

  const override = (overrideDueDate: string) => POST(
    new Request('https://example.test/api/grievance-deadlines/55555555-5555-4555-8555-555555555555/confirmation', {
      method: 'POST',
      body: JSON.stringify({ action: 'override', overrideDueDate, overrideReason: 'CBA art. 8.02 extension' }),
    }),
    { organizationId: 'org-1', userId: 'user-1' },
    { id: '55555555-5555-4555-8555-555555555555' },
  );

  it('passes a calendar-day override to the service as the day, to fall due at 23:59 in the organization zone', async () => {
    const response = await override('2026-03-20');
    expect(response.status).toBe(200);
    expect(mocks.overrideDeadline).toHaveBeenCalledWith(expect.objectContaining({ overrideDueDate: '2026-03-20' }));
  });

  it('keeps a datetime override as the instant sent', async () => {
    const response = await override('2026-03-20T15:30:00.000Z');
    expect(response.status).toBe(200);
    expect(mocks.overrideDeadline).toHaveBeenCalledWith(expect.objectContaining({ overrideDueDate: new Date('2026-03-20T15:30:00.000Z') }));
  });

  it('refuses a day that does not exist', async () => {
    const response = await override('2026-02-30');
    expect(response.status).toBe(400);
    expect(mocks.overrideDeadline).not.toHaveBeenCalled();
  });
});



it('returns the service authority refusal as 403', async () => {
  mocks.hasMinRole.mockResolvedValue(true); mocks.confirmDeadline.mockRejectedValueOnce(ApiError.forbidden());
  const result = await POST(new Request('https://example.test/confirmation', { method: 'POST', body: JSON.stringify({ action: 'confirm' }) }), { organizationId: 'org-1', userId: 'user-1' }, { id: '55555555-5555-4555-8555-555555555555' });
  expect(result.status).toBe(403);
});
