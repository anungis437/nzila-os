/**
 * Financial Officer 2.1 — shared financial authority and capability-state helpers.
 *
 * Financial authority is an explicit allow-list. It is never inferred from the
 * numeric ROLE_HIERARCHY level, from steward/officer status, or from a SaaS
 * entitlement (UE-FINANCIAL-OFFICER-CANONICAL-2.1 §I, §VI).
 *
 * This module is a route-level guard only. It does not model per-institution
 * delegations, monetary limits or segregation of duties; those remain
 * NOT_PROVEN until a mandate store exists.
 */
import { NextResponse } from 'next/server';
import type { UserRole } from '@/lib/api-auth-guard';

/**
 * Roles allowed to read or act on individual member financial records
 * (arrears, deductions, remittance line matching, payment plans).
 *
 * `secretary_treasurer` is the only organizational role that holds
 * `Permission.MANAGE_FINANCES` in the RBAC matrix; a unit test pins this list
 * to that matrix so the two cannot drift silently.
 */
export const FINANCIAL_MEMBER_DATA_ROLES: UserRole[] = ['secretary_treasurer'];

export type UnavailableCapabilityState = 'NOT_IMPLEMENTED' | 'UNAVAILABLE';

/**
 * HTTP 501 for a capability that has no qualified authoritative backing.
 * A deprecation payload with HTTP 200 must never stand in for this.
 */
export function capabilityNotImplementedResponse(
  capability: string,
  reason: string,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: reason,
      },
      capability,
      capabilityState: 'NOT_IMPLEMENTED' as UnavailableCapabilityState,
    },
    { status: 501 },
  );
}
