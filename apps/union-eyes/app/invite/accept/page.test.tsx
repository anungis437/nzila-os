// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import InviteAcceptPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), params: 'token=invite-bearer' }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, useSearchParams: () => new URLSearchParams(nav.params) }));
// This public route has no NextIntl provider; keep the real library so a context dependency fails here.
vi.unmock('next-intl');
const fetchMock = vi.fn();
beforeEach(() => { nav.replace.mockReset(); nav.params = 'token=invite-bearer'; document.cookie = 'NEXT_LOCALE=; Path=/; Max-Age=0'; vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-CA'); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('invitation acceptance and MFA', () => {
  it('renders the standalone public route without an internationalization provider', () => {
    render(<InviteAcceptPage />);
    expect(screen.getByRole('heading', { name: 'Accept your invitation' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en-CA');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the browser language when no supported explicit locale or preference cookie is present', async () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('fr-CA');
    nav.params += '&locale=unsupported';
    render(<InviteAcceptPage />);
    expect(await screen.findByRole('heading', { name: 'Accepter votre invitation' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr-CA');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honors the explicit invitation locale before a different cookie or browser preference', () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('fr-CA');
    document.cookie = 'NEXT_LOCALE=fr-CA; Path=/';
    nav.params += '&locale=en-CA';
    render(<InviteAcceptPage />);
    expect(screen.getByRole('heading', { name: 'Accept your invitation' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en-CA');
  });

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

  it('accepts in French and keeps the selected language when opening the dashboard', async () => {
    nav.params += '&locale=fr-CA';
    fetchMock.mockResolvedValueOnce(Response.json({ user: { id: 'u1' } }));
    render(<InviteAcceptPage />);
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accepter l’invitation' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/fr-CA/dashboard'));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).token).toBe('invite-bearer');
  });

  it('switches languages while preserving the invitation and MFA challenge, and localizes a refused code', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ user: { id: 'u1' }, requiresMfa: true, challengeToken: 'mfa-challenge' }));
    render(<InviteAcceptPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    await screen.findByLabelText('Authenticator code');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fr-CA' } });
    fireEvent.click(screen.getByLabelText('Utiliser un code de récupération'));
    fireEvent.change(screen.getByLabelText('Code de récupération'), { target: { value: 'controlled-recovery' } });
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Invalid code' }, { status: 400 }));
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier l’identité' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code invalide');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ challengeToken: 'mfa-challenge', recoveryCode: 'controlled-recovery' });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('honors a French preference cookie and never turns an arbitrary locale into a redirect destination', async () => {
    document.cookie = 'NEXT_LOCALE=fr-CA; Path=/';
    nav.params += '&locale=https://example.test';
    fetchMock.mockResolvedValueOnce(Response.json({ user: { id: 'u1' } }));
    render(<InviteAcceptPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accepter l’invitation' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/fr-CA/dashboard'));
  });
});
