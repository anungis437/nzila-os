/**
 * ARTIFACT TYPE: Utility
 * DOCTRINE_VERSION: 1.0.0
 *
 * ICRA assessment-access capability — the bounded, purpose-specific bearer
 * credential that gates read/write access to an existing pseudonymous ICRA
 * assessment after creation.
 *
 * Architecture decision (PR #752): ICRA_PSEUDONYMOUS_NO_LOGIN = APPROVED,
 * ASSESSMENT_ID_AS_SOLE_BEARER_AUTHORITY = REJECTED. The assessmentId UUID
 * remains a public, loggable identifier (route param, URL). It is never the
 * authorization secret. This module is that secret's lifecycle.
 *
 * Conceptually distinct from lib/icra/claim-tokens.ts:
 *   - assessment capability  = temporary pseudonymous questionnaire/results
 *                              access (this module)
 *   - claim token            = one-time transition into an authenticated
 *                              Nzila user/org identity (claim-tokens.ts)
 * Do not conflate or reuse one for the other.
 *
 * Only a SHA-256 hash of the capability token is ever persisted
 * (icra_assessments.capability_token_hash). The raw token is returned to
 * the caller exactly once, at issuance (assessment creation), and is never
 * recoverable from the database afterward.
 */

import crypto from 'crypto';
import type { NextResponse } from 'next/server';

const TOKEN_BYTE_LENGTH = 32;
export const CAPABILITY_TOKEN_TTL_DAYS = 30;
const COOKIE_PREFIX = 'icra_cap_';

export function generateCapabilityToken(): string {
  return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
}

export function hashCapabilityToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function computeCapabilityExpiry(now: Date = new Date()): Date {
  const expires = new Date(now);
  expires.setUTCDate(expires.getUTCDate() + CAPABILITY_TOKEN_TTL_DAYS);
  return expires;
}

export function isCapabilityExpired(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return true; // no expiry on record => never validly issued
  return expiresAt.getTime() < now.getTime();
}

function cookieName(assessmentId: string): string {
  return `${COOKIE_PREFIX}${assessmentId}`;
}

/**
 * Extracts the presented capability token from a request, if any.
 * Presentation order: `Authorization: Bearer <token>` header first (explicit
 * API/programmatic clients), then the per-assessment HttpOnly cookie set at
 * issuance (default browser flow). Never accepted via query parameter.
 */
export function extractCapabilityToken(request: Request, assessmentId: string): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) return token;
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const name = cookieName(assessmentId);
    for (const part of cookieHeader.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.slice(0, eq).trim();
      if (key === name) {
        return decodeURIComponent(part.slice(eq + 1).trim());
      }
    }
  }

  return null;
}

/** Sets the HttpOnly issuance cookie on a route response. */
export function setCapabilityCookie(response: NextResponse, assessmentId: string, token: string): void {
  response.cookies.set(cookieName(assessmentId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CAPABILITY_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });
}

export interface CapabilityCheckRow {
  capabilityTokenHash: string | null;
  capabilityTokenExpiresAt: Date | null;
}

export type CapabilityDenialReason = 'missing' | 'invalid' | 'expired' | 'not_found';

export type CapabilityCheckResult =
  | { ok: true }
  | { ok: false; reason: CapabilityDenialReason };

/**
 * Verifies a presented token against the assessment's stored capability
 * hash. Constant-time comparison against the hash (not the raw token —
 * raw tokens are never stored) to avoid timing side-channels on hash
 * equality.
 */
export function checkCapability(
  presentedToken: string | null,
  row: CapabilityCheckRow | undefined,
): CapabilityCheckResult {
  if (!row) return { ok: false, reason: 'not_found' };
  if (!presentedToken) return { ok: false, reason: 'missing' };
  if (!row.capabilityTokenHash) return { ok: false, reason: 'invalid' };
  if (isCapabilityExpired(row.capabilityTokenExpiresAt)) return { ok: false, reason: 'expired' };

  const presentedHash = Buffer.from(hashCapabilityToken(presentedToken), 'hex');
  const storedHash = Buffer.from(row.capabilityTokenHash, 'hex');
  if (presentedHash.length !== storedHash.length) return { ok: false, reason: 'invalid' };
  if (!crypto.timingSafeEqual(presentedHash, storedHash)) return { ok: false, reason: 'invalid' };

  return { ok: true };
}

export function capabilityDenialStatus(reason: CapabilityDenialReason): number {
  switch (reason) {
    case 'not_found':
      return 404;
    case 'expired':
      return 410;
    default:
      return 401;
  }
}
