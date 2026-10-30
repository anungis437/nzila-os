/**
 * Commercial Contracts API
 *
 * GET  /api/contracts — List commercial contracts for the org
 * POST /api/contracts — Create a new commercial contract
 */

import { withApi, ApiError, z } from '@/lib/api/framework';
import {
  createContract,
} from '@/services/platform-economics';
import { db } from '@/db';
import { commercialContracts, billingAccounts, orgSubscriptions } from '@/db/schema';
import { assertOrganizationOwns } from '@/lib/api/org-references';
import { eq, desc } from 'drizzle-orm';

const createContractSchema = z.object({
  billingAccountId: z.guid(),
  subscriptionId: z.guid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date(),
  autoRenew: z.boolean().optional(),
  renewalTermMonths: z.number().int().positive().optional(),
  terminationNoticeDays: z.number().int().nonnegative().optional(),
  totalContractValue: z.string().optional(),
  lineItems: z.array(z.object({
    lineType: z.enum(['module_license', 'feature_access', 'usage_quota', 'seat_allocation', 'support_level', 'sla_commitment', 'custom']),
    featureKey: z.string(),
    description: z.string(),
    quantity: z.number().int().positive().optional(),
    unitPrice: z.string().optional(),
    totalPrice: z.string().optional(),
    usageLimit: z.number().int().nonnegative().optional(),
    usagePeriod: z.string().optional(),
    slaTarget: z.string().optional(),
    effectiveDate: z.coerce.date(),
    expirationDate: z.coerce.date().optional(),
  })).optional(),
});

export const GET = withApi(
  {
    // Contract value, term and renewal conditions are the organization's commercial position: an officer reads them.
    auth: { minRole: 'officer' },
    entitlement: 'commercial_reporting',
    openapi: {
      tags: ['Contracts'],
      summary: 'List commercial contracts for the organization',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const contracts = await db
      .select()
      .from(commercialContracts)
      .where(eq(commercialContracts.organizationId, organizationId))
      .orderBy(desc(commercialContracts.createdAt));
    return { contracts };
  },
);

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'commercial_reporting',
    body: createContractSchema,
    openapi: {
      tags: ['Contracts'],
      summary: 'Create a new commercial contract',
    },
    successStatus: 201,
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    // The billing account and the subscription must be the caller's organization's: a contract provisions entitlements from its lines.
    await assertOrganizationOwns([
      { field: 'billingAccountId', value: body.billingAccountId, table: billingAccounts },
      { field: 'subscriptionId', value: body.subscriptionId, table: orgSubscriptions },
    ], organizationId);
    const result = await createContract({
      ...body,
      organizationId,
      createdBy: userId ?? undefined,
    });
    return result;
  },
);
