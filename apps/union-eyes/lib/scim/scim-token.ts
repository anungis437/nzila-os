import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { scimConfigurations } from '@/db/schema/sso-scim-schema';
import { withSystemContext } from '@/lib/db/with-rls-context';

/**
 * SCIM bearer authentication.
 *
 * The IdP is shown a token once, when it is issued or rotated. The database keeps only its SHA-256 (scim_configurations.token_hash), so
 * a copy of the table is not a credential. A request is authenticated by hashing the presented token and finding the configuration
 * that holds that hash; that configuration, never the organization named in the request path, decides which organization the request
 * acts for. A configuration that is disabled, revoked or past its expiry authenticates nothing.
 */
export const SCIM_TOKEN_PREFIX = 'scim_';
export const SCIM_DEFAULT_TOKEN_DAYS = 90;
export const SCIM_MAX_TOKEN_DAYS = 365;

export function generateScimToken(): string {
  return SCIM_TOKEN_PREFIX + randomBytes(32).toString('base64url');
}

export function hashScimToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S{20,512})$/i.exec(header.trim());
  return match ? match[1]! : null;
}

export type ScimAuthResult =
  | { ok: true; organizationId: string; configurationId: string; syncUsers: boolean }
  | { ok: false; status: 401 | 403; reason: 'missing_token' | 'invalid_token' | 'disabled' | 'expired' | 'revoked' };

export async function authenticateScimRequest(request: Request): Promise<ScimAuthResult> {
  const token = readBearerToken(request.headers.get('authorization'));
  if (!token || !token.startsWith(SCIM_TOKEN_PREFIX)) return { ok: false, status: 401, reason: 'missing_token' };
  const presented = hashScimToken(token);

  return withSystemContext(async (tx) => {
    const [config] = await tx
      .select({
        id: scimConfigurations.id,
        organizationId: scimConfigurations.organizationId,
        tokenHash: scimConfigurations.tokenHash,
        enabled: scimConfigurations.enabled,
        syncUsers: scimConfigurations.syncUsers,
        tokenExpiresAt: scimConfigurations.tokenExpiresAt,
        revokedAt: scimConfigurations.revokedAt,
      })
      .from(scimConfigurations)
      .where(eq(scimConfigurations.tokenHash, presented))
      .limit(1);

    // The lookup is by hash; the comparison below is constant-time so nothing about a near match is observable.
    const stored = config?.tokenHash ? Buffer.from(config.tokenHash, 'hex') : null;
    const given = Buffer.from(presented, 'hex');
    if (!config || !stored || stored.length !== given.length || !timingSafeEqual(stored, given)) {
      return { ok: false, status: 401, reason: 'invalid_token' } as const;
    }
    if (config.revokedAt) return { ok: false, status: 401, reason: 'revoked' } as const;
    if (config.tokenExpiresAt && config.tokenExpiresAt.getTime() <= Date.now()) return { ok: false, status: 401, reason: 'expired' } as const;
    if (!config.enabled) return { ok: false, status: 403, reason: 'disabled' } as const;

    await tx
      .update(scimConfigurations)
      .set({ tokenLastUsedAt: sql`now()` })
      .where(and(eq(scimConfigurations.id, config.id), eq(scimConfigurations.organizationId, config.organizationId)));

    return { ok: true, organizationId: config.organizationId, configurationId: config.id, syncUsers: config.syncUsers } as const;
  });
}
