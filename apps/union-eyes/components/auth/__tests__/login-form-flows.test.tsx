// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';
import { LoginForm } from '../login-form';

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: '/login' }));
vi.mock('@nzila/platform-auth/entra/client', () => ({ signInWithEntra: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }), usePathname: () => nav.pathname }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const ok = (body: unknown): Answer => ({ status: 200, body });
const refused = (status: number, body: unknown): Answer => ({ status, body });

/** What GET /api/auth/methods answers: the six flags getAuthMethodAvailability returns, and userExists (a hint the screen does not use). */
const METHODS = { password: true, magicLink: true, sso: true, passwordReset: true, ssoRequired: false, inviteRequired: false, userExists: null };

let methods: Answer;
let login: Answer;
let challenge: Answer;
let magic: Answer;
let calls: Call[];

beforeEach(() => {
  nav.push.mockClear();
  nav.pathname = '/login';
  methods = ok(METHODS);
  login = ok({ user: { id: 'u1', email: 'alex@example.test', firstName: 'Alex', lastName: 'Morin' } });
  challenge = ok({ ok: true, userId: 'u1' });
  magic = ok({ message: 'If that email is recognised, a sign-in link has been sent. Please check your inbox.' });
  calls = installFetch(({ url, method }) => {
    if (url.startsWith('/api/auth/methods?')) return methods;
    if (url === '/api/auth/login' && method === 'POST') return login;
    if (url === '/api/auth/mfa/challenge' && method === 'POST') return challenge;
    if (url === '/api/auth/magic-link/request' && method === 'POST') return magic;
    throw new Error(`unexpected request ${method} ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'alex@example.test');
  await user.type(screen.getByLabelText('Password'), 'Secret123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginForm: password sign-in', () => {
  it('sends the address and password, and goes to the dashboard of the page’s own language', async () => {
    nav.pathname = '/fr-CA/login';
    const user = userEvent.setup();
    render(<LoginForm />);

    await signIn(user);

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/fr-CA/dashboard'));
    expect(calls.filter((call) => call.url === '/api/auth/login')[0].body).toEqual({ email: 'alex@example.test', password: 'Secret123' });
  });

  it('falls back to the default language on a page that has none in its address', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await signIn(user);

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard'));
  });

  it('shows the route’s message when the sign-in is refused, and does not navigate', async () => {
    login = refused(401, { error: 'Invalid email or password' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await signIn(user);

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows a message, not a crash, when the refusal carries an error object instead of text', async () => {
    login = refused(503, { error: { message: 'Authentication is paused' } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await signIn(user);

    expect(await screen.findByText('Authentication is paused')).toBeInTheDocument();
  });

  it('does not take a 200 answer that names no user for a sign-in', async () => {
    login = ok({ message: 'ok' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await signIn(user);

    expect(await screen.findByText(/answered in a way this page does not understand/)).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('says the server could not be reached, and does not navigate', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).startsWith('/api/auth/methods')) return { ok: true, status: 200, json: async () => METHODS };
      throw new TypeError('Failed to fetch');
    }));

    await signIn(user);

    expect(await screen.findByText(/Could not reach the server/)).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('shows the status text for an answer that is not JSON', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).startsWith('/api/auth/methods')
      ? { ok: true, status: 200, json: async () => METHODS }
      : { ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } })));

    await signIn(user);

    expect(await screen.findByText('Login failed')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe('LoginForm: the second step', () => {
  beforeEach(() => {
    login = ok({ user: { id: 'u1' }, requiresMfa: true, mfaChallengeToken: 'challenge-token', mfaChallengeExpiresAt: '2026-03-04T00:05:00.000Z' });
  });

  it('asks for the authenticator code, sends it with the challenge token, and signs in on the route’s confirmation', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await signIn(user);

    await user.type(await screen.findByLabelText('Authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard'));
    expect(calls.filter((call) => call.url === '/api/auth/mfa/challenge')[0].body).toEqual({ challengeToken: 'challenge-token', code: '123456' });
  });

  it('sends a recovery code as a recovery code', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await signIn(user);

    await user.click(await screen.findByRole('button', { name: 'Use recovery code' }));
    await user.type(screen.getByLabelText('Recovery code'), 'ABCD-EFGH-IJ');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    expect(calls.filter((call) => call.url === '/api/auth/mfa/challenge')[0].body).toEqual({ challengeToken: 'challenge-token', recoveryCode: 'ABCD-EFGH-IJ' });
  });

  it('shows the route’s message for a wrong code, and does not sign in', async () => {
    challenge = refused(401, { error: 'Invalid code' });
    const user = userEvent.setup();
    render(<LoginForm />);
    await signIn(user);

    await user.type(await screen.findByLabelText('Authenticator code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Invalid code')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('does not take an answer without the confirmation for a verified code', async () => {
    challenge = ok({ userId: 'u1' });
    const user = userEvent.setup();
    render(<LoginForm />);
    await signIn(user);

    await user.type(await screen.findByLabelText('Authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText(/answered in a way this page does not understand/)).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe('LoginForm: the sign-in link', () => {
  async function openMagicLink(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('tab', { name: 'Email me a link' }));
    await user.type(screen.getByLabelText('Email'), 'alex@example.test');
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }));
  }

  it('shows the route’s neutral message once the request was accepted', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await openMagicLink(user);

    expect(await screen.findByText(/a sign-in link has been sent/)).toBeInTheDocument();
    expect(calls.filter((call) => call.url === '/api/auth/magic-link/request')[0].body).toEqual({ email: 'alex@example.test' });
  });

  it('shows the route’s message when the request is refused, and does not say a link was sent', async () => {
    magic = refused(400, { error: 'Invalid email address' });
    const user = userEvent.setup();
    render(<LoginForm />);

    await openMagicLink(user);

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
    expect(screen.queryByText(/sign-in link has been sent/)).not.toBeInTheDocument();
  });

  it('does not say a link was sent when the answer carries no message', async () => {
    magic = ok({});
    const user = userEvent.setup();
    render(<LoginForm />);

    await openMagicLink(user);

    expect(await screen.findByText(/answered in a way this page does not understand/)).toBeInTheDocument();
  });
});

describe('LoginForm: the sign-in options for an address', () => {
  it('shows only what the check allows: SSO-required hides the password and link tabs', async () => {
    methods = ok({ ...METHODS, password: false, magicLink: false, ssoRequired: true });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sso@example.test' } });

    expect(await screen.findByText('Your organization requires single sign-on.')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Password' })).not.toBeInTheDocument();
  });

  it.each([
    ['a refusal', refused(500, { error: 'Internal server error' }), 'Internal server error'],
    ['an answer that is missing a flag', ok({ password: true }), 'answered in a way this page does not understand'],
    ['an answer with a flag that is not yes or no', ok({ ...METHODS, sso: 'yes' }), 'answered in a way this page does not understand'],
  ])('says the options could not be checked for %s, and keeps the standard ones', async (_what, answer, reason) => {
    methods = answer;
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.test' } });

    const note = await screen.findByRole('status');
    expect(note).toHaveTextContent('We could not check which sign-in options apply to this address');
    expect(note).toHaveTextContent(reason);
    expect(screen.getByRole('tab', { name: 'Password' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Email me a link' })).toBeInTheDocument();
  });

  it('removes the note once a later check succeeds', async () => {
    methods = refused(500, { error: 'Internal server error' });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.test' } });
    await screen.findByRole('status');

    methods = ok(METHODS);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex2@example.test' } });

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
});
