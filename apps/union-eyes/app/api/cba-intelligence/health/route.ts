import { withApi } from "@/lib/api/framework";
import { getCbaIntelOperationalHealth } from "@/lib/services/cba-intelligence/health-service";

// GET /api/cba-intelligence/health — Operational SLO snapshot
export const GET = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "commercial_reporting",
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Get CBA intelligence operational health snapshot",
    },
  },
  async () => {
    return { data: await getCbaIntelOperationalHealth() };
  },
);
