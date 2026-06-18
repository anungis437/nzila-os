import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockSendEmail: vi.fn(),
  mockRender: vi.fn(),
  mockGetUser: vi.fn(),
  mockAdminClient: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('../email-service', () => ({
  sendEmail: mocks.mockSendEmail.mockResolvedValue({ success: true }),
}));

vi.mock('@react-email/render', () => ({
  render: mocks.mockRender.mockReturnValue('<html>email</html>'),
}));

vi.mock('../email-templates', () => ({
  ClaimStatusNotificationEmail: vi.fn(() => null),
}));

vi.mock('../../db/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere.mockReturnValue({
          limit: mocks.mockLimit,
        }),
      }),
    }),
  },
}));

vi.mock('../../db/schema/claims-schema', () => ({
  claims: { claimId: 'claimId', claimType: 'claimType', memberId: 'memberId', assignedTo: 'assignedTo', organizationId: 'organizationId', description: 'description' },
}));

vi.mock('../../db/schema/deadlines-schema', () => ({
  deadlines: {},
}));

vi.mock('../workflow-engine', () => ({
  ClaimStatus: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  relations: vi.fn(() => ({})),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({
  adminClient: {
    users: {
      getUser: mocks.mockGetUser,
    },
  },
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return actual;
});

describe('claim-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  });

  it('returns error when claim not found', async () => {
    mocks.mockLimit.mockResolvedValue([]);
    const { sendClaimStatusNotification } = await import('../claim-notifications');
    const result = await sendClaimStatusNotification('missing', undefined, 'submitted' as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Claim not found');
  });

  it('returns error when member email not found', async () => {
    mocks.mockLimit.mockResolvedValue([{
      claimId: 'c1',
      claimType: 'grievance',
      description: 'test',
      memberId: 'user1',
      assignedTo: null,
      organizationId: 'org1',
    }]);
    mocks.mockGetUser.mockResolvedValue({ emailAddresses: [] });

    const { sendClaimStatusNotification } = await import('../claim-notifications');
    const result = await sendClaimStatusNotification('c1', undefined, 'submitted' as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Member email not found');
  });

  it('sends notification successfully', async () => {
    mocks.mockLimit.mockResolvedValue([{
      claimId: 'c1',
      claimType: 'grievance',
      description: 'test',
      memberId: 'user1',
      assignedTo: null,
      organizationId: 'org1',
    }]);
    mocks.mockGetUser.mockResolvedValue({
      firstName: 'John',
      lastName: 'Doe',
      emailAddresses: [{ emailAddress: 'john@test.com' }],
    });

    const { sendClaimStatusNotification } = await import('../claim-notifications');
    const result = await sendClaimStatusNotification('c1', 'submitted', 'under_review' as never);
    expect(result.success).toBe(true);
  });

  it('handles error gracefully', async () => {
    mocks.mockLimit.mockRejectedValue(new Error('DB down'));
    const { sendClaimStatusNotification } = await import('../claim-notifications');
    const result = await sendClaimStatusNotification('c1', undefined, 'submitted' as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe('DB down');
  });
});
