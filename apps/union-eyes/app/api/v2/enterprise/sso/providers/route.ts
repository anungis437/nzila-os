/**
 * SSO Providers endpoint (v2)
 * GET /api/v2/enterprise/sso/providers — list SSO provider configs for org
 * POST /api/v2/enterprise/sso/providers — create a new SSO provider config
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { ssoProviders } from '@/db/schema/sso-scim-schema';
import { eq } from 'drizzle-orm';

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

    return providers;
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
  async ({ request, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (!userId) throw ApiError.badRequest('User context required');
    const body = await request.json();
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

    const [created] = await db
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
        oidcClientSecret,
        attributeMapping,
        roleMapping,
        autoProvision: autoProvision ?? true,
        enabled: enabled ?? true,
      })
      .returning();

    return created;
  },
);
