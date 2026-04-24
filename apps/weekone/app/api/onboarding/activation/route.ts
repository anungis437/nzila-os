import { NextRequest, NextResponse } from "next/server";
import { auth } from "@nzila/platform-auth/entra/server";
import { z } from "zod";

const activationSchema = z.object({
  action: z.enum(["complete", "skip"]),
  step: z.string().default("tool_connect"),
  data: z
    .object({
      companyType: z.string().optional(),
      revenueStage: z.string().optional(),
      teamSize: z.string().optional(),
      mainPain: z.string().optional(),
    })
    .optional(),
  timestamp: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as unknown;
    const parsed = activationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = {
      userId,
      action: parsed.data.action,
      step: parsed.data.step,
      timestamp: parsed.data.timestamp ?? new Date().toISOString(),
      hasProfileData: Boolean(
        parsed.data.data?.companyType ||
          parsed.data.data?.revenueStage ||
          parsed.data.data?.teamSize ||
          parsed.data.data?.mainPain,
      ),
    };

    console.info("[weekone.activation]", payload);

    return NextResponse.json({ ok: true, data: payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
