/**
 * An organization's movement-insights consent record, read in the organization's own context.
 *
 * data_aggregation_consent is tenant-scoped (one row per organization). The pages read it through the module-level handle with no organization
 * set, so the runtime role saw no row and every organization looked as if it had never consented. Here the read runs in
 * withRLSContext({ organizationId }); a failure is thrown to the page and is not rendered as "no consent".
 */
import { eq } from 'drizzle-orm';
import { dataAggregationConsent } from '@/db/schema/domains/marketing';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isUuid } from '@/lib/page-data/uuid';

export interface OrganizationConsent {
  consentGiven: boolean;
  consentDate: Date;
  categories: Array<(typeof dataAggregationConsent.$inferSelect)['categories'][number]>;
  expiresAt: Date | null;
}

/** The organization's stored consent row, or null when it has none (or no tenant organization to have one: a platform administrator who belongs to none). A stored row with consentGiven false records no consent and is returned as it is. */
export function readOrganizationConsent(organizationId: string): Promise<OrganizationConsent | null> {
  if (!isUuid(organizationId)) return Promise.resolve(null);
  return withRLSContext({ organizationId }, async (tx) => {
    const [consent] = await tx
      .select({
        consentGiven: dataAggregationConsent.consentGiven,
        consentDate: dataAggregationConsent.consentDate,
        categories: dataAggregationConsent.categories,
        expiresAt: dataAggregationConsent.expiresAt,
      })
      .from(dataAggregationConsent)
      .where(eq(dataAggregationConsent.organizationId, organizationId))
      .limit(1);
    return consent ?? null;
  });
}
