// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('@react-email/components', () => ({
  Html: ({ children }: { children: React.ReactNode }) => children,
  Head: () => null,
  Body: ({ children }: { children: React.ReactNode }) => children,
  Container: ({ children }: { children: React.ReactNode }) => children,
  Section: ({ children }: { children: React.ReactNode }) => children,
  Heading: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
  Button: ({ children }: { children: React.ReactNode }) => children,
  Preview: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockReturnValue('<html>rendered</html>'),
}));

describe('email-templates', () => {
  it('ClaimStatusNotificationEmail is a function', async () => {
    const { ClaimStatusNotificationEmail } = await import('../email-templates');
    expect(typeof ClaimStatusNotificationEmail).toBe('function');
  });

  it('renders initial submission variant', async () => {
    const { ClaimStatusNotificationEmail } = await import('../email-templates');
    const element = ClaimStatusNotificationEmail({
      claimId: 'CLM-001',
      claimTitle: 'Test Claim',
      claimType: 'grievance',
      newStatus: 'submitted',
      memberName: 'Jane Doe',
      claimUrl: 'https://example.com/claims/CLM-001',
    });

    expect(element).toBeDefined();
  });

  it('renders status change variant with previousStatus', async () => {
    const { ClaimStatusNotificationEmail } = await import('../email-templates');
    const element = ClaimStatusNotificationEmail({
      claimId: 'CLM-001',
      claimTitle: 'Test Claim',
      claimType: 'grievance',
      previousStatus: 'submitted',
      newStatus: 'under_review',
      memberName: 'Jane Doe',
      claimUrl: 'https://example.com/claims/CLM-001',
    });

    expect(element).toBeDefined();
  });

  it('renders with optional props', async () => {
    const { ClaimStatusNotificationEmail } = await import('../email-templates');
    const element = ClaimStatusNotificationEmail({
      claimId: 'CLM-001',
      claimTitle: 'Test Claim',
      claimType: 'grievance',
      previousStatus: 'under_review',
      newStatus: 'pending_documentation',
      memberName: 'Jane Doe',
      claimUrl: 'https://example.com/claims/CLM-001',
      notes: 'Please provide documents',
      assignedStewardName: 'John Smith',
      humanMessage: 'We need more info',
      deadline: '2026-04-15',
      daysRemaining: 18,
    });

    expect(element).toBeDefined();
  });

  it('renderClaimStatusEmail returns the rendered HTML string', async () => {
    const { renderClaimStatusEmail } = await import('../email-templates');
    const html = await renderClaimStatusEmail({
      claimId: 'CLM-002',
      claimTitle: 'Render Claim',
      claimType: 'grievance',
      newStatus: 'submitted',
      memberName: 'Jane Doe',
      claimUrl: 'https://example.com/claims/CLM-002',
    });

    expect(html).toBe('<html>rendered</html>');
  });
});
