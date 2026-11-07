// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// DEF-0B8-ICRA-CLAIM-TOKEN-HAS-NO-ICRA-ISSUER-SO-CLAIM-CANNOT-SUCCEED: the claim page presents the e-mailed token to the claim route and
// calls the claim made only when the route confirms it.
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import ClaimIcraClient from '../ClaimIcraClient';

const ID = '00000000-0000-4000-8000-000000000099';
// A placeholder, not a credential: the component only forwards what it is given.
const CLAIM = 'c'.repeat(24);
let answer: { status: number; body: unknown };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  push.mockReset();
  answer = { status: 200, body: { ok: true, assessmentId: ID } };
  fetchMock = vi.fn(async () => new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ClaimIcraClient', () => {
  it('posts the token to the assessment\'s claim route and opens the results on success', async () => {
    const user = userEvent.setup();
    render(<ClaimIcraClient assessmentId={ID} token={CLAIM} locale="en-CA" />);
    await user.click(screen.getByRole('button', { name: 'Claim report' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/en-CA/continuity-assessment/results/${ID}`));
    expect(fetchMock).toHaveBeenCalledWith(`/api/icra/${ID}/claim`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ claimToken: CLAIM }) }));
  });

  it.each([
    [410, {}, 'This claim link has expired'],
    [409, {}, 'This report has already been claimed.'],
    [403, { error: 'This assessment was purchased with a different e-mail address.' }, 'different e-mail address'],
  ])('shows a refusal (%i) and does not navigate', async (status, body, text) => {
    answer = { status, body };
    const user = userEvent.setup();
    render(<ClaimIcraClient assessmentId={ID} token={CLAIM} locale="en-CA" />);
    await user.click(screen.getByRole('button', { name: 'Claim report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(push).not.toHaveBeenCalled();
  });
});
