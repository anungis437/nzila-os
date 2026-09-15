import { randomUUID } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'
import { and, eq, sql } from 'drizzle-orm'
import { db as defaultDb } from '@nzila/db/client'
import { authOrganizationUsers, authUsers } from '@nzila/db/schema'

export const ACCEPTANCE_AUTH_COOKIE = 'ue_acceptance_auth'
export const ACCEPTANCE_AUTH_HEADER = 'x-unioneyes-acceptance-auth'
export const ACCEPTANCE_AUTH_VERSION = 'ue-acceptance-v1'
export const ACCEPTANCE_AUTH_ISSUER = 'union-eyes-staging-acceptance'
export const ACCEPTANCE_AUTH_AUDIENCE = 'union-eyes-runtime'
export const ACCEPTANCE_AUTH_MAX_TTL_SECONDS = 15 * 60
export const ACCEPTANCE_AUTH_MAX_FUTURE_IAT_SECONDS = 60

export interface AcceptanceAuthEnv {
  UNION_EYES_ACCEPTANCE_AUTH_ENABLED?: string
  UNION_EYES_ACCEPTANCE_AUTH_SECRET?: string
  UNION_EYES_ACCEPTANCE_AUTH_USER_IDS?: string
  NODE_ENV?: string
  UE_ENVIRONMENT?: string
  NEXT_PUBLIC_APP_ENV?: string
  NZILA_MODE?: string
  UE_DEPLOYMENT_TYPE?: string
  NZILA_DEPLOYMENT_TYPE?: string
  DEPLOYMENT_ENVIRONMENT?: string
}

export interface AcceptanceAuthUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  organizationId: string | null
  sessionId: string
  jti: string
}

type AcceptanceJwtPayload = {
  ver?: unknown
  env?: unknown
}

export type AcceptanceDb = {
  select: typeof defaultDb.select
  transaction?: typeof defaultDb.transaction
  execute?: typeof defaultDb.execute
}

async function withAcceptanceAuthDbContext<T>(
  db: AcceptanceDb,
  userId: string,
  operation: (scopedDb: AcceptanceDb) => Promise<T>,
): Promise<T> {
  if (typeof db.transaction !== 'function') {
    return operation(db)
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`)
    return operation(tx as AcceptanceDb)
  })
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function bool(value: string | undefined): boolean {
  return normalize(value) === 'true'
}

function configuredSurfaceEnvironment(env: AcceptanceAuthEnv): string {
  return normalize(env.UE_ENVIRONMENT) || normalize(env.NEXT_PUBLIC_APP_ENV) || normalize(env.NZILA_MODE)
}

function deploymentEnvironment(env: AcceptanceAuthEnv): string {
  return normalize(env.UE_DEPLOYMENT_TYPE) || normalize(env.NZILA_DEPLOYMENT_TYPE) || normalize(env.DEPLOYMENT_ENVIRONMENT)
}

function isProductionLike(value: string): boolean {
  return value === 'production' || value === 'prod'
}

function secretBytes(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

function allowedUserIds(env: AcceptanceAuthEnv): Set<string> {
  return new Set(
    (env.UNION_EYES_ACCEPTANCE_AUTH_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
}

export function isAcceptanceAuthRuntimeEnabled(env: AcceptanceAuthEnv = process.env): boolean {
  if (!bool(env.UNION_EYES_ACCEPTANCE_AUTH_ENABLED)) return false
  if (!env.UNION_EYES_ACCEPTANCE_AUTH_SECRET) return false
  if (normalize(env.NODE_ENV) !== 'production') return false

  const surface = configuredSurfaceEnvironment(env)
  const deployment = deploymentEnvironment(env)
  if (isProductionLike(surface) || isProductionLike(deployment)) return false

  return surface === 'staging' && deployment === 'staging'
}

export async function mintAcceptanceAuthToken(input: {
  userId: string
  secret: string
  now?: Date
  ttlSeconds?: number
  jti?: string
}): Promise<string> {
  const now = input.now ?? new Date()
  const ttlSeconds = Math.min(input.ttlSeconds ?? ACCEPTANCE_AUTH_MAX_TTL_SECONDS, ACCEPTANCE_AUTH_MAX_TTL_SECONDS)
  const issuedAtSeconds = Math.floor(now.getTime() / 1000)
  const expiresAtSeconds = issuedAtSeconds + ttlSeconds
  const jti = input.jti ?? randomUUID()

  return new SignJWT({
    ver: ACCEPTANCE_AUTH_VERSION,
    env: 'staging',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ACCEPTANCE_AUTH_ISSUER)
    .setAudience(ACCEPTANCE_AUTH_AUDIENCE)
    .setSubject(input.userId)
    .setJti(jti)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(secretBytes(input.secret))
}

export async function verifyAcceptanceAuthToken(input: {
  token: string | null | undefined
  env?: AcceptanceAuthEnv
  now?: Date
}): Promise<{ ok: true; userId: string; jti: string } | { ok: false }> {
  const env = input.env ?? process.env
  if (!input.token || !isAcceptanceAuthRuntimeEnabled(env)) return { ok: false }

  try {
    const result = await jwtVerify<AcceptanceJwtPayload>(
      input.token,
      secretBytes(env.UNION_EYES_ACCEPTANCE_AUTH_SECRET!),
      {
        issuer: ACCEPTANCE_AUTH_ISSUER,
        audience: ACCEPTANCE_AUTH_AUDIENCE,
        currentDate: input.now,
      },
    )

    const payload = result.payload
    if (payload.ver !== ACCEPTANCE_AUTH_VERSION || payload.env !== 'staging') return { ok: false }
    if (!payload.sub || !payload.jti || typeof payload.sub !== 'string' || typeof payload.jti !== 'string') return { ok: false }
    if (!payload.iat || !payload.exp || payload.exp <= payload.iat) return { ok: false }
    if (payload.exp - payload.iat > ACCEPTANCE_AUTH_MAX_TTL_SECONDS) return { ok: false }

    const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000)
    if (payload.iat - nowSeconds > ACCEPTANCE_AUTH_MAX_FUTURE_IAT_SECONDS) return { ok: false }

    return { ok: true, userId: payload.sub, jti: payload.jti }
  } catch {
    return { ok: false }
  }
}

export async function resolveAcceptanceAuthUser(input: {
  token: string | null | undefined
  env?: AcceptanceAuthEnv
  db?: AcceptanceDb
  now?: Date
}): Promise<AcceptanceAuthUser | null> {
  const env = input.env ?? process.env
  const verified = await verifyAcceptanceAuthToken({ token: input.token, env, now: input.now })
  if (!verified.ok) return null

  if (!allowedUserIds(env).has(verified.userId)) return null

  const db = input.db ?? defaultDb
  return withAcceptanceAuthDbContext(db, verified.userId, async (scopedDb) => {
    const [authRow] = await scopedDb
      .select({
        id: authUsers.userId,
        email: authUsers.email,
        firstName: authUsers.firstName,
        lastName: authUsers.lastName,
      })
      .from(authUsers)
      .where(and(
        eq(authUsers.userId, verified.userId),
        eq(authUsers.isActive, true),
        eq(authUsers.lifecycleState, 'active'),
      ))
      .limit(1)

    if (!authRow) return null

    const [membership] = await scopedDb
      .select({ organizationId: authOrganizationUsers.organizationId })
      .from(authOrganizationUsers)
      .where(and(
        eq(authOrganizationUsers.userId, verified.userId),
        eq(authOrganizationUsers.isActive, true),
      ))
      .limit(1)

    if (!membership?.organizationId) return null

    return {
      ...authRow,
      organizationId: membership.organizationId,
      sessionId: `acceptance:${verified.jti}`,
      jti: verified.jti,
    }
  })
}
