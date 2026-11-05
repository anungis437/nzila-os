/**
 * Workbook access capability: the bounded bearer credential for an UNCLAIMED, pseudonymous workbook.
 *
 * The workbook id is a public, loggable identifier (it is in page URLs and checkout redirects). It is never the secret. Until the workbook
 * is claimed by an authenticated user, this capability is the whole credential for its protected data (memory holders and their notes);
 * once claimed, the capability is revoked in the claim's own statement and ownership authority applies instead (see access-control.ts).
 *
 * Same lifecycle as the ICRA assessment capability (lib/icra/assessment-capability.ts), whose primitives it reuses: only a SHA-256 hash is
 * stored, the raw token is returned once at issuance, comparison is constant-time, it expires, and it is never accepted from a query string.
 * It has its own cookie name so a workbook capability cannot be mistaken for an assessment one.
 */
import type { NextResponse } from 'next/server'
import {
  CAPABILITY_TOKEN_TTL_DAYS,
  checkCapability,
  computeCapabilityExpiry,
  decodeCapabilityCookieValue,
  generateCapabilityToken,
  hashCapabilityToken,
} from '@/lib/icra/assessment-capability'

const COOKIE_PREFIX = 'wbk_cap_'

export const workbookCapabilityCookieName = (workbookId: string) => `${COOKIE_PREFIX}${workbookId}`

export interface IssuedWorkbookCapability {
  token: string
  tokenHash: string
  expiresAt: Date
}

export function issueWorkbookCapability(now: Date = new Date()): IssuedWorkbookCapability {
  const token = generateCapabilityToken()
  return { token, tokenHash: hashCapabilityToken(token), expiresAt: computeCapabilityExpiry(now) }
}

/** `Authorization: Bearer` first (programmatic clients), then the per-workbook HttpOnly cookie. Never a query parameter. */
export function extractWorkbookCapability(request: Request, workbookId: string): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) return token
  }
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const name = workbookCapabilityCookieName(workbookId)
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return decodeCapabilityCookieValue(part.slice(eq + 1).trim())
  }
  return null
}

/** For server components, which have no Request: the capability cookie of this workbook, decoded. */
export async function readWorkbookCapabilityCookie(workbookId: string): Promise<string | null> {
  const { cookies } = await import('next/headers')
  return decodeCapabilityCookieValue((await cookies()).get(workbookCapabilityCookieName(workbookId))?.value)
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
})

export function setWorkbookCapabilityCookie(response: NextResponse, workbookId: string, token: string): void {
  response.cookies.set(workbookCapabilityCookieName(workbookId), token, cookieOptions(CAPABILITY_TOKEN_TTL_DAYS * 24 * 60 * 60))
}

export function clearWorkbookCapabilityCookie(response: NextResponse, workbookId: string): void {
  response.cookies.set(workbookCapabilityCookieName(workbookId), '', cookieOptions(0))
}

export interface WorkbookCapabilityRow {
  capabilityTokenHash: string | null
  capabilityTokenExpiresAt: Date | null
}

/** Whether the presented token is this workbook's live capability. A workbook with no capability on record admits nobody. */
export const workbookCapabilityHolds = (presented: string | null, row: WorkbookCapabilityRow): boolean => checkCapability(presented, row).ok
