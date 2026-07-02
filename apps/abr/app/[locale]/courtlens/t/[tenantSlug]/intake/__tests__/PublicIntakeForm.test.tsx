/**
 * @vitest-environment jsdom
 *
 * CourtLens Phase 2F public intake UI tests.
 *
 * Proves:
 * - Form renders legal-boundary framing.
 * - Submit button is disabled until consent + practice area + sub-issue + summary provided.
 * - Practice area selection filters sub-issues (housing shows housing sub-issues).
 * - Valid housing/employment/debt submits POST to /api/courtlens/public-intake with correct body.
 * - Submit includes Idempotency-Key.
 * - Submit does not include x-abr-role or x-org-id.
 * - Success state renders safe confirmation (matterId, status, legal notice)
 *   and does not render internal orgId / raw event / packet content.
 * - Validation errors render inline safely.
 * - Rate-limit (429) shows retry guidance without leaking existence.
 */

import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicIntakeForm } from '../PublicIntakeForm';

function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> } = { ok: true }) {
  const defaultBody = {
    ok: true, matterId: 'inc-1', practiceArea: 'housing',
    statusLabel: 'New Intake', submittedAt: '2026-07-02T00:00:00Z',
    legalBoundaryNotice: 'Your intake has been received and will be reviewed by a qualified person. This service does not provide legal advice.',
  };
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => defaultBody,
    ...response,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function fillValidHousingForm() {
  fireEvent.change(screen.getByTestId('field-practice-area'), { target: { value: 'housing' } });
  await waitFor(() => screen.getByTestId('field-sub-issue'));
  fireEvent.change(screen.getByTestId('field-sub-issue'), { target: { value: 'eviction' } });
  fireEvent.change(screen.getByTestId('field-summary'), {
    target: { value: 'My landlord served me an eviction notice with a 14-day deadline.' },
  });
  fireEvent.click(screen.getByTestId('field-consent'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ── Framing ───────────────────────────────────────────────────────────────────

describe('PublicIntakeForm — legal-boundary framing', () => {
  it('renders explicit "not legal advice" copy before the form', () => {
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    expect(screen.getAllByText(/not legal advice/i).length).toBeGreaterThan(0);
  });

  it('renders "supervised human review" framing', () => {
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    expect(screen.getByText(/qualified reviewer/i)).toBeDefined();
  });

  it('does not claim to give AI legal opinion', () => {
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    expect(screen.getByText(/will not receive an AI-generated legal opinion/i)).toBeDefined();
  });
});

// ── Form gating ───────────────────────────────────────────────────────────────

describe('PublicIntakeForm — submit gating', () => {
  it('submit is disabled until consent + fields are provided', () => {
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    const submit = screen.getByTestId('public-intake-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('submit is disabled without consent even with valid fields', () => {
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    fireEvent.change(screen.getByTestId('field-practice-area'), { target: { value: 'housing' } });
    fireEvent.change(screen.getByTestId('field-sub-issue'), { target: { value: 'eviction' } });
    fireEvent.change(screen.getByTestId('field-summary'), {
      target: { value: 'This is a long enough description of my situation.' },
    });
    const submit = screen.getByTestId('public-intake-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('submit is enabled once all required fields and consent are provided', async () => {
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    const submit = screen.getByTestId('public-intake-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('practice area selection filters sub-issues (housing shows housing options)', async () => {
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    fireEvent.change(screen.getByTestId('field-practice-area'), { target: { value: 'housing' } });
    await waitFor(() => screen.getByTestId('field-sub-issue'));
    const sub = screen.getByTestId('field-sub-issue') as HTMLSelectElement;
    const values = Array.from(sub.options).map((o) => o.value);
    expect(values).toContain('eviction');
    expect(values).toContain('lockout');
    // Should NOT contain employment sub-issues
    expect(values).not.toContain('unpaid_wages');
    expect(values).not.toContain('wage_garnishment');
  });

  it('practice area selection filters sub-issues (debt shows debt options)', async () => {
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    fireEvent.change(screen.getByTestId('field-practice-area'), { target: { value: 'debt' } });
    await waitFor(() => screen.getByTestId('field-sub-issue'));
    const sub = screen.getByTestId('field-sub-issue') as HTMLSelectElement;
    const values = Array.from(sub.options).map((o) => o.value);
    expect(values).toContain('wage_garnishment');
    expect(values).toContain('collector_harassment');
    expect(values).not.toContain('eviction');
  });
});

// ── Submit contract ───────────────────────────────────────────────────────────

describe('PublicIntakeForm — submit contract', () => {
  it('POSTs to /api/courtlens/public-intake with correct body (housing)', async () => {
    const fetchMock = stubFetch();
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('public-intake-submit'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/courtlens/public-intake');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');

    const body = JSON.parse(String(init.body));
    expect(body.tenantSlug).toBe('metro-university');
    expect(body.practiceArea).toBe('housing');
    expect(body.subIssue).toBe('eviction');
    expect(body.consentAcknowledged).toBe(true);
    expect(body.summary).toContain('eviction notice');
  });

  it('POSTs employment intake with correct payload', async () => {
    const fetchMock = stubFetch();
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    fireEvent.change(screen.getByTestId('field-practice-area'), { target: { value: 'employment' } });
    await waitFor(() => screen.getByTestId('field-sub-issue'));
    fireEvent.change(screen.getByTestId('field-sub-issue'), { target: { value: 'unpaid_wages' } });
    fireEvent.change(screen.getByTestId('field-summary'), {
      target: { value: 'My employer has not paid me for four weeks of completed work.' },
    });
    fireEvent.click(screen.getByTestId('field-consent'));
    fireEvent.click(screen.getByTestId('public-intake-submit'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.practiceArea).toBe('employment');
    expect(body.subIssue).toBe('unpaid_wages');
  });

  it('POSTs debt intake with correct payload', async () => {
    const fetchMock = stubFetch();
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    fireEvent.change(screen.getByTestId('field-practice-area'), { target: { value: 'debt' } });
    await waitFor(() => screen.getByTestId('field-sub-issue'));
    fireEvent.change(screen.getByTestId('field-sub-issue'), { target: { value: 'wage_garnishment' } });
    fireEvent.change(screen.getByTestId('field-summary'), {
      target: { value: 'I received papers about wage garnishment for a debt I do not recognise.' },
    });
    fireEvent.click(screen.getByTestId('field-consent'));
    fireEvent.click(screen.getByTestId('public-intake-submit'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.practiceArea).toBe('debt');
    expect(body.subIssue).toBe('wage_garnishment');
  });

  it('submit includes Idempotency-Key header', async () => {
    const fetchMock = stubFetch();
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('public-intake-submit'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeTruthy();
    expect(headers['Idempotency-Key'].length).toBeGreaterThan(8);
  });

  it('submit does not include x-abr-role or x-org-id', async () => {
    const fetchMock = stubFetch();
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('public-intake-submit'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['x-abr-role']).toBeUndefined();
    expect(headers['X-Abr-Role']).toBeUndefined();
    expect(headers['x-org-id']).toBeUndefined();
    expect(headers['X-Org-Id']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('includes selected risk flags in payload', async () => {
    const fetchMock = stubFetch();
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('risk-risk_eviction'));
    fireEvent.click(screen.getByTestId('public-intake-submit'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.riskFlags).toEqual({ risk_eviction: true });
  });
});

// ── Success state ─────────────────────────────────────────────────────────────

describe('PublicIntakeForm — success state', () => {
  it('renders safe confirmation with matterId, status, legal notice', async () => {
    stubFetch({
      ok: true, status: 201,
      json: async () => ({
        ok: true,
        matterId: 'inc-abc',
        practiceArea: 'housing',
        statusLabel: 'New Intake',
        submittedAt: '2026-07-02T01:00:00Z',
        legalBoundaryNotice: 'Your intake has been received. This service does not provide legal advice.',
      }),
    });
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('public-intake-submit'));

    await waitFor(() => expect(screen.getByTestId('public-intake-confirmation')).toBeDefined());
    expect(screen.getByText(/Intake received/i)).toBeDefined();
    expect(screen.getByText(/inc-abc/i)).toBeDefined();
    expect(screen.getByTestId('confirmation-status').textContent).toBe('New Intake');
    expect(screen.getByTestId('confirmation-legal-notice').textContent).toContain('does not provide legal advice');
  });

  it('success state does not render internal orgId, tenant internals, or AI content', async () => {
    stubFetch({
      ok: true, status: 201,
      json: async () => ({
        ok: true,
        matterId: 'inc-abc',
        practiceArea: 'housing',
        statusLabel: 'New Intake',
        submittedAt: '2026-07-02T01:00:00Z',
        legalBoundaryNotice: 'Reviewed by human.',
        // Attacker-controlled response fields — must NOT be rendered
        orgId: 'metro-university-INTERNAL',
        events: [{ payloadJson: { secret: 'MUST_NOT_APPEAR' } }],
        aiPacket: 'FORBIDDEN_AI_ANSWER',
      }),
    });
    const { container } = render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('public-intake-submit'));

    await waitFor(() => expect(screen.getByTestId('public-intake-confirmation')).toBeDefined());
    // The rendered container must not include any leaked field from the response
    expect(container.innerHTML).not.toContain('MUST_NOT_APPEAR');
    expect(container.innerHTML).not.toContain('FORBIDDEN_AI_ANSWER');
    expect(container.innerHTML).not.toContain('INTERNAL');
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('PublicIntakeForm — error handling', () => {
  it('renders inline validation error on 400', async () => {
    stubFetch({
      ok: false, status: 400,
      json: async () => ({ error: 'Some information was invalid.', code: 'INVALID_INTAKE_PAYLOAD' }),
    });
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('public-intake-submit'));

    await waitFor(() => expect(screen.getByTestId('public-intake-error')).toBeDefined());
    expect(screen.getByTestId('public-intake-error').textContent).toContain('invalid');
  });

  it('renders rate-limit guidance on 429', async () => {
    stubFetch({
      ok: false, status: 429,
      json: async () => ({ error: 'Too Many Requests' }),
    });
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('public-intake-submit'));

    await waitFor(() => expect(screen.getByTestId('public-intake-error')).toBeDefined());
    expect(screen.getByTestId('public-intake-error').textContent).toMatch(/Too many/i);
  });

  it('renders generic unavailable message on 404 (no existence leak)', async () => {
    stubFetch({
      ok: false, status: 404,
      json: async () => ({ error: 'Tenant not found or intake is not available for this organisation.' }),
    });
    render(<PublicIntakeForm tenantSlug="not-a-real-org" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('public-intake-submit'));

    await waitFor(() => expect(screen.getByTestId('public-intake-error')).toBeDefined());
    const msg = screen.getByTestId('public-intake-error').textContent ?? '';
    expect(msg).toMatch(/not available/i);
    // Must not leak the specific tenant slug
    expect(msg).not.toContain('not-a-real-org');
  });

  it('renders generic error on 500', async () => {
    stubFetch({ ok: false, status: 500, json: async () => ({}) });
    render(<PublicIntakeForm tenantSlug="metro-university" />);
    await fillValidHousingForm();
    fireEvent.click(screen.getByTestId('public-intake-submit'));

    await waitFor(() => expect(screen.getByTestId('public-intake-error')).toBeDefined());
    expect(screen.getByTestId('public-intake-error').textContent).toMatch(/could not be submitted/i);
  });
});
