import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth-guard";
import { getProfileByUserId } from "@/db/queries/profiles-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { isSuccess: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const profile = await getProfileByUserId(userId);
    return NextResponse.json({
      isSuccess: true,
      message: "Profile retrieved successfully",
      data: profile,
    });
  } catch {
    return NextResponse.json(
      { isSuccess: false, message: "Failed to get profile" },
      { status: 500 }
    );
  }
}
