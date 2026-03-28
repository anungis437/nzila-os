import { describe, it, expect } from 'vitest';

// The index.ts just re-exports from other modules.
// Verify it re-exports correctly.
describe('lib/auth/index re-exports', () => {
  it('exports Permission', async () => {
    // Dynamic import to avoid circular issues in top-level
    const mod = await import('../index');
    expect(mod.Permission).toBeDefined();
  });

  it('exports ROLE_PERMISSIONS', async () => {
    const mod = await import('../index');
    expect(mod.ROLE_PERMISSIONS).toBeDefined();
    expect(typeof mod.ROLE_PERMISSIONS).toBe('object');
  });

  it('exports hasPermission function', async () => {
    const mod = await import('../index');
    expect(typeof mod.hasPermission).toBe('function');
  });

  it('exports getRoleLevel function', async () => {
    const mod = await import('../index');
    expect(typeof mod.getRoleLevel).toBe('function');
  });

  it('exports AuthError class', async () => {
    const mod = await import('../index');
    expect(mod.AuthError).toBeDefined();
  });

  it('exports AuthErrorType enum', async () => {
    const mod = await import('../index');
    expect(mod.AuthErrorType).toBeDefined();
  });
});
