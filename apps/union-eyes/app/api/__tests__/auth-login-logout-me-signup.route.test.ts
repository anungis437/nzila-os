// Auth login/logout/me/signup are thin re-exports from @nzila/platform-auth/password/handlers.
// These tests verify the module can be imported and exports the expected handlers.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@nzila/platform-auth/password/handlers', () => ({
  handleLogin: vi.fn(async () => new Response('{}', { status: 200 })),
  handleLogout: vi.fn(async () => new Response('{}', { status: 200 })),
  handleMe: vi.fn(async () => new Response('{}', { status: 200 })),
  handleSignup: vi.fn(async () => new Response('{}', { status: 201 })),
}));

describe('auth/login route', () => {
  it('exports a POST handler', async () => {
    const { POST } = await import('../auth/login/route');
    expect(typeof POST).toBe('function');
  });
});

describe('auth/logout route', () => {
  it('exports a POST handler', async () => {
    const { POST } = await import('../auth/logout/route');
    expect(typeof POST).toBe('function');
  });
});

describe('auth/me route', () => {
  it('exports a GET handler', async () => {
    const { GET } = await import('../auth/me/route');
    expect(typeof GET).toBe('function');
  });
});

describe('auth/signup route', () => {
  it('exports a POST handler', async () => {
    const { POST } = await import('../auth/signup/route');
    expect(typeof POST).toBe('function');
  });
});
