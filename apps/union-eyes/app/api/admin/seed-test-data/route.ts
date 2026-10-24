/**
 * GET POST /api/admin/seed-test-data
 *
 * Retired. The seeders this route called (the former db/seeds TypeScript seeders) were empty
 * stubs that created nothing yet reported success, and the SQL replay seed they stood in for targets the
 * superseded Drizzle replay schema, not the canonical Django plus platform-migration schema. The route
 * therefore answers HTTP 501 rather than claim an organization hierarchy was seeded.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const notImplemented = () => {
  throw ApiError.notImplemented('Organization hierarchy seeding is not implemented: nothing was seeded.');
};

export const GET = withApi({ auth: { required: true, minRole: 'admin' } }, async () => notImplemented());

export const POST = withApi({ auth: { required: true, minRole: 'admin' } }, async () => notImplemented());
