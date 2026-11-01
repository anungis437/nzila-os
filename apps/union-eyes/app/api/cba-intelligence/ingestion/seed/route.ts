import { requireSystemAdmin } from "@/lib/api-auth-guard";
import { withApi, ApiError } from "@/lib/api/framework";
import { performAtomicAuditedOperation, operationAuditResponse } from "@/lib/audit/operation-audit";
import { seedSources } from "@/lib/services/cba-intelligence/seed-sources";

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/ingestion/seed — Seed source registry
// ---------------------------------------------------------------------------

export const POST = withApi(
  {
    auth: { minRole: "admin" },
    entitlement: "commercial_reporting",
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Seed the 17 real Canadian CBA data sources into the registry",
    },
  },
  async ({ userId, organizationId }) => {
    // The dataset is platform-wide (no organization column): changing it is platform authority, not an organization administrator's.
    await requireSystemAdmin();
    // The whole registry seed and its audit record commit in one transaction: a source that cannot be inserted, or an audit record
    // that cannot be written, leaves the registry as it was.
    try {
      return await performAtomicAuditedOperation(
        {
          organizationId,
          userId,
          scope: "system",
          action: "cba_intel.sources.seed",
          resourceType: "cba_intel_sources",
          resultDetails: (result) => ({ created: result.created, skipped: result.skipped }),
        },
        () => seedSources({ failFast: true }),
      );
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) throw ApiError.conflict(refused.body.error.message);
      throw error;
    }
  },
);
