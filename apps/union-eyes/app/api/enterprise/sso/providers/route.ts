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
import { validateSsoProviderInput } from '@/lib/sso/provider-input';
import { isUniqueViolation } from '@/lib/db/unique-violation';
import { SSO_SIGN_IN_EFFECT, withConfigurationEffect } from '@/lib/reality/configuration-effect';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    // The identity-provider configuration (issuer, endpoints, client id, attribute mapping) is an administrator's, not every member's.
    auth: { required: true, minRole: 'admin' },
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
    return providers.map(({ samlCertificate, oidcClientSecret, ...safe }) => withConfigurationEffect({
      ...safe,
      samlCertificate: samlCertificate ? true : null,
      oidcClientSecret: oidcClientSecret ? true : null,
    }, SSO_SIGN_IN_EFFECT));
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
      requireGroups,
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
      requireGroups?: string[];
    };

    if (!name || !providerType || !attributeMapping) {
      throw ApiError.badRequest('name, providerType, and attributeMapping are required');
    }

    // A provider is created disabled and without auto-provisioning unless the administrator asks otherwise, and one that is enabled
    // must be complete for its type.
    const validated = validateSsoProviderInput(body as Record<string, unknown>, enabled === true);

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
    const encryptedOidcClientSecret = validated.oidcClientSecret
      ? await encryptSecret(validated.oidcClientSecret)
      : undefined;

    // Groups the identity provider must assert before anyone signs in through it: a bounded list of short names.
    if (requireGroups !== undefined && (!Array.isArray(requireGroups) || requireGroups.length > 50 || !requireGroups.every((group) => typeof group === 'string' && group.trim().length > 0 && group.length <= 255))) {
      throw ApiError.badRequest('requireGroups must be a list of at most 50 group names');
    }

    const created = await withRLSContext(async (tx) => {
    const [row] = await tx
      .insert(ssoProviders)
      .values({
        organizationId: organizationId!,
        createdBy: userId!,
        name: validated.name,
        providerType: validated.providerType,
        samlEntityId: validated.samlEntityId,
        samlSsoUrl: validated.samlSsoUrl,
        samlCertificate: validated.samlCertificate,
        oidcIssuer: validated.oidcIssuer,
        oidcClientId: validated.oidcClientId,
        oidcClientSecret: encryptedOidcClientSecret,
        attributeMapping,
        roleMapping,
        autoProvision: autoProvision ?? false,
        requireGroups: requireGroups ? requireGroups.map((group) => group.trim()) : undefined,
        enabled: enabled ?? false,
      })
      .returning();
    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'sso.provider.create',
      resourceType: 'sso_providers',
      resourceId: row.id,
      details: { providerType, autoProvision: autoProvision ?? false, enabled: enabled ?? false, roleMapping: roleMapping ?? null, inEffect: SSO_SIGN_IN_EFFECT.inEffect },
    });
    return row;
    }).catch((error) => {
      // The unique indexes admit one provider per organization and entity id, and per organization, issuer and client.
      if (isUniqueViolation(error)) throw ApiError.conflict('This identity provider is already configured for the organization');
      throw error;
    });

    // Never echo raw credential material back to the client (same
    // redaction as GET — round 53: the create response previously
    // returned samlCertificate/oidcClientSecret in the clear).
    const { samlCertificate: _cert, oidcClientSecret: _secret, ...safe } = created;
    return withConfigurationEffect({
      ...safe,
      samlCertificate: _cert ? true : null,
      oidcClientSecret: _secret ? true : null,
    }, SSO_SIGN_IN_EFFECT);
  },
);
