import { NextResponse } from "next/server";
import { auth } from "@/lib/api-auth-guard";
import { findProfileByUserId } from "@/db/queries/profiles-queries";

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

    // A failed lookup is an error; only a completed lookup that found nothing says there is no profile.
    const profile = await findProfileByUserId(userId);
    return NextResponse.json({
      isSuccess: true,
      message: profile ? "Profile retrieved successfully" : "No profile exists for this user",
      data: profile,
    });
  } catch {
    return NextResponse.json(
      { isSuccess: false, message: "Failed to get profile" },
      { status: 500 }
    );
  }
}
