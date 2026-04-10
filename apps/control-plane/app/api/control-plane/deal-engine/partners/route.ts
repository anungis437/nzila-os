import { NextResponse } from "next/server";
import { getReferrals, getPartnerStats } from "@/server/deal-engine-data";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireApiAuth(request);
    const [referrals, stats] = await Promise.all([getReferrals(), getPartnerStats()]);
    return NextResponse.json({ ok: true, data: { referrals, stats } });
  } catch (error) {
    return handleAuthError(error);
  }
}
