/**
 * Shared API route test infrastructure for union-eyes.
 *
 * Import and call `setupRouteTestMocks()` at the TOP of any API route test file
 * (before any route imports) to wire up all the common dependencies.
 *
 * The mocks are designed to allow the happy-path through every withApi /
 * withRoleAuth handler with a credentialed steward caller and a resolved org.
 */

import { vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TEST_USER_ID = 'user_test_001';
export const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';
export const TEST_ORG_UUID = TEST_ORG_ID;

/** Minimal AuthUser stub — steward level clears most role gates. */
export const STEWARD_USER = {
  id: TEST_USER_ID,
  organizationId: TEST_ORG_ID,
  role: 'steward',
  roles: ['steward'],
  email: 'test@example.com',
};

export const MEMBER_USER = {
  id: TEST_USER_ID,
  organizationId: TEST_ORG_ID,
  role: 'member',
  roles: ['member'],
  email: 'member@example.com',
};

export const ADMIN_USER = {
  id: TEST_USER_ID,
  organizationId: TEST_ORG_ID,
  role: 'system_admin',
  roles: ['system_admin'],
  email: 'admin@example.com',
};

// ─── Request Factories ────────────────────────────────────────────────────────

export function makeGetRequest(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost:3000/api/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

export function makePostRequest(path: string, body: unknown = {}) {
  return new NextRequest(`http://localhost:3000/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function makePatchRequest(path: string, body: unknown = {}) {
  return new NextRequest(`http://localhost:3000/api/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function makeDeleteRequest(path: string) {
  return new NextRequest(`http://localhost:3000/api/${path}`, {
    method: 'DELETE',
  });
}

// ─── Common mock DB row factories ────────────────────────────────────────────

export const mockDbRow = <T extends Record<string, unknown>>(overrides: T = {} as T) => ({
  id: '00000000-0000-0000-0000-000000000099',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  organizationId: TEST_ORG_ID,
  ...overrides,
});

// ─── Hoisted mock setup ────────────────────────────────────────────────────────
//
// Call `setupRouteTestMocks()` in each test file's hoisted block to ensure
// all common dependencies are mocked before any route module is imported.
//

// NOTE: Do NOT use buildCommonMockDefs() — vi.hoisted() must be called at the
// top level of each test file. Copy the hoisted block from dry-run-calibration.test.ts.
// This file provides only non-hoisted utilities (constants, factories, types).

/** Standard audit constants used across most route files */
export const AUDIT_EVENT_TYPE = {
  DATA_ACCESS: 'data.access',
  DATA_CREATE: 'data.create',
  DATA_UPDATE: 'data.update',
  DATA_DELETE: 'data.delete',
  DATA_EXPORT: 'data.export',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_FAILED: 'auth.failed',
  ADMIN_CONFIG_CHANGED: 'admin.config_changed',
  SECURITY_BREACH: 'security.breach',
};

export const AUDIT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};
