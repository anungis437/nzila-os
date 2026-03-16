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
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, POST };
