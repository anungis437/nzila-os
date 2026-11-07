/**
 * GET /api/admin/users
 * Lists memberships, with optional search by name or e-mail, for a platform administrator acting on organizations they administer.
 *
 * A membership (a person's name, role, status and organization) is that organization's content. Platform-staff authority (see
 * lib/platform/platform-staff.ts) is required to use the console, but it is not authority over any organization's people (issue #1116):
 * the directory is bounded to the organizations where the caller holds a live, direct administrative membership, the same authority the
 * membership actions in ./[userId] require. Every other organization's people are not read; asking for one by id answers not found.
 * Cross-organization grants are not built. A platform account-support view across organizations would need its own approved capability.
 *
 * It runs under the system role with its audit record in the same transaction, and returns the least the console needs: an e-mail
 * address is masked (lib/platform/user-directory.ts).
 */
import { ApiError, withApi } from '@/lib/api/framework';
import { performAtomicPlatformRead } from '@/lib/audit/audited-platform-read';
import { requirePlatformStaffAuthority } from '@/lib/platform/platform-staff';
import { DIRECTORY_PAGE_LIMIT, MIN_SEARCH_LENGTH, listPlatformUsers, normalizeSearch } from '@/lib/platform/user-directory';
import { isAdministrativeRole, resolveOrganizationAccess } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async (ctx) => {
    const actor = await requirePlatformStaffAuthority(ctx, 'platform.user_directory.read');
    const url = new URL(ctx.request.url);
    const { term, tooShort } = normalizeSearch(url.searchParams.get('search'));
    if (tooShort) throw ApiError.badRequest(`A search needs at least ${MIN_SEARCH_LENGTH} characters`);
    const organizationId = url.searchParams.get('organizationId');
    if (organizationId !== null && !UUID.test(organizationId)) throw ApiError.badRequest('organizationId must be an organization id');

    // Direct, specific authority only: the organizations this caller administers through their own live membership.
    const access = await resolveOrganizationAccess(actor.userId);
    const administered = [...access.direct].filter(([, role]) => isAdministrativeRole(role)).map(([id]) => id);
    if (organizationId !== null && !administered.includes(organizationId)) throw ApiError.notFound('Organization');
    if (administered.length === 0) return [];

    return performAtomicPlatformRead(
      actor,
      {
        action: 'platform.user_directory.read',
        resourceType: 'organization_members',
        details: {
          searched: term.length > 0,
          scopedToOrganization: organizationId !== null,
          administeredOrganizations: administered.length,
          limit: DIRECTORY_PAGE_LIMIT,
        },
        resultDetails: (rows: unknown[]) => ({ returned: rows.length }),
      },
      (tx) => listPlatformUsers(tx, { search: term, organizationId, organizationIds: administered }),
    );
  },
);