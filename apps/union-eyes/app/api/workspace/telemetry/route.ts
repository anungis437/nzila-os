import { NextResponse } from "next/server";
import { withRoleAuth } from "@/lib/api-auth-guard";
import { logger } from "@/lib/logger";
import {
  WORKSPACE_ID,
  WORKSPACE_CLIENT_TELEMETRY_EVENTS,
  WORKSPACE_TELEMETRY_PAYLOAD_KEYS,
  isAllowedTelemetryRoute,
  type WorkspaceClientTelemetryEvent,
} from "@/components/workspace/workspace-config";

/**
 * POST /api/workspace/telemetry
 *
 * Records a workspace telemetry event. Telemetry exists ONLY to validate
 * workspace usefulness and legacy-route subordination (Club360 pattern).
 *
 * Privacy guarantees (see docs/workspace/UNION_EYES_TELEMETRY_SCHEMA.md):
 *  - Only CLIENT-emittable event names are accepted. The derived-only
 *    `absorbed_by_workspace` event is rejected here — it must be computed
 *    server-side / analytically, never self-reported by the client.
 *  - Payloads are stripped to an allow-list of keys (workspace, tab, route,
 *    timestamp). Any other field (member ids, case ids, grievance details,
 *    productivity data, behavior profiles) is dropped before recording.
 *  - `route` must be a known static route with no UUID/numeric/hex id segments;
 *    dynamic / instance routes are dropped so identifiers cannot leak.
 *  - No new database table is introduced; events are logged PII-free.
 */

const ALLOWED_EVENTS = new Set<string>(WORKSPACE_CLIENT_TELEMETRY_EVENTS);
const ALLOWED_PAYLOAD_KEYS = new Set<string>(WORKSPACE_TELEMETRY_PAYLOAD_KEYS);

function sanitizePayload(input: unknown): Record<string, string> {
  const safe: Record<string, string> = {};
  if (!input || typeof input !== "object") return safe;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!ALLOWED_PAYLOAD_KEYS.has(key)) continue; // drop non-allow-listed keys
    if (typeof value !== "string") continue; // only simple string scalars
    if (key === "route") {
      // Reject dynamic / instance routes; only known static routes survive.
      if (isAllowedTelemetryRoute(value)) {
        safe[key] = value.split("?")[0];
      }
      continue;
    }
    safe[key] = value;
  }

  // Workspace identifier is always canonical.
  safe.workspace = WORKSPACE_ID;
  return safe;
}

export const POST = withRoleAuth("member", async (req) => {
  try {
    const body = await req.json();
    const event = body?.event as string | undefined;

    if (!event || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json(
        { error: `Invalid event. Allowed: ${[...ALLOWED_EVENTS].join(", ")}` },
        { status: 400 },
      );
    }

    const payload = sanitizePayload(body?.payload);

    logger.info("[workspace/telemetry] event", {
      event: event as WorkspaceClientTelemetryEvent,
      ...payload,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[workspace/telemetry] failed to record event", error as Error);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
});
