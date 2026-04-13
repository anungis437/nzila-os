import { NextResponse } from "next/server";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/control-plane/integrations/dead-letters
 * List dead letter records for review/replay.
 */
export async function GET(request: Request) {
  try {
    await requireApiAuth(request);

    // Placeholder: return empty list until stores are wired
    const data = {
      deadLetters: [],
      summary: { total: 0, unresolved: 0, replayed: 0 },
    };

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * POST /api/control-plane/integrations/dead-letters
 * Replay a dead letter by ID.
 */
export async function POST(request: Request) {
  try {
    await requireApiAuth(request);

    const body = await request.json();
    const { deadLetterId } = body as { deadLetterId?: string };

    if (!deadLetterId) {
      return NextResponse.json({ ok: false, error: "deadLetterId is required" }, { status: 400 });
    }

    // Placeholder: replay logic will be wired to WebhookEngine.replay()
    return NextResponse.json({ ok: true, data: { replayed: false, message: "Replay not yet wired." } });
  } catch (error) {
    return handleAuthError(error);
  }
}
