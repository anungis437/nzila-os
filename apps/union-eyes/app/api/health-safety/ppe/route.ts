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
  // The catalogue entry for an item (no screen posts here). Issuance (who holds it, who issued it), stock counts, status,
  // purchase cost, certification and disposal are recorded by their own processes, not the create body.
  writableFields: [
    'ppeType', 'itemName', 'description', 'manufacturer', 'model', 'size', 'serialNumber', 'itemNumber', 'storageLocation',
    'reorderLevel', 'reorderQuantity', 'expiryDate', 'inspectionRequired', 'inspectionFrequencyDays', 'maintenanceRequired',
    'notes',
  ],
});
export { GET, POST };
