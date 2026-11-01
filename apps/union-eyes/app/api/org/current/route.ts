/**
 * GET /api/org/current
 *
 * Returns the current organization context for the authenticated user, read from the organization itself: its name, slug,
 * subscription tier and enabled features. Canonical org endpoint — all new code should hit this route.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withApiAuth, BaseAuthContext } from "@/lib/api-auth-guard";
import { resolveOrgIdFromContext } from "@/lib/org-id-from-context";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { organizations } from "@/db/schema-organizations";
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

      const [row] = await withRLSContext({ organizationId: orgId }, (tx) =>
        tx
          .select({
            name: organizations.name,
            slug: organizations.slug,
            subscriptionTier: organizations.subscriptionTier,
            featuresEnabled: organizations.featuresEnabled,
          })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1),
      );

      // A context that names an organization with no row is not an organization with empty details: it does not exist.
      if (!row) {
        return standardErrorResponse(ErrorCode.NOT_FOUND, "Organization not found");
      }

      const org = {
        organizationId: orgId,
        name: row.name,
        slug: row.slug,
        subscriptionTier: row.subscriptionTier ?? null,
        features: Array.isArray(row.featuresEnabled) ? (row.featuresEnabled as string[]) : [],
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
