import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import { executeQuery } from "@nzila/platform-ai-query";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  query: z.string().min(1).max(500),
  orgId: z.string().min(1).optional(),
});

/**
 * Delegates to @nzila/platform-ai-query.executeQuery — the real
 * intent-classification + execution-plan + evidence-backed answer
 * engine. orgId is required (header `x-org-id` or body field) so the
 * query log stays multi-tenant correct.
 */
export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request);
    const body: unknown = await request.json();
    const parsed = querySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid query. Provide a non-empty string (max 500 chars)." },
        { status: 400 },
      );
    }

    const orgId =
      parsed.data.orgId ?? request.headers.get("x-org-id") ?? "";
    if (!orgId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "orgId is required. Send it as `x-org-id` header or `orgId` body field — queries must be tenant-scoped.",
        },
        { status: 400 },
      );
    }

    const actor =
      request.headers.get("x-actor") ?? "control-plane-admin";

    const result = executeQuery({
      query: parsed.data.query,
      orgId,
      actor,
    });

    return NextResponse.json({
      ok: true,
      data: {
        query: parsed.data.query,
        answer: result.answer,
        confidence: result.confidence,
        intent: result.intent,
        plan: result.plan,
        evidenceRefs: result.evidenceRefs,
        queryId: result.id,
        timestamp: result.timestamp,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
