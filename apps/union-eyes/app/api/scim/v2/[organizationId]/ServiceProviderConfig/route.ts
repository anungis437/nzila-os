/**
 * SCIM 2.0 ServiceProviderConfig (RFC 7643 section 5): what this service supports, so an identity provider does not have to guess.
 * It states only what the Users routes do: PATCH, filtering on userName and externalId, at most 100 resources a page, and the bearer token. Bulk,
 * sorting, ETags and password changes are not supported and are declared so.
 */
import { withApi } from '@/lib/api/framework';
import { handleScim, scimJson } from '@/lib/scim/responses';
import { scimCaller } from '@/lib/scim/route-support';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { machine: scimCaller },
    openapi: { tags: ['Auth'], summary: 'SCIM service provider configuration', description: 'The features of this SCIM service.' },
  },
  async () =>
    handleScim(async () =>
      scimJson({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
        patch: { supported: true },
        bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
        filter: { supported: true, maxResults: 100 },
        changePassword: { supported: false },
        sort: { supported: false },
        etag: { supported: false },
        authenticationSchemes: [
          {
            type: 'oauthbearertoken',
            name: 'Organization SCIM bearer token',
            description: "Authentication with the organization's SCIM token. The token, not the path, decides the organization.",
            primary: true,
          },
        ],
        meta: { resourceType: 'ServiceProviderConfig' },
      }),
    ),
);
