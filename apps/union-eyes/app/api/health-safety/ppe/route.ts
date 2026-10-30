/**
 * CRUD collection route for ppeEquipment
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ppeEquipment } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: ppeEquipment,
  tags: ["Health-safety"],
  orgScoped: true,
  // The issuance columns name the member who holds each item.
  readRole: 'health_safety_rep',
  writeRole: 'admin',
});
export { GET, POST };
