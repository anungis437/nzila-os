/**
 * POST /api/org/switch
 *
 * Retired: this route confirmed that an organization exists and answered "success" without checking that the caller
 * belongs to it and without changing which organization the session acts in. The switch that does that, and checks
 * membership, is /api/organizations/switch.
 */

import { withApiAuth } from "@/lib/api-auth-guard";
import { retiredHandler } from "@/lib/api/retired-route";

export const dynamic = "force-dynamic";

export const POST = withApiAuth(retiredHandler("/api/organizations/switch"));
