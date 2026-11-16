// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import InviteAcceptPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, useSearchParams: () => new URLSearchParams('token=invite-bearer') }));
const fetchMock = vi.fn();
beforeEach(() => { nav.replace.mockReset(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('invitation acceptance and MFA', () => {
  it('waits for the required second factor before navigating', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ user: { id: 'u1' }, requiresMfa: true, challengeToken: 'mfa-challenge' }));
    render(<InviteAcceptPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    const code = await screen.findByLabelText('Authenticator code');
    expect(nav.replace).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(Response.json({ ok: false, error: 'Invalid code' }, { status: 400 }));
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    await screen.findByText('Invalid code');
    expect(nav.replace).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/en-CA/dashboard'));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/mfa/challenge');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ challengeToken: 'mfa-challenge', code: '123456' });
  });

  it('does not treat an empty successful HTTP answer as an authenticated membership', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({}));
    render(<InviteAcceptPage />); fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    await screen.findByText('Sign-in could not be confirmed. Please try again.');
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
