// All remaining auth handler wrappers — thin re-exports from platform-auth.
// Tests verify the module loads and exports the expected handler symbols.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@nzila/platform-auth/password/handlers', () => ({
  handleLogin: vi.fn(async () => new Response('{}', { status: 200 })),
  handleLogout: vi.fn(async () => new Response('{}', { status: 200 })),
  handleMe: vi.fn(async () => new Response('{}', { status: 200 })),
  handleSignup: vi.fn(async () => new Response('{}', { status: 201 })),
  handleResetPassword: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('@nzila/platform-auth/invites/handlers', () => ({
  handleAcceptInvite: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('@nzila/platform-auth/magic-link/handlers', () => ({
  handleVerifyMagicLink: vi.fn(async () => new Response('{}', { status: 200 })),
}));

vi.mock('@nzila/platform-auth/policy/handlers', () => ({
  handleGetMethods: vi.fn(async () => new Response('{}', { status: 200 })),
}));

describe('auth/reset-password route', () => {
  it('exports POST', async () => {
    const { POST } = await import('../auth/reset-password/route');
    expect(typeof POST).toBe('function');
  });
});

describe('auth/invite/accept route', () => {
  it('exports POST', async () => {
    const { POST } = await import('../auth/invite/accept/route');
    expect(typeof POST).toBe('function');
  });
});

describe('auth/magic-link/verify route', () => {
  it('exports GET and POST', async () => {
    const { GET, POST } = await import('../auth/magic-link/verify/route');
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
  });
});

describe('auth/methods route', () => {
  it('exports GET', async () => {
    const { GET } = await import('../auth/methods/route');
    expect(typeof GET).toBe('function');
  });
});
