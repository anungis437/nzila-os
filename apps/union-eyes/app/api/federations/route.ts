/**
 * GET /api/federations — the federation register, read only.
 *
 * The CRUD governance table classifies federations READ_ONLY, so a POST was configured here and always answered 403. The register is
 * maintained by the platform, not through this route; the route now exposes only the read, and a write is a 405.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { federations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET } = crudRoutes({
  table: federations,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
});
export { GET };
