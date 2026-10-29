/**
 * CRUD collection route for dataClassificationPolicy — platform-wide
 * Employer Data Firewall classification doctrine.
 *
 * This is NOT a privacy-incident, data-subject-request or jurisdictional-case
 * workflow. Those capabilities were previously (mis)bound to this table via
 * /api/privacy/{breach,dsar,provincial}; those routes now return 501.
 *
 * data_classification_policy has no organizationId column, so `orgScoped` is a
 * no-op here. writeRole is a PLATFORM_ELEVATED_ROLES role so an ordinary org
 * 'admin' cannot mutate platform-wide compliance doctrine.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { dataClassificationPolicy } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: dataClassificationPolicy,
  pk: 'id',
  tags: ["Compliance"],
  orgScoped: true,
  unscopedByDesign: 'global classification policy with no organization discriminator; read-only through the generic interface (CRUD governance READ_ONLY)',
  readRole: 'member',
  writeRole: 'compliance_manager',
});
export { GET, POST };
