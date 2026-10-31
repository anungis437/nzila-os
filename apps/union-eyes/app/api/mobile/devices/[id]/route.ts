/**
 * GET PATCH DELETE /api/mobile/devices/[id]
 *
 * A member's own registered push device: read it, change its preferences, or remove it. The registration route had no item
 * route, so a device or token could never be disabled or removed by its owner. Rows are limited to the caller's own profile,
 * the push token is never returned, and the token itself cannot be edited here (a new token is a new registration).
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pushDevices } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: pushDevices,
  pk: 'id',
  tags: ['Auth'],
  orgScoped: true,
  itemRoute: true,
  ownerColumn: 'profileId',
  readRole: 'member',
  writeRole: 'member',
  ownerMayDelete: true,
  writableFields: ['enabled', 'quietHoursStart', 'quietHoursEnd', 'timezone', 'deviceName', 'appVersion', 'osVersion'],
  omitFromResponse: ['deviceToken'],
});
export { GET, PATCH, DELETE };
