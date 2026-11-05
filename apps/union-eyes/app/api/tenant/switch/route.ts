/**
 * POST /api/tenant/switch — RETIRED
 *
 * This legacy compat wrapper confirmed that an organization exists and answered "success" without checking membership
 * or changing the session's organization. Use /api/organizations/switch.
 */

import { withApiAuth } from "@/lib/api-auth-guard";
import { retiredHandler } from "@/lib/api/retired-route";

export const dynamic = "force-dynamic";

export const POST = withApiAuth(retiredHandler("/api/organizations/switch"));
