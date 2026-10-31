/**
 * SSO provider lifecycle
 * PATCH  /api/enterprise/sso/providers/[id] — change, enable, disable or rotate the client secret of a provider
 * DELETE /api/enterprise/sso/providers/[id] — remove a provider
 *
 * A mistaken or compromised identity-provider configuration can be corrected here instead of by direct database access. Every change
 * is audited in the same transaction, names the fields it changed and never carries a credential value. A provider that ends up
 * enabled must be complete for its type, and a role mapping may only assign roles a tenant administrator can already assign.
 */
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { ssoProviders } from '@/db/schema/sso-scim-schema';
import { encryptSecret } from '@/lib/encryption';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { AUTH_TENANT_ASSIGNABLE_ROLES } from '@nzila/db/auth-storage-authority';
import { validateSsoProviderInput } from '@/lib/sso/provider-input';
import { isUniqueViolation } from '@/lib/db/unique-violation';
import { SSO_SIGN_IN_EFFECT, withConfigurationEffect } from '@/lib/reality/configuration-effect';

export const dynamic = 'force-dynamic';

const PATCHABLE = ['name', 'enabled', 'autoProvision', 'requireGroups', 'roleMapping', 'samlEntityId', 'samlSsoUrl', 'samlCertificate', 'oidcIssuer', 'oidcClientId', 'oidcClientSecret'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Auth'],
      summary: 'Update, enable, disable or rotate the secret of an SSO provider',
      description: 'Changes the named fields of one provider of the organization and records the change.',
    },
  },
  async ({ body, params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    if (!UUID.test(params.id)) throw ApiError.notFound('SSO provider');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw ApiError.badRequest('Request body must be a JSON object');
    const patch = body as Record<string, unknown>;
    const unknown = Object.keys(patch).filter((key) => !(PATCHABLE as readonly string[]).includes(key));
    if (unknown.length > 0) throw ApiError.badRequest(`These fields cannot be changed: ${unknown.join(', ')}`);
    if (Object.keys(patch).length === 0) throw ApiError.badRequest('Nothing to change');
    for (const key of ['enabled', 'autoProvision'] as const) {
      if (patch[key] !== undefined && typeof patch[key] !== 'boolean') throw ApiError.badRequest(`${key} must be true or false`);
    }
    const assignable: readonly string[] = AUTH_TENANT_ASSIGNABLE_ROLES;
    if (patch.roleMapping !== undefined && patch.roleMapping !== null) {
      if (typeof patch.roleMapping !== 'object' || Array.isArray(patch.roleMapping)) throw ApiError.badRequest('roleMapping must be an object of group to role');
      for (const role of Object.values(patch.roleMapping as Record<string, unknown>)) {
        if (typeof role !== 'string' || !assignable.includes(role)) throw ApiError.badRequest(`roleMapping may only assign: ${assignable.join(', ')}`);
      }
    }
    const groups = patch.requireGroups;
    if (groups !== undefined && (!Array.isArray(groups) || groups.length > 50 || !groups.every((g) => typeof g === 'string' && g.trim().length > 0 && g.length <= 255))) {
      throw ApiError.badRequest('requireGroups must be a list of at most 50 group names');
    }

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [existing] = await tx
        .select()
        .from(ssoProviders)
        .where(and(eq(ssoProviders.id, params.id), eq(ssoProviders.organizationId, organizationId)))
        .limit(1);
      if (!existing) throw ApiError.notFound('SSO provider');

      const willBeEnabled = typeof patch.enabled === 'boolean' ? patch.enabled : existing.enabled === true;
      // The merged configuration, not just the patch, has to be complete for its type before it can be enabled.
      const merged = {
        name: patch.name ?? existing.name,
        providerType: existing.providerType,
        samlEntityId: patch.samlEntityId ?? existing.samlEntityId,
        samlSsoUrl: patch.samlSsoUrl ?? existing.samlSsoUrl,
        samlCertificate: patch.samlCertificate ?? existing.samlCertificate,
        oidcIssuer: patch.oidcIssuer ?? existing.oidcIssuer,
        oidcClientId: patch.oidcClientId ?? existing.oidcClientId,
        oidcClientSecret: patch.oidcClientSecret,
      };
      const validated = validateSsoProviderInput(merged, willBeEnabled);
      if (willBeEnabled && existing.providerType === 'oidc' && !existing.oidcClientSecret && !validated.oidcClientSecret) {
        throw ApiError.badRequest('oidcClientSecret is required to enable this provider');
      }

      const set: Record<string, unknown> = { updatedAt: new Date() };
      const changed: string[] = [];
      const assign = (key: string, value: unknown) => {
        set[key] = value;
        changed.push(key);
      };
      if (patch.name !== undefined) assign('name', validated.name);
      if (patch.enabled !== undefined) assign('enabled', patch.enabled);
      if (patch.autoProvision !== undefined) assign('autoProvision', patch.autoProvision);
      if (groups !== undefined) assign('requireGroups', (groups as string[]).map((g) => g.trim()));
      if (patch.roleMapping !== undefined) assign('roleMapping', patch.roleMapping);
      if (patch.samlEntityId !== undefined) assign('samlEntityId', validated.samlEntityId);
      if (patch.samlSsoUrl !== undefined) assign('samlSsoUrl', validated.samlSsoUrl);
      if (patch.samlCertificate !== undefined) assign('samlCertificate', validated.samlCertificate);
      if (patch.oidcIssuer !== undefined) assign('oidcIssuer', validated.oidcIssuer);
      if (patch.oidcClientId !== undefined) assign('oidcClientId', validated.oidcClientId);
      if (validated.oidcClientSecret) assign('oidcClientSecret', await encryptSecret(validated.oidcClientSecret));

      let updated: { id: string; enabled: boolean | null };
      try {
        [updated] = await tx
          .update(ssoProviders)
          .set(set)
          .where(and(eq(ssoProviders.id, params.id), eq(ssoProviders.organizationId, organizationId)))
          .returning({ id: ssoProviders.id, enabled: ssoProviders.enabled });
      } catch (error) {
        if (isUniqueViolation(error)) throw ApiError.conflict('This identity provider is already configured for the organization');
        throw error;
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: changed.includes('oidcClientSecret') ? 'sso.provider.rotate_secret' : 'sso.provider.update',
        resourceType: 'sso_providers',
        resourceId: params.id,
        details: { fields: changed, enabled: updated.enabled === true, inEffect: SSO_SIGN_IN_EFFECT.inEffect },
      });
      return withConfigurationEffect({ id: updated.id, enabled: updated.enabled === true, changed }, SSO_SIGN_IN_EFFECT);
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Auth'],
      summary: 'Remove an SSO provider',
      description: 'Deletes one provider of the organization and records the removal.',
    },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    if (!UUID.test(params.id)) throw ApiError.notFound('SSO provider');

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [removed] = await tx
        .delete(ssoProviders)
        .where(and(eq(ssoProviders.id, params.id), eq(ssoProviders.organizationId, organizationId)))
        .returning({ id: ssoProviders.id, name: ssoProviders.name, providerType: ssoProviders.providerType, enabled: ssoProviders.enabled });
      if (!removed) throw ApiError.notFound('SSO provider');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'sso.provider.delete',
        resourceType: 'sso_providers',
        resourceId: removed.id,
        details: { name: removed.name, providerType: removed.providerType, wasEnabled: removed.enabled === true },
      });
      return withConfigurationEffect({ id: removed.id, deleted: true }, SSO_SIGN_IN_EFFECT);
    });
  },
);
