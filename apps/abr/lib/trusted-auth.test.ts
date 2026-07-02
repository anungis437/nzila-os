/**
 * CourtLens Phase 2C.6 trusted-auth resolver tests.
 *
 * Proves that:
 * - verifyAbrOrgMembership fails closed when no membership exists.
 * - Inactive users are rejected.
 * - Session orgId match is trusted.
 * - abr_users lookup returns the correct role.
 * - In-memory demo store works when DB is not configured.
 * - Production fails closed when no session, no DB, and unverified fallback disabled.
 * - resolveAbrRoleForRequest uses membership role by default.
 * - resolveAbrRoleForRequest honours x-abr-role ONLY when NODE_ENV !== 'production'
 *   AND ABR_ALLOW_HEADER_ROLE=true.
 * - Production browser-supplied x-abr-role: super_admin is IGNORED.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dbExecute: vi.fn(),
  listIncidentUsers: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
}));

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.dbExecute },
}));

vi.mock('@/modules/incidents/service', () => ({
  listIncidentUsers: mocks.listIncidentUsers,
}));

// Preserve original env
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  // Reset auth default: no session
  mocks.auth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });
});

afterEach(() => {
  process.env = originalEnv;
});

// ── verifyAbrOrgMembership ────────────────────────────────────────────────────

describe('verifyAbrOrgMembership — session_org_match', () => {
  it('trusts session when session.orgId matches requested orgId', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1', orgId: 'metro-university', orgRole: 'investigator',
    });
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe('investigator');
      expect(result.source).toBe('session_org_match');
    }
    // Session hit — no DB or memory lookup
    expect(mocks.dbExecute).not.toHaveBeenCalled();
    expect(mocks.listIncidentUsers).not.toHaveBeenCalled();
  });

  it('does NOT trust session when session.orgId differs from requested orgId', async () => {
    mocks.auth.mockResolvedValue({
      userId: 'user_1', orgId: 'other-org', orgRole: 'super_admin',
    });
    // No DB and no member in memory
    delete process.env.DATABASE_URL;
    mocks.listIncidentUsers.mockResolvedValue([]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'requested-org');

    expect(result.ok).toBe(false);
  });
});

describe('verifyAbrOrgMembership — abr_users DB lookup', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://fake';
  });

  it('returns role from abr_users when active', async () => {
    mocks.dbExecute.mockResolvedValue([{ role: 'hr_lead', active: true }]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe('hr_lead');
      expect(result.source).toBe('abr_users_lookup');
    }
  });

  it('rejects when abr_users has no matching row', async () => {
    mocks.dbExecute.mockResolvedValue([]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_membership');
  });

  it('rejects when abr_users row is inactive', async () => {
    mocks.dbExecute.mockResolvedValue([{ role: 'investigator', active: false }]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('user_inactive');
  });
});

describe('verifyAbrOrgMembership — in-memory demo path', () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('returns role from in-memory user store', async () => {
    mocks.listIncidentUsers.mockResolvedValue([
      { id: 'user_1', orgId: 'metro-university', role: 'organization_admin', active: true, email: 'a', name: 'A' },
    ]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe('organization_admin');
      expect(result.source).toBe('in_memory_demo');
    }
  });

  it('skips inactive in-memory users', async () => {
    mocks.listIncidentUsers.mockResolvedValue([
      { id: 'user_1', orgId: 'metro-university', role: 'organization_admin', active: false, email: 'a', name: 'A' },
    ]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    expect(result.ok).toBe(false);
  });

  it('rejects when in-memory store has no matching user', async () => {
    mocks.listIncidentUsers.mockResolvedValue([]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_membership');
  });
});

describe('verifyAbrOrgMembership — production fail-closed', () => {
  it('rejects in production when no session, no DB, no memory match, no unverified flag', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.ABR_ALLOW_UNVERIFIED_ORG;
    mocks.listIncidentUsers.mockResolvedValue([]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('production_unverified_blocked');
  });

  it('ignores ABR_ALLOW_UNVERIFIED_ORG in production', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    process.env.ABR_ALLOW_UNVERIFIED_ORG = 'true';
    delete process.env.DATABASE_URL;
    mocks.listIncidentUsers.mockResolvedValue([]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    // Flag is production-gated → must not grant access
    expect(result.ok).toBe(false);
  });

  it('honours ABR_ALLOW_UNVERIFIED_ORG in development only', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'development';
    process.env.ABR_ALLOW_UNVERIFIED_ORG = 'true';
    delete process.env.DATABASE_URL;
    mocks.listIncidentUsers.mockResolvedValue([]);
    const { verifyAbrOrgMembership } = await import('./trusted-auth');

    const result = await verifyAbrOrgMembership('user_1', 'metro-university');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('dev_unverified_fallback');
      expect(result.role).toBe('learner'); // minimum-privilege fallback
    }
  });
});

// ── resolveAbrRoleForRequest ─────────────────────────────────────────────────

describe('resolveAbrRoleForRequest — trusted role source', () => {
  it('uses membership role by default (no header override enabled)', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'development';
    delete process.env.ABR_ALLOW_HEADER_ROLE;
    const { resolveAbrRoleForRequest } = await import('./trusted-auth');
    const req = new Request('http://localhost/x', {
      headers: { 'x-abr-role': 'super_admin' },
    });

    const resolution = resolveAbrRoleForRequest(req, {
      ok: true, role: 'hr_lead', source: 'abr_users_lookup',
    });

    // Header ignored because ABR_ALLOW_HEADER_ROLE is not set
    expect(resolution.role).toBe('hr_lead');
    expect(resolution.source).toBe('abr_users_lookup');
  });

  it('honours x-abr-role in dev when ABR_ALLOW_HEADER_ROLE=true', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'development';
    process.env.ABR_ALLOW_HEADER_ROLE = 'true';
    const { resolveAbrRoleForRequest } = await import('./trusted-auth');
    const req = new Request('http://localhost/x', {
      headers: { 'x-abr-role': 'investigator' },
    });

    const resolution = resolveAbrRoleForRequest(req, {
      ok: true, role: 'hr_lead', source: 'abr_users_lookup',
    });

    expect(resolution.role).toBe('investigator');
    expect(resolution.source).toBe('x_abr_role_dev_header');
  });

  it('IGNORES x-abr-role in production even with ABR_ALLOW_HEADER_ROLE=true', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    process.env.ABR_ALLOW_HEADER_ROLE = 'true'; // flag is production-gated
    const { resolveAbrRoleForRequest } = await import('./trusted-auth');
    const req = new Request('http://localhost/x', {
      headers: { 'x-abr-role': 'super_admin' },
    });

    const resolution = resolveAbrRoleForRequest(req, {
      ok: true, role: 'learner', source: 'session_org_match',
    });

    // Forged header must NOT escalate
    expect(resolution.role).toBe('learner');
    expect(resolution.source).toBe('session_org_match');
  });

  it('cannot forge super_admin via browser header in production', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    // Attacker sets both env vars? Still production-gated
    process.env.ABR_ALLOW_HEADER_ROLE = 'true';
    const { resolveAbrRoleForRequest } = await import('./trusted-auth');
    const req = new Request('http://localhost/x', {
      headers: { 'x-abr-role': 'super_admin' },
    });

    const resolution = resolveAbrRoleForRequest(req, {
      ok: true, role: 'hr_lead', source: 'abr_users_lookup',
    });

    expect(resolution.role).not.toBe('super_admin');
    expect(resolution.role).toBe('hr_lead');
  });
});
