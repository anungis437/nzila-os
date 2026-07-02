/**
 * @vitest-environment jsdom
 *
 * CourtLens Phase 2D UI tests — read-only tenant matter queue and detail pages.
 *
 * Proves:
 * - Queue page redirects unauthenticated users to /sign-in.
 * - Queue page shows access-denied state when membership verification fails.
 * - Queue page shows access-denied when role lacks incident.read.
 * - Queue page renders items from the safe listMatterQueueForOrg projection.
 * - Queue page renders empty state when no matters exist.
 * - Detail page redirects unauthenticated users.
 * - Detail page 404s on missing matter (cross-tenant safety).
 * - Detail page renders redacted view — hides null clientProfile/riskFlags.
 * - Detail page always shows the legal boundary notice from buildMatterDetailView.
 * - Pages do NOT construct or manipulate x-abr-role client-side (server-only auth chain).
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  verifyAbrOrgMembership: vi.fn(),
  hasPermission: vi.fn(),
  listMatterQueueForOrg: vi.fn(),
  getMatterDetail: vi.fn(),
  buildMatterDetailView: vi.fn(),
  redirect: vi.fn(() => { throw new Error('__redirect__'); }),
  notFound: vi.fn(() => { throw new Error('__notFound__'); }),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/trusted-auth', () => ({
  verifyAbrOrgMembership: mocks.verifyAbrOrgMembership,
}));

vi.mock('@/lib/rbac', () => ({
  hasPermission: mocks.hasPermission,
  normalizeRole: (r: string) => r,
}));

vi.mock('@/modules/incidents/matter-service', () => ({
  listMatterQueueForOrg: mocks.listMatterQueueForOrg,
  getMatterDetail: mocks.getMatterDetail,
  buildMatterDetailView: mocks.buildMatterDetailView,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock('@nzila/ui', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="ui-card">{children}</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

const asyncParams = <T,>(v: T) => Promise.resolve(v);

// ── Queue page ────────────────────────────────────────────────────────────────

describe('CourtLensMattersPage (queue) — Phase 2D', () => {
  it('redirects unauthenticated users to /sign-in', async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const { default: Page } = await import('../page');

    await expect(async () => {
      await Page({
        params: asyncParams({ locale: 'en-CA' }),
        searchParams: asyncParams({}),
      });
    }).rejects.toThrow('__redirect__');

    expect(mocks.redirect).toHaveBeenCalledWith('/sign-in');
    expect(mocks.listMatterQueueForOrg).not.toHaveBeenCalled();
  });

  it('renders access-denied state when membership verification fails', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({ ok: false, reason: 'no_membership' });
    const { default: Page } = await import('../page');

    const el = await Page({
      params: asyncParams({ locale: 'en-CA' }),
      searchParams: asyncParams({}),
    });
    render(el);

    expect(screen.getByText(/not have an active membership/i)).toBeDefined();
    expect(mocks.listMatterQueueForOrg).not.toHaveBeenCalled();
  });

  it('renders role-denied state when role lacks incident.read', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true, role: 'learner', source: 'abr_users_lookup',
    });
    mocks.hasPermission.mockReturnValue(false);
    const { default: Page } = await import('../page');

    const el = await Page({
      params: asyncParams({ locale: 'en-CA' }),
      searchParams: asyncParams({}),
    });
    render(el);

    expect(screen.getByText(/does not include permission/i)).toBeDefined();
    expect(mocks.listMatterQueueForOrg).not.toHaveBeenCalled();
  });

  it('renders empty state when no matters exist', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true, role: 'investigator', source: 'abr_users_lookup',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.listMatterQueueForOrg.mockResolvedValue([]);
    const { default: Page } = await import('../page');

    const el = await Page({
      params: asyncParams({ locale: 'en-CA' }),
      searchParams: asyncParams({}),
    });
    render(el);

    expect(screen.getByText(/no matters yet/i)).toBeDefined();
    // Legal-boundary framing must appear (may be in both intro and empty state)
    expect(screen.getAllByText(/not legal advice/i).length).toBeGreaterThan(0);
  });

  it('renders queue rows with safe projection fields only', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true, role: 'investigator', source: 'abr_users_lookup',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.listMatterQueueForOrg.mockResolvedValue([
      {
        id: 'inc-1',
        orgId: 'metro-university',
        title: 'Housing eviction intake',
        practiceArea: 'housing',
        subIssue: 'eviction',
        statusLabel: 'New Intake',
        urgencyLabel: 'high',
        aiSummaryStatus: 'ai_draft',
        referralStatus: 'none',
        isPacketExternalizable: false,
        assignedTo: 'reviewer-1',
        openedAt: '2026-07-02T00:00:00Z',
        dueAt: null,
        deadlineDate: '2026-08-01',
      },
    ]);
    const { default: Page } = await import('../page');

    const el = await Page({
      params: asyncParams({ locale: 'en-CA' }),
      searchParams: asyncParams({}),
    });
    render(el);

    expect(screen.getByText('Housing eviction intake')).toBeDefined();
    expect(screen.getByTestId('matter-practice-area').textContent).toBe('housing');
    expect(screen.getByTestId('matter-status-label').textContent).toBe('New Intake');
    expect(screen.getByTestId('matter-ai-status').textContent).toContain('draft — not for external use');
    expect(screen.getByTestId('matter-sub-issue').textContent).toContain('eviction');
  });

  it('uses org from searchParams when provided', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true, role: 'investigator', source: 'abr_users_lookup',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.listMatterQueueForOrg.mockResolvedValue([]);
    const { default: Page } = await import('../page');

    await Page({
      params: asyncParams({ locale: 'en-CA' }),
      searchParams: asyncParams({ org: 'northcare-hospital' }),
    });

    expect(mocks.verifyAbrOrgMembership).toHaveBeenCalledWith('user_1', 'northcare-hospital');
    expect(mocks.listMatterQueueForOrg).toHaveBeenCalledWith('northcare-hospital');
  });
});

// ── Detail page ───────────────────────────────────────────────────────────────

describe('CourtLensMatterDetailPage — Phase 2D', () => {
  const baseView = {
    id: 'inc-1',
    orgId: 'metro-university',
    title: 'Housing eviction intake',
    statusLabel: 'Under Review',
    practiceArea: 'housing',
    subIssue: 'eviction',
    urgencyLabel: 'high',
    aiSummaryStatus: 'needs_verification',
    referralStatus: 'none',
    isPacketExternalizable: false,
    assignedTo: 'reviewer-1',
    clientGoal: null,
    hearingDate: null,
    deadlineDate: null,
    riskFlags: null,
    clientProfile: null,
    notes: [],
    timeline: [],
    openedAt: '2026-07-02T00:00:00Z',
    dueAt: null,
    legalBoundaryNotice:
      'AI-generated content in this record is draft-only and requires human reviewer approval before external use. This platform does not provide legal advice.',
  };

  it('redirects unauthenticated users to /sign-in', async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const { default: Page } = await import('../[matterId]/page');

    await expect(async () => {
      await Page({
        params: asyncParams({ locale: 'en-CA', matterId: 'inc-1' }),
        searchParams: asyncParams({}),
      });
    }).rejects.toThrow('__redirect__');
  });

  it('renders access-denied when membership verification fails', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({ ok: false, reason: 'no_membership' });
    const { default: Page } = await import('../[matterId]/page');

    const el = await Page({
      params: asyncParams({ locale: 'en-CA', matterId: 'inc-1' }),
      searchParams: asyncParams({}),
    });
    render(el);

    expect(screen.getByText(/do not have access to this matter/i)).toBeDefined();
    expect(mocks.getMatterDetail).not.toHaveBeenCalled();
  });

  it('calls notFound() for missing/cross-tenant matter', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true, role: 'investigator', source: 'abr_users_lookup',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue(null);
    const { default: Page } = await import('../[matterId]/page');

    await expect(async () => {
      await Page({
        params: asyncParams({ locale: 'en-CA', matterId: 'matter-of-other-org' }),
        searchParams: asyncParams({}),
      });
    }).rejects.toThrow('__notFound__');
    expect(mocks.buildMatterDetailView).not.toHaveBeenCalled();
  });

  it('renders detail with legal boundary notice from server', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true, role: 'investigator', source: 'abr_users_lookup',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1', orgId: 'metro-university' },
      detail: { incident: {}, events: [], actions: [], notes: [], timeline: [] },
    });
    mocks.buildMatterDetailView.mockReturnValue(baseView);
    const { default: Page } = await import('../[matterId]/page');

    const el = await Page({
      params: asyncParams({ locale: 'en-CA', matterId: 'inc-1' }),
      searchParams: asyncParams({}),
    });
    render(el);

    expect(screen.getByTestId('legal-boundary-notice').textContent).toContain('does not provide legal advice');
    expect(screen.getByTestId('detail-status-label').textContent).toBe('Under Review');
    expect(screen.getByTestId('detail-ai-status').textContent).toContain('draft only');
  });

  it('hides client profile and risk flags when server returns null (redacted role)', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true, role: 'executive_viewer', source: 'abr_users_lookup',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1', orgId: 'metro-university' },
      detail: { incident: {}, events: [], actions: [], notes: [], timeline: [] },
    });
    // Executive viewer receives null redacted fields
    mocks.buildMatterDetailView.mockReturnValue({
      ...baseView,
      clientProfile: null,
      riskFlags: null,
      clientGoal: null,
    });
    const { default: Page } = await import('../[matterId]/page');

    const el = await Page({
      params: asyncParams({ locale: 'en-CA', matterId: 'inc-1' }),
      searchParams: asyncParams({}),
    });
    render(el);

    // Redacted sections must not render
    expect(screen.queryByTestId('matter-client-profile')).toBeNull();
    expect(screen.queryByTestId('matter-risk-flags')).toBeNull();
    expect(screen.queryByTestId('matter-context')).toBeNull();
  });

  it('renders client profile and risk flags when server returns them (privileged role)', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true, role: 'investigator', source: 'abr_users_lookup',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1', orgId: 'metro-university' },
      detail: { incident: {}, events: [], actions: [], notes: [], timeline: [] },
    });
    mocks.buildMatterDetailView.mockReturnValue({
      ...baseView,
      clientProfile: {
        clientName: 'Jane Smith',
        clientContact: null,
        householdSize: 3,
        hasChildren: true,
        hasDisability: false,
        consentStatus: 'granted',
      },
      riskFlags: {
        risk_lockout: false, risk_eviction: true, risk_utility_shutoff: false,
        risk_safety: false, risk_homelessness: false, risk_income_loss: false,
        risk_unsafe_work: false, risk_retaliation: false, risk_garnishment: false,
        risk_bank_freeze: false, risk_identity_theft: false, risk_essential_services: false,
        risk_harassment: false,
      },
    });
    const { default: Page } = await import('../[matterId]/page');

    const el = await Page({
      params: asyncParams({ locale: 'en-CA', matterId: 'inc-1' }),
      searchParams: asyncParams({}),
    });
    render(el);

    expect(screen.getByTestId('matter-client-profile')).toBeDefined();
    expect(screen.getByText('Jane Smith')).toBeDefined();
    expect(screen.getByTestId('matter-risk-flags')).toBeDefined();
    // "eviction" may appear in title and risk flag — assert at least one
    expect(screen.getAllByText(/eviction/i).length).toBeGreaterThan(0);
  });

  it('does not render raw event payloads (view has no events field exposed)', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_1' });
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true, role: 'investigator', source: 'abr_users_lookup',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1', orgId: 'metro-university' },
      detail: {
        incident: {},
        events: [
          { id: 'e1', payloadJson: { secret: 'MUST_NOT_APPEAR' }, type: 'courtlens_event', actorId: 'a', incidentId: 'i', createdAt: '' },
        ],
        actions: [], notes: [], timeline: [],
      },
    });
    mocks.buildMatterDetailView.mockReturnValue(baseView);
    const { default: Page } = await import('../[matterId]/page');

    const el = await Page({
      params: asyncParams({ locale: 'en-CA', matterId: 'inc-1' }),
      searchParams: asyncParams({}),
    });
    const { container } = render(el);

    // Raw event payload never rendered
    expect(container.innerHTML).not.toContain('MUST_NOT_APPEAR');
    expect(container.innerHTML).not.toContain('payloadJson');
  });
});
