import { NextResponse } from "next/server";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import { buildArchitectureSummary } from "@/server/architecture-summary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Real architecture summary derived from the on-disk monorepo. See
 * `server/architecture-summary.ts` for the data sources. Returns 503 when
 * the workspace root is not reachable from process.cwd() — we never
 * fabricate fallback numbers.
 */
export async function GET(request: Request) {
  try {
    await requireApiAuth(request);
    const summary = buildArchitectureSummary();
    if (!summary) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Monorepo root not found from process cwd. Architecture summary requires source-tree access (pnpm-workspace.yaml).",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(summary);
  } catch (error) {
    return handleAuthError(error);
  }
}
