import { NextResponse, type NextRequest } from "next/server";
import { getAnomalyById } from "@/server/data";
import { requireApiAuth, handleAuthError, parseUuidParam } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAuth(request);
    const { id: rawId } = await params;
    const id = parseUuidParam(rawId, "id");
    const anomaly = await getAnomalyById(id);

    if (!anomaly) {
      return NextResponse.json(
        { ok: false, error: "Anomaly not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: anomaly });
  } catch (error) {
    return handleAuthError(error);
  }
}
