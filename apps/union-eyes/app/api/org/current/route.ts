/**
 * GET /api/org/current
 *
 * Returns the current organization context for the authenticated user.
 * Canonical org endpoint — all new code should hit this route.
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

      // Build org payload using org-only language
      const org = {
        organizationId: orgId,
        name: null as string | null,
        slug: null as string | null,
        subscriptionTier: null as string | null,
        features: [] as string[],
      };

      return NextResponse.json({ org, availableOrgs: [org] });
    } catch (_error) {
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        "Failed to fetch organization info",
      );
    }
  },
);
