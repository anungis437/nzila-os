/**
 * SSO Providers endpoint
 * GET /api/enterprise/sso/providers — list SSO provider configs for org
 * POST /api/enterprise/sso/providers — create a new SSO provider config
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { ssoProviders } from '@/db/schema/sso-scim-schema';
import { eq } from 'drizzle-orm';
import { encryptSecret } from '@/lib/encryption';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { AUTH_TENANT_ASSIGNABLE_ROLES } from '@nzila/db/auth-storage-authority';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Auth'],
      summary: 'List SSO providers',
      description: 'Returns all SSO provider configurations for the organization.',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const providers = await db
      .select()
      .from(ssoProviders)
      .where(eq(ssoProviders.organizationId, organizationId));

    // Never echo raw credential material back to the client.
    return providers.map(({ samlCertificate, oidcClientSecret, ...safe }) => ({
      ...safe,
      samlCertificate: samlCertificate ? true : null,
      oidcClientSecret: oidcClientSecret ? true : null,
    }));
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Auth'],
      summary: 'Create SSO provider',
      description: 'Creates a new SSO provider configuration.',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (!userId) throw ApiError.badRequest('User context required');
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw ApiError.badRequest('Request body must be a JSON object');
    }
    const {
      name,
      providerType,
      samlEntityId,
      samlSsoUrl,
      samlCertificate,
      oidcIssuer,
      oidcClientId,
      oidcClientSecret,
      attributeMapping,
      roleMapping,
      autoProvision,
      enabled,
    } = body as {
      name: string;
      providerType: string;
      samlEntityId?: string;
      samlSsoUrl?: string;
      samlCertificate?: string;
      oidcIssuer?: string;
      oidcClientId?: string;
      oidcClientSecret?: string;
      attributeMapping: Record<string, string>;
      roleMapping?: Record<string, string>;
      autoProvision?: boolean;
      enabled?: boolean;
    };

    if (!name || !providerType || !attributeMapping) {
      throw ApiError.badRequest('name, providerType, and attributeMapping are required');
    }

    // An identity provider may only map its groups to roles a tenant administrator can already assign; a mapping to a
    // platform or federation role would otherwise let an external directory mint authority the tenant cannot grant.
    const assignable: readonly string[] = AUTH_TENANT_ASSIGNABLE_ROLES;
    if (roleMapping !== undefined) {
      if (!roleMapping || typeof roleMapping !== 'object' || Array.isArray(roleMapping)) {
        throw ApiError.badRequest('roleMapping must be an object of group to role');
      }
      for (const role of Object.values(roleMapping)) {
        if (typeof role !== 'string' || !assignable.includes(role)) {
          throw ApiError.badRequest(`roleMapping may only assign: ${assignable.join(', ')}`);
        }
      }
    }

    // SECURITY (Round 59B): oidcClientSecret must never be persisted in
    // plaintext — the schema column's "// Encrypted" comment previously
    // did not match reality (no encrypt/decrypt call existed anywhere for
    // this field). Reuses the existing Key-Vault-backed encryption
    // service (lib/encryption.ts, already used for SIN encryption) rather
    // than inventing new cryptography.
    const encryptedOidcClientSecret = oidcClientSecret
      ? await encryptSecret(oidcClientSecret)
      : oidcClientSecret;

    const created = await withRLSContext(async (tx) => {
    const [row] = await tx
      .insert(ssoProviders)
      .values({
        organizationId: organizationId!,
        createdBy: userId!,
        name,
        providerType,
        samlEntityId,
        samlSsoUrl,
        samlCertificate,
        oidcIssuer,
        oidcClientId,
        oidcClientSecret: encryptedOidcClientSecret,
        attributeMapping,
        roleMapping,
        autoProvision: autoProvision ?? true,
        enabled: enabled ?? true,
      })
      .returning();
    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'sso.provider.create',
      resourceType: 'sso_providers',
      resourceId: row.id,
      details: { providerType, autoProvision: autoProvision ?? true, enabled: enabled ?? true, roleMapping: roleMapping ?? null },
    });
    return row;
    });

    // Never echo raw credential material back to the client (same
    // redaction as GET — round 53: the create response previously
    // returned samlCertificate/oidcClientSecret in the clear).
    const { samlCertificate: _cert, oidcClientSecret: _secret, ...safe } = created;
    return {
      ...safe,
      samlCertificate: _cert ? true : null,
      oidcClientSecret: _secret ? true : null,
    };
  },
);
