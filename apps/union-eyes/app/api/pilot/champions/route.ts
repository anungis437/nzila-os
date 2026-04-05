import { NextRequest, NextResponse } from "next/server";
import { detectChampions } from "@/lib/services/pilot-signals";

/**
 * GET /api/pilot/champions?organizationId=...
 *
 * Returns potential champion users within the org.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId");
    if (!orgId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    const champions = await detectChampions(orgId);
    return NextResponse.json({ champions });
  } catch (error) {
    console.error("[pilot/champions] Error:", error);
    return NextResponse.json({ error: "Failed to detect champions" }, { status: 500 });
  }
}
