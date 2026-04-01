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
import { commercialContracts } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

const createContractSchema = z.object({
  billingAccountId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
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
    auth: { minRole: 'member' },
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
    const result = await createContract({
      ...body,
      organizationId,
      createdBy: userId ?? undefined,
    });
    return result;
  },
);
