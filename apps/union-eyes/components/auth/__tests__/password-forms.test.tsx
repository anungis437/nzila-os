// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';
import { ForgotPasswordForm } from '../forgot-password-form';
import { ResetPasswordForm } from '../reset-password-form';
import { SignupForm } from '../signup-form';

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: '/signup', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const ok = (status: number, body: unknown): Answer => ({ status, body });

let answer: Answer;
let calls: Call[];

beforeEach(() => {
  nav.push.mockClear();
  nav.pathname = '/signup';
  nav.search = '';
  answer = ok(200, {});
  calls = installFetch(() => answer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SignupForm', () => {
  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('First name'), 'Alex');
    await user.type(screen.getByLabelText('Last name'), 'Morin');
    await user.type(screen.getByLabelText('Email'), 'alex@example.test');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('sends the four fields and goes to the dashboard of the page’s own language once the account exists', async () => {
    nav.pathname = '/fr-CA/signup';
    answer = ok(201, { user: { id: 'u1', email: 'alex@example.test', firstName: 'Alex', lastName: 'Morin' }, message: 'Account created successfully' });
    const user = userEvent.setup();
    render(<SignupForm />);

    await fill(user);

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/fr-CA/dashboard'));
    expect(calls).toEqual([{ url: '/api/auth/signup', method: 'POST', body: { email: 'alex@example.test', password: 'Secret123', firstName: 'Alex', lastName: 'Morin' } }]);
  });

  it('shows the route’s message for a refused password or address, and does not navigate', async () => {
    answer = ok(400, { error: 'Password must contain at least one digit' });
    const user = userEvent.setup();
    render(<SignupForm />);

    await fill(user);

    expect(await screen.findByText('Password must contain at least one digit')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('does not take an answer that names no user for an account', async () => {
    answer = ok(200, { message: 'ok' });
    const user = userEvent.setup();
    render(<SignupForm />);

    await fill(user);

    expect(await screen.findByText(/answered in a way this page does not understand/)).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('says the server could not be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const user = userEvent.setup();
    render(<SignupForm />);

    await fill(user);

    expect(await screen.findByText(/Could not reach the server/)).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe('ForgotPasswordForm', () => {
  async function ask(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Email'), 'alex@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  }

  it('says to check the email only once the route accepted the request, and names the address', async () => {
    answer = ok(200, { message: 'If an account exists with that email, a password reset link will be sent.' });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await ask(user);

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText('alex@example.test')).toBeInTheDocument();
    expect(calls).toEqual([{ url: '/api/auth/forgot-password', method: 'POST', body: { email: 'alex@example.test' } }]);
  });

  it('shows the route’s message when the request is refused, and does not say an email was sent', async () => {
    answer = ok(429, { error: 'Too many requests. Please try again later.' });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await ask(user);

    expect(await screen.findByText('Too many requests. Please try again later.')).toBeInTheDocument();
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });

  it('does not say an email was sent when the answer is not the route’s', async () => {
    answer = ok(200, {});
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await ask(user);

    expect(await screen.findByText(/answered in a way this page does not understand/)).toBeInTheDocument();
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });

  it('says the server could not be reached, and does not say an email was sent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await ask(user);

    expect(await screen.findByText(/Could not reach the server/)).toBeInTheDocument();
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });
});

describe('ResetPasswordForm', () => {
  async function reset(user: ReturnType<typeof userEvent.setup>, confirmation = 'NewSecret123') {
    await user.type(screen.getByLabelText('New password'), 'NewSecret123');
    await user.type(screen.getByLabelText('Confirm password'), confirmation);
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
  }

  it('sends the token from the link with the new password, and says it was reset on the route’s confirmation', async () => {
    nav.search = 'token=abc123';
    answer = ok(200, { message: 'Password has been reset. Please sign in.' });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await reset(user);

    expect(await screen.findByText('Password reset!')).toBeInTheDocument();
    expect(calls).toEqual([{ url: '/api/auth/reset-password', method: 'POST', body: { token: 'abc123', newPassword: 'NewSecret123' } }]);
  });

  it('does not send anything when the two passwords differ', async () => {
    nav.search = 'token=abc123';
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await reset(user, 'Different123');

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it('shows the route’s message for an expired or used link, and does not say it was reset', async () => {
    nav.search = 'token=abc123';
    answer = ok(400, { error: 'This reset link has expired. Please request a new one.' });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await reset(user);

    expect(await screen.findByText('This reset link has expired. Please request a new one.')).toBeInTheDocument();
    expect(screen.queryByText('Password reset!')).not.toBeInTheDocument();
  });

  it('does not say it was reset when the answer is not the route’s confirmation', async () => {
    nav.search = 'token=abc123';
    answer = ok(200, {});
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await reset(user);

    expect(await screen.findByText(/answered in a way this page does not understand/)).toBeInTheDocument();
    expect(screen.queryByText('Password reset!')).not.toBeInTheDocument();
  });

  it('says the link is invalid, and offers a new one, when the address has no token', () => {
    render(<ResetPasswordForm />);

    expect(screen.getByText('Invalid reset link')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute('href', '/forgot-password');
  });
});
