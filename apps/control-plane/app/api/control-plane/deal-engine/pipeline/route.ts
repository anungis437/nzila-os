import { NextResponse } from "next/server";
import { getDeals, getPipelineSummary } from "@/server/deal-engine-data";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireApiAuth(request);
    const [deals, summary] = await Promise.all([getDeals(), getPipelineSummary()]);
    return NextResponse.json({ ok: true, data: { deals, summary } });
  } catch (error) {
    return handleAuthError(error);
  }
}
