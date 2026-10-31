import { requireSystemAdmin } from "@/lib/api-auth-guard";
import { withApi, ApiError } from "@/lib/api/framework";
import { performAuditedOperation, operationAuditResponse } from "@/lib/audit/operation-audit";
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
    // Seeding inserts the registry one source at a time, so it cannot share one transaction: its intent is recorded
    // first and nothing is seeded if that record cannot be written.
    try {
      return await performAuditedOperation(
        { organizationId, userId, action: "cba_intel.sources.seed", resourceType: "cba_intel_sources" },
        () => seedSources(),
      );
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) throw ApiError.conflict(refused.body.error.message);
      throw error;
    }
  },
);
