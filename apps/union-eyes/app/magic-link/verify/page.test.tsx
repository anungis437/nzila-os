// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MagicLinkVerifyPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), params: 'token=link-bearer' }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, useSearchParams: () => new URLSearchParams(nav.params) }));
vi.unmock('next-intl');
const fetchMock = vi.fn();

const refused = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  nav.replace.mockReset();
  nav.params = 'token=link-bearer';
  document.cookie = 'NEXT_LOCALE=; Path=/; Max-Age=0';
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-CA');
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('magic-link verification landing', () => {
  it('signs in once and continues into the dashboard in the person’s language', async () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('fr-CA');
    fetchMock.mockResolvedValue(Response.json({ user: { id: 'u1' } }));
    render(<MagicLinkVerifyPage />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/fr-CA/dashboard'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ token: 'link-bearer' });
  });

  it('continues into the English dashboard by default', async () => {
    fetchMock.mockResolvedValue(Response.json({ user: { id: 'u1' } }));
    render(<MagicLinkVerifyPage />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/en-CA/dashboard'));
    expect(document.documentElement.lang).toBe('en-CA');
  });

  it('spends the single-use token exactly once even when the language is detected after the request starts', async () => {
    document.cookie = 'NEXT_LOCALE=fr-CA; Path=/';
    fetchMock.mockResolvedValue(Response.json({ user: { id: 'u1' } }));
    render(<MagicLinkVerifyPage />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/fr-CA/dashboard'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says a link without a token is incomplete, in French and English, without calling the server', async () => {
    nav.params = '';
    render(<MagicLinkVerifyPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('This sign-in link is incomplete. Request a new one.');
    cleanup();
    nav.params = 'locale=fr-CA';
    render(<MagicLinkVerifyPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce lien de connexion est incomplet. Demandez-en un nouveau.');
    expect(screen.getByRole('link', { name: 'Retour à la connexion' })).toHaveAttribute('href', '/login');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['English', 'en-CA', 'This sign-in link could not be verified. Request a new one.'],
    ['French', 'fr-CA', 'Ce lien de connexion n’a pas pu être vérifié. Demandez-en un nouveau.'],
  ])('keeps a server failure, a parser failure and a lost connection in controlled %s wording', async (_name, locale, failed) => {
    nav.params = `token=t&locale=${locale}`;
    for (const outcome of [
      () => refused(500, { error: 'relation "magic_links" does not exist' }),
      () => new Response('<html>Bad gateway</html>', { status: 502 }),
      () => { throw new TypeError('Failed to fetch'); },
    ]) {
      fetchMock.mockReset();
      fetchMock.mockImplementation(async () => outcome());
      render(<MagicLinkVerifyPage />);
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).not.toMatch(/relation|Failed to fetch|Bad gateway|<html/);
      expect(alert.textContent?.length).toBeGreaterThan(10);
      cleanup();
    }
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(refused(400, { error: 'Invalid or expired link' }));
    render(<MagicLinkVerifyPage />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(failed);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('says an answer without a confirmed user is not a sign-in', async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    render(<MagicLinkVerifyPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('This sign-in link could not be verified. Request a new one.');
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe('magic-link verification for an account with a second factor', () => {
  const challenged = () => Response.json({ user: { id: 'u1' }, requiresMfa: true, challengeToken: 'mfa-challenge' });

  it('asks for the code instead of entering the dashboard without a session', async () => {
    fetchMock.mockResolvedValueOnce(challenged());
    render(<MagicLinkVerifyPage />);
    expect(await screen.findByLabelText('Authenticator code')).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));
    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: ' 123456 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/en-CA/dashboard'));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ challengeToken: 'mfa-challenge', code: '123456' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/mfa/challenge');
  });

  it('accepts a recovery code and words a refused code in French, keeping the field for another attempt', async () => {
    nav.params = 'token=t&locale=fr-CA';
    fetchMock.mockResolvedValueOnce(challenged());
    render(<MagicLinkVerifyPage />);
    fireEvent.click(await screen.findByLabelText('Utiliser un code de récupération'));
    const field = screen.getByLabelText('Code de récupération');
    fetchMock.mockResolvedValueOnce(refused(401, { error: 'Invalid code' }));
    fireEvent.change(field, { target: { value: 'abcd-efgh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier l’identité' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code invalide. Vérifiez votre code et réessayez.');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ challengeToken: 'mfa-challenge', recoveryCode: 'abcd-efgh' });
    expect(screen.getByLabelText('Code de récupération')).toHaveValue('abcd-efgh');
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('does not enter the dashboard on an unconfirmed answer or a lost connection, and does not echo raw text', async () => {
    fetchMock.mockResolvedValueOnce(challenged());
    render(<MagicLinkVerifyPage />);
    fireEvent.change(await screen.findByLabelText('Authenticator code'), { target: { value: '123456' } });
    fetchMock.mockResolvedValueOnce(Response.json({}));
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in could not be confirmed. Please try again.');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.'));
    fetchMock.mockResolvedValueOnce(refused(500, { error: 'relation "mfa" does not exist' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).not.toMatch(/relation|Failed to fetch/));
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('refuses a challenge without a token', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ user: { id: 'u1' }, requiresMfa: true }));
    render(<MagicLinkVerifyPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be verified');
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
