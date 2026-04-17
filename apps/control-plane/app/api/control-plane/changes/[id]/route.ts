import { NextResponse } from "next/server";
import { getChangeRecordById } from "@/server/change-data";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth(request);
    const { id } = await params;
    const data = await getChangeRecordById(id);
    if (!data) {
      return NextResponse.json(
        { ok: false, error: `Change record ${id} not found` },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return handleAuthError(error);
  }
}
