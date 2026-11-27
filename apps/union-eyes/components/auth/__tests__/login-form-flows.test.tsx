// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render as renderView, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en-CA.json';
import fr from '@/messages/fr-CA.json';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';
import { LoginForm } from '../login-form';

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: '/login' }));
vi.mock('@nzila/platform-auth/entra/client', () => ({ signInWithEntra: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }), usePathname: () => nav.pathname }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const copy = () => nav.pathname.startsWith('/fr-CA/') ? fr : en;
function render(children: React.ReactNode) {
  return renderView(<NextIntlClientProvider locale={nav.pathname.startsWith('/fr-CA/') ? 'fr-CA' : 'en-CA'} messages={copy()} timeZone="America/Toronto">{children}</NextIntlClientProvider>);
}

const ok = (body: unknown): Answer => ({ status: 200, body });
const refused = (status: number, body: unknown): Answer => ({ status, body });

/** What GET /api/auth/methods answers: the six flags getAuthMethodAvailability returns, and userExists (a hint the screen does not use). */
const METHODS = { password: true, magicLink: true, sso: true, passwordReset: true, ssoRequired: false, inviteRequired: false, userExists: null };

let methods: Answer;
let login: Answer;
let challenge: Answer;
let magic: Answer;
let calls: Call[];
let organizationAnswer: Answer;
let selectionAnswer: Answer;
const AUTHORITY = 'CANONICAL_CURRENT_STATE_V2';
const firstOrganization = { id: '11111111-1111-4111-8111-111111111111', name: 'First synthetic local', slug: 'first-local' };
const secondOrganization = { id: '22222222-2222-4222-8222-222222222222', name: 'Second synthetic local', slug: 'second-local' };
const choices = (organizations = [firstOrganization], activeOrganizationId: string | null = null) => ({
  organizations, activeOrganizationId, organizationAuthority: AUTHORITY,
  memberships: organizations.map((organization) => ({ organizationId: organization.id, userId: 'u1', role: 'member' })),
});
const selected = (organization = firstOrganization) => ({ success: true, organization,
  activeOrganizationId: organization.id, organizationAuthority: AUTHORITY });

beforeEach(() => {
  nav.push.mockClear();
  nav.pathname = '/login';
  methods = ok(METHODS);
  login = ok({ user: { id: 'u1', email: 'alex@example.test', firstName: 'Alex', lastName: 'Morin' } });
  challenge = ok({ ok: true, userId: 'u1' });
  magic = ok({ message: 'If that email is recognised, a sign-in link has been sent. Please check your inbox.' });
  organizationAnswer = ok(choices());
  selectionAnswer = ok(selected());
  calls = installFetch(({ url, method }) => {
    if (url.startsWith('/api/auth/methods?')) return methods;
    if (url === '/api/auth/login' && method === 'POST') return login;
    if (url === '/api/auth/mfa/challenge' && method === 'POST') return challenge;
    if (url === '/api/auth/magic-link/request' && method === 'POST') return magic;
    if (url === '/api/users/me/organizations' && method === 'GET') return organizationAnswer;
    if (url === '/api/organizations/switch' && method === 'POST') return selectionAnswer;
    throw new Error(`unexpected request ${method} ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(copy().auth.email), 'alex@example.test');
  await user.type(screen.getByLabelText(copy().auth.password), 'Secret123');
  await user.click(screen.getByRole('button', { name: copy().loginForm.signIn }));
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

describe('LoginForm: canonical organization selection after authentication', () => {
  it('binds the sole offered membership through the canonical API before navigating', async () => {
    const user = userEvent.setup(); render(<LoginForm />);
    await signIn(user);
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard'));
    const indexes = calls.map((call) => call.url);
    expect(indexes.indexOf('/api/users/me/organizations')).toBeLessThan(indexes.indexOf('/api/organizations/switch'));
    expect(calls.find((call) => call.url === '/api/organizations/switch')?.body).toEqual({ organizationId: firstOrganization.id });
  });

  it('requires an explicit accessible French choice when multiple memberships are offered', async () => {
    nav.pathname = '/fr-CA/sign-in'; organizationAnswer = ok(choices([firstOrganization, secondOrganization]));
    selectionAnswer = ok(selected(secondOrganization));
    const user = userEvent.setup(); render(<LoginForm />); await signIn(user);
    const select = await screen.findByRole('combobox', { name: fr.loginForm.organization });
    expect(select).toHaveValue('');
    expect(nav.push).not.toHaveBeenCalled();
    expect(calls.some((call) => call.url === '/api/organizations/switch')).toBe(false);
    await user.selectOptions(select, secondOrganization.id);
    await user.click(screen.getByRole('button', { name: fr.loginForm.continueOrganization }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/fr-CA/dashboard'));
    expect(calls.find((call) => call.url === '/api/organizations/switch')?.body).toEqual({ organizationId: secondOrganization.id });
  });

  it('reports zero active organizations and offers a fresh sign-in without navigating', async () => {
    organizationAnswer = ok(choices([]));
    const user = userEvent.setup(); render(<LoginForm />); await signIn(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(en.loginForm.noOrganizationAccess);
    expect(calls.some((call) => call.url === '/api/organizations/switch')).toBe(false);
    expect(nav.push).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: en.loginForm.restartSignIn }));
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('refuses an organization offered without the authenticated membership', async () => {
    organizationAnswer = ok({ ...choices(), organizations: [firstOrganization, secondOrganization] });
    const user = userEvent.setup(); render(<LoginForm />); await signIn(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(en.loginForm.unexpectedError);
    expect(calls.some((call) => call.url === '/api/organizations/switch')).toBe(false);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('does not redirect when a formerly offered choice is revoked before selection', async () => {
    organizationAnswer = ok(choices([firstOrganization, secondOrganization]));
    selectionAnswer = refused(403, { error: 'Organization authority denied' });
    const user = userEvent.setup(); render(<LoginForm />); await signIn(user);
    await user.selectOptions(await screen.findByRole('combobox', { name: en.loginForm.organization }), secondOrganization.id);
    await user.click(screen.getByRole('button', { name: en.loginForm.continueOrganization }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.loginForm.organizationAccessChanged);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it.each([401, 503])('reports failed/expired organization lookup HTTP %s without treating authentication as dashboard access', async (status) => {
    organizationAnswer = refused(status, { error: 'Organization authority denied' });
    const user = userEvent.setup(); render(<LoginForm />); await signIn(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(en.loginForm.organizationAccessChanged);
    expect(calls.some((call) => call.url === '/api/organizations/switch')).toBe(false);
    expect(nav.push).not.toHaveBeenCalled();
    organizationAnswer = ok(choices());
    await user.click(screen.getByRole('button', { name: en.loginForm.refreshOrganizations }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard'));
    expect(calls.filter((call) => call.url === '/api/auth/login')).toHaveLength(1);
  });

  it('refuses a successful-looking selection response naming a different organization', async () => {
    selectionAnswer = ok(selected(secondOrganization));
    const user = userEvent.setup(); render(<LoginForm />); await signIn(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(en.loginForm.unexpectedError);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('preserves an already bound canonical membership and the configured destination', async () => {
    organizationAnswer = ok(choices([firstOrganization], firstOrganization.id));
    const user = userEvent.setup(); render(<LoginForm postLoginPath="/en-CA/dashboard/claims" />); await signIn(user);
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard/claims'));
    expect(calls.some((call) => call.url === '/api/organizations/switch')).toBe(false);
  });

  it.each([
    { user: { id: 'u1' }, requiresMfa: true },
    { user: { id: 'u1' }, requiresMfa: 'true' },
  ])('does not advance a malformed MFA-required response into organization selection', async (answer) => {
    login = ok(answer);
    const user = userEvent.setup(); render(<LoginForm />); await signIn(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(en.loginForm.unexpectedError);
    expect(calls.some((call) => call.url === '/api/users/me/organizations')).toBe(false);
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe('LoginForm: the second step', () => {
  beforeEach(() => {
    login = ok({ user: { id: 'u1' }, requiresMfa: true, mfaChallengeToken: 'challenge-token', mfaChallengeExpiresAt: '2026-03-04T00:05:00.000Z' });
  });

  it('presents French password and MFA controls and preserves the real challenge contract', async () => {
    nav.pathname = '/fr-CA/sign-in';
    const user = userEvent.setup();
    render(<LoginForm />);
    expect(screen.getByRole('heading', { name: fr.loginForm.welcome })).toBeVisible();
    expect(screen.getByRole('tablist', { name: fr.loginForm.method })).toBeVisible();
    await signIn(user);
    challenge = refused(401, { error: 'Invalid code' });
    await user.type(await screen.findByLabelText(fr.loginForm.authenticatorCode), '123456');
    await user.click(screen.getByRole('button', { name: fr.loginForm.verify }));
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.loginForm.invalidCode);
    expect(nav.push).not.toHaveBeenCalled();
    challenge = ok({ ok: true, userId: 'u1' });
    await user.click(screen.getByRole('button', { name: fr.loginForm.verify }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/fr-CA/dashboard'));
    expect(calls.find((call) => call.url === '/api/auth/mfa/challenge')?.body).toEqual({ challengeToken: 'challenge-token', code: '123456' });
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
