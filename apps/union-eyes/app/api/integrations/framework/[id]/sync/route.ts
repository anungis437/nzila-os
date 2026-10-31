import { withApi, ApiError, z } from '@/lib/api/framework';
import { operationAuditResponse } from '@/lib/audit/operation-audit';
import { initiateTenantIntegrationSync } from '@/lib/integrations/control-plane';
import { SyncType } from '@/lib/integrations/types';

export const dynamic = 'force-dynamic';

const syncSchema = z.object({
  syncType: z.nativeEnum(SyncType).default(SyncType.INCREMENTAL),
  entities: z.array(z.string().min(1).max(100)).max(20).optional(),
  // No sync engine or adapter performs a dry run, so a request for one is refused instead of running a real sync that was audited as a dry run.
  dryRun: z.literal(false).optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: syncSchema,
    registry: {
      audience: 'steward',
      productionStatus: 'active',
      evidenceRequired: true,
      orgScoping: 'caller-org',
    },
  },
  async ({ body, organizationId, userId, params }) => {
    // The sync runs before its outcome record is written, so a record that could not be written is reported, not hidden.
    const auditOutcome = { recorded: true };
    try {
      const result = await initiateTenantIntegrationSync(organizationId!, userId!, {
          integrationId: params.id,
          syncType: body.syncType,
          entities: body.entities,
          dryRun: body.dryRun,
          limit: body.limit,
          auditOutcome,
        });
      return { result, auditOutcomeRecorded: auditOutcome.recorded };
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) throw ApiError.conflict(refused.body.error.message);
      throw error;
    }
  },
);
