// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LoginForm } from '../login-form';

const { signInWithEntra } = vi.hoisted(() => ({ signInWithEntra: vi.fn() }));
vi.mock('@nzila/platform-auth/entra/client', () => ({ signInWithEntra }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

beforeEach(() => { signInWithEntra.mockReset().mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Microsoft sign-in from the Union Eyes login form', () => {
  it('starts the existing Entra client action with the normal destination', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Microsoft' }));
    await waitFor(() => expect(signInWithEntra).toHaveBeenCalledWith('/en-CA/dashboard'));
    expect(signInWithEntra).toHaveBeenCalledTimes(1);
  });

  it('preserves the caller-supplied application destination', async () => {
    render(<LoginForm postLoginPath="/fr-CA/dashboard/workspace" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Microsoft' }));
    await waitFor(() => expect(signInWithEntra).toHaveBeenCalledWith('/fr-CA/dashboard/workspace'));
  });

  it('uses the same Entra action when organizational policy requires SSO', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ password: false, magicLink: false, sso: true, ssoRequired: true }) }));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'sso-probe@example.test' } });
    await screen.findByText(/organization requires/i);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Microsoft' }));
    await waitFor(() => expect(signInWithEntra).toHaveBeenCalledTimes(1));
  });

  it('shows a retryable error when the sign-in action cannot start', async () => {
    signInWithEntra.mockRejectedValue(new Error('network unavailable'));
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Microsoft' }));
    expect(await screen.findByText('Unable to start Microsoft sign-in. Please try again.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue with Microsoft' })).toBeEnabled();
  });
});
