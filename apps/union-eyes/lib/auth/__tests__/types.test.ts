import { describe, it, expect } from 'vitest';
import { AuthError, AuthErrorType } from '../types';
import type { UserContext, OrganizationContext, AuthResult, PermissionCheckOptions, RoleCheckOptions, AuthMiddlewareContext } from '../types';

describe('AuthErrorType enum', () => {
  it('defines all error types', () => {
    expect(AuthErrorType.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(AuthErrorType.FORBIDDEN).toBe('FORBIDDEN');
    expect(AuthErrorType.INVALID_TOKEN).toBe('INVALID_TOKEN');
    expect(AuthErrorType.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
    expect(AuthErrorType.INSUFFICIENT_PERMISSIONS).toBe('INSUFFICIENT_PERMISSIONS');
    expect(AuthErrorType.ORGANIZATION_REQUIRED).toBe('ORGANIZATION_REQUIRED');
    expect(AuthErrorType.CLERK_UNAVAILABLE).toBe('CLERK_UNAVAILABLE');
  });
});

describe('AuthError class', () => {
  it('creates an error with type and message', () => {
    const err = new AuthError(AuthErrorType.UNAUTHORIZED, 'Not authenticated');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AuthError');
    expect(err.type).toBe(AuthErrorType.UNAUTHORIZED);
    expect(err.message).toBe('Not authenticated');
    expect(err.statusCode).toBe(401);
  });

  it('accepts custom status code', () => {
    const err = new AuthError(AuthErrorType.FORBIDDEN, 'Access denied', 403);
    expect(err.statusCode).toBe(403);
  });

  it('accepts context metadata', () => {
    const ctx = { resource: 'claims', action: 'delete' };
    const err = new AuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Cannot delete', 403, ctx);
    expect(err.context).toEqual(ctx);
  });
});

describe('Type interfaces (structural checks)', () => {
  it('UserContext shape is valid', () => {
    const ctx: UserContext = { userId: 'u1' };
    expect(ctx.userId).toBe('u1');
    expect(ctx.organizationId).toBeUndefined();
  });

  it('OrganizationContext extends UserContext', () => {
    const ctx: OrganizationContext = {
      userId: 'u1',
      organizationId: 'org1',
    };
    expect(ctx.organizationId).toBe('org1');
  });

  it('AuthResult success shape', () => {
    const result: AuthResult = {
      success: true,
      data: { userId: 'u1' },
    };
    expect(result.success).toBe(true);
  });

  it('AuthResult error shape', () => {
    const result: AuthResult = {
      success: false,
      error: 'Something went wrong',
      statusCode: 500,
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went wrong');
  });
});
