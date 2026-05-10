/**
 * GET /api/tenant/current — DEPRECATED
 *
 * Legacy compat wrapper. All new code should use /api/org/current instead.
 * Response still uses org-only language.
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, BaseAuthContext } from "@/lib/api-auth-guard";
import { resolveOrgIdFromContext } from "@/lib/org-id-from-context";
import {
  ErrorCode,
  standardErrorResponse,
} from "@/lib/api/standardized-responses";

export const dynamic = "force-dynamic";

export const GET = withApiAuth(
  async (_request: NextRequest, context: BaseAuthContext) => {
    try {
      const userId = context.userId;
      if (!userId) {
        return standardErrorResponse(
          ErrorCode.AUTH_REQUIRED,
          "Authentication required",
        );
      }
      // R9: helper enforces app-org UUID shape; rejects Entra group GUIDs.
      const orgId = await resolveOrgIdFromContext(context, userId);

      if (!orgId) {
        return standardErrorResponse(
          ErrorCode.NOT_FOUND,
          "No organization found for current user",
        );
      }

      const org = {
        organizationId: orgId,
        name: null as string | null,
        slug: null as string | null,
        subscriptionTier: null as string | null,
        features: [] as string[],
      };

      const response = NextResponse.json({ org, availableOrgs: [org] });
      response.headers.set("X-Deprecated", "true; use /api/org/current");
      return response;
    } catch (_error) {
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        "Failed to fetch organization info",
      );
    }
  },
);
