/**
 * GET /api/admin/users
 * Lists platform users, with optional search by name or e-mail, for platform administrators.
 *
 * This reads every organization's members, so it is authorized by platform-staff authority (see lib/platform/platform-staff.ts), never by a
 * role title, and runs under the system role with its audit record in the same transaction. It returns the least the console needs: an
 * e-mail address is masked (lib/platform/user-directory.ts).
 */
import { ApiError, withApi } from '@/lib/api/framework';
import { performAtomicPlatformRead } from '@/lib/audit/audited-platform-read';
import { requirePlatformStaffAuthority } from '@/lib/platform/platform-staff';
import { DIRECTORY_PAGE_LIMIT, MIN_SEARCH_LENGTH, listPlatformUsers, normalizeSearch } from '@/lib/platform/user-directory';

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

    return performAtomicPlatformRead(
      actor,
      {
        action: 'platform.user_directory.read',
        resourceType: 'organization_members',
        details: { searched: term.length > 0, scopedToOrganization: organizationId !== null, limit: DIRECTORY_PAGE_LIMIT },
        resultDetails: (rows: unknown[]) => ({ returned: rows.length }),
      },
      (tx) => listPlatformUsers(tx, { search: term, organizationId }),
    );
  },
);