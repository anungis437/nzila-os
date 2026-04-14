import { NextResponse } from "next/server";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/control-plane/integrations
 * List all integration connections with summary stats.
 */
export async function GET(request: Request) {
  try {
    await requireApiAuth(request);

    // Placeholder: return empty list until stores are wired
    const data = {
      connections: [],
      summary: { total: 0, active: 0, error: 0, pending: 0 },
    };

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return handleAuthError(error);
  }
}
