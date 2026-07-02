/**
 * @vitest-environment jsdom
 *
 * ReviewerActions component tests — Phase 2E.
 *
 * Proves:
 * - No mutation controls render when permissions list is empty.
 * - Only permitted action groups render.
 * - Clicking a button POSTs to the correct URL with correct body.
 * - Fetch does NOT include x-abr-role header.
 * - Fetch does NOT include x-org-id header (server derives from session/selector).
 * - Failed mutations show error state.
 * - Successful mutations call router.refresh().
 */

import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerMocks.refresh }),
}));

import { ReviewerActions } from '../ReviewerActions';

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.refresh.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ── Permission gating ─────────────────────────────────────────────────────────

describe('ReviewerActions — permission gating', () => {
  it('renders nothing when permissions list is empty', () => {
    const { container } = render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="needs_verification"
        referralStatus="none"
        status="investigating"
        permissions={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when only wider permissions but no incident.update/transition', () => {
    const { container } = render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="needs_verification"
        referralStatus="none"
        status="investigating"
        permissions={['incident.read', 'dashboard.read']}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders AI + referral action groups for incident.update role', () => {
    render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="needs_verification"
        referralStatus="none"
        status="investigating"
        permissions={['incident.update']}
      />,
    );
    expect(screen.getByTestId('ai-summary-actions')).toBeDefined();
    expect(screen.getByTestId('referral-actions')).toBeDefined();
    // Transition group hidden without incident.transition
    expect(screen.queryByTestId('transition-actions')).toBeNull();
  });

  it('renders transition action group only for incident.transition role', () => {
    render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="approved"
        referralStatus="completed"
        status="investigating"
        permissions={['incident.transition']}
      />,
    );
    expect(screen.getByTestId('transition-actions')).toBeDefined();
    expect(screen.queryByTestId('ai-summary-actions')).toBeNull();
    expect(screen.queryByTestId('referral-actions')).toBeNull();
  });

  it('does not show AI action buttons in terminal approved state', () => {
    render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="approved"
        referralStatus="none"
        status="investigating"
        permissions={['incident.update']}
      />,
    );
    // approved is terminal → no ai action group
    expect(screen.queryByTestId('ai-summary-actions')).toBeNull();
  });
});

// ── Mutation call contract ────────────────────────────────────────────────────

describe('ReviewerActions — mutation contract', () => {
  function stubFetch(response: Partial<Response> = { ok: true }) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      ...response,
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('POSTs to /api/courtlens/matters/[id]/ai-summary-status with correct body', async () => {
    const fetchMock = stubFetch();
    render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="needs_verification"
        referralStatus="none"
        status="investigating"
        permissions={['incident.update']}
      />,
    );

    fireEvent.click(screen.getByTestId('ai-action-approved'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/courtlens/matters/inc-1/ai-summary-status');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(String(init.body))).toEqual({ from: 'needs_verification', to: 'approved' });
  });

  it('does NOT send x-abr-role header', async () => {
    const fetchMock = stubFetch();
    render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="ai_draft"
        referralStatus="none"
        status="new"
        permissions={['incident.update']}
      />,
    );

    fireEvent.click(screen.getByTestId('ai-action-needs_verification'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-abr-role']).toBeUndefined();
    expect(headers['X-Abr-Role']).toBeUndefined();
    expect(headers['x-org-id']).toBeUndefined();
    expect(headers['X-Org-Id']).toBeUndefined();
    // Only Content-Type should be set
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('POSTs referral transition with correct body', async () => {
    const fetchMock = stubFetch();
    render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="ai_draft"
        referralStatus="approved"
        status="investigating"
        permissions={['incident.update']}
      />,
    );

    fireEvent.click(screen.getByTestId('referral-action-sent'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/courtlens/matters/inc-1/referral-status');
    expect(JSON.parse(String(init.body))).toEqual({ from: 'approved', to: 'sent' });
  });

  it('POSTs FSM transition with reason', async () => {
    const fetchMock = stubFetch();
    render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="approved"
        referralStatus="completed"
        status="new"
        permissions={['incident.transition']}
      />,
    );

    fireEvent.click(screen.getByTestId('transition-action-triage'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/courtlens/matters/inc-1/transition');
    const body = JSON.parse(String(init.body));
    expect(body.to).toBe('triage');
    expect(body.reason).toBeTruthy();
  });

  it('shows error state on failed mutation', async () => {
    stubFetch({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid transition', code: 'AI_SUMMARY_TRANSITION_REJECTED' }),
    });
    render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="needs_verification"
        referralStatus="none"
        status="investigating"
        permissions={['incident.update']}
      />,
    );

    fireEvent.click(screen.getByTestId('ai-action-approved'));

    await waitFor(() => {
      expect(screen.getByTestId('reviewer-actions-error').textContent).toContain('Invalid transition');
    });
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });

  it('calls router.refresh() on successful mutation', async () => {
    stubFetch({ ok: true });
    render(
      <ReviewerActions
        matterId="inc-1"
        aiSummaryStatus="needs_verification"
        referralStatus="none"
        status="investigating"
        permissions={['incident.update']}
      />,
    );

    fireEvent.click(screen.getByTestId('ai-action-approved'));

    await waitFor(() => {
      expect(routerMocks.refresh).toHaveBeenCalled();
    });
  });
});
