import { withApi } from "@/lib/api/framework";
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
  async () => {
    return seedSources();
  },
);
