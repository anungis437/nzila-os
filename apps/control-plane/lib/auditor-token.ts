import { createHmac, randomUUID } from 'node:crypto'

export type AuditorTokenPayload = {
  tokenId: string
  role: 'auditor'
  organizationId: string
  issuedAt: string
  expiresAt: string
  issuedBy?: string
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function getSigningSecret(): string {
  const secret = process.env.AUDITOR_TOKEN_SECRET ?? process.env.CONTROL_PLANE_API_KEY
  if (!secret || secret.trim().length === 0) {
    throw new Error('Missing AUDITOR_TOKEN_SECRET (or CONTROL_PLANE_API_KEY fallback)')
  }
  return secret
}

function sign(encodedHeader: string, encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url')
}

export function createAuditorAccessToken(input: {
  organizationId: string
  expiresAt: string
  issuedBy?: string
  tokenId?: string
}): string {
  const header = { alg: 'HS256', typ: 'NZILA-AUDIT' }
  const payload: AuditorTokenPayload = {
    tokenId: input.tokenId ?? randomUUID(),
    role: 'auditor',
    organizationId: input.organizationId,
    issuedAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    issuedBy: input.issuedBy,
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = sign(encodedHeader, encodedPayload, getSigningSecret())
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export function verifyAuditorAccessToken(token: string): AuditorTokenPayload {
  const [encodedHeader, encodedPayload, signature] = token.split('.')
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error('Malformed auditor token')
  }

  const expected = sign(encodedHeader, encodedPayload, getSigningSecret())
  if (expected !== signature) {
    throw new Error('Invalid auditor token signature')
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AuditorTokenPayload
  if (payload.role !== 'auditor') {
    throw new Error('Invalid auditor token role')
  }

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error('Auditor token expired')
  }

  return payload
}
