/**
 * Commercial Contracts API
 *
 * GET  /api/contracts — List commercial contracts for the org
 * POST /api/contracts — Create a new commercial contract
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { createContractSchema } from '@/lib/contracts/contract-input';
import {
  createContract,
} from '@/services/platform-economics';
import { db } from '@/db';
import { commercialContracts, billingAccounts, orgSubscriptions } from '@/db/schema';
import { assertOrganizationOwns } from '@/lib/api/org-references';
import { eq, desc } from 'drizzle-orm';
import { classifyAcceptanceStanding } from '@/lib/pilot/counterpart-acceptance';

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
    // A contract the pilot flow accepted says what its acceptance amounts to: one activated on an administrator's statement under the earlier
    // permissive default is named as unverified here. Derived on read; nothing is rewritten.
    return {
      contracts: contracts.map((contract) =>
        (contract.metadata as { source?: string } | null)?.source === 'pilot-commercial-transition'
          ? { ...contract, acceptanceStanding: classifyAcceptanceStanding(contract) }
          : contract,
      ),
    };
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
