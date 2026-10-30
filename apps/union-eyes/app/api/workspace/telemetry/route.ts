import { NextResponse } from "next/server";
import { withRoleAuth } from "@/lib/api-auth-guard";
import { logger } from "@/lib/logger";
import {
  WORKSPACE_ID,
  WORKSPACE_CLIENT_TELEMETRY_EVENTS,
  WORKSPACE_TELEMETRY_PAYLOAD_KEYS,
  isAllowedTelemetryRoute,
  WORKSPACE_TABS,
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
const ALLOWED_TABS = new Set<string>(WORKSPACE_TABS.map(tab => tab.id));
const MAX_BODY_BYTES = 2048;

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
    if (key === "tab") {
      if (ALLOWED_TABS.has(value)) safe.tab = value;
      continue;
    }
    // The client does not attest to event time or workspace identity.
    // Accept neither an arbitrary timestamp nor a forged workspace name.
  }

  safe.workspace = WORKSPACE_ID;
  safe.timestamp = new Date().toISOString();
  return safe;
}

export const POST = withRoleAuth("member", async (req) => {
  try {
    // Bound the actual streamed body, not only Content-Length (which can be absent or forged).
    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Telemetry payload too large" }, { status: 413 });
    }
    const reader = req.body?.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let total = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BODY_BYTES) {
          await reader.cancel();
          return NextResponse.json({ error: "Telemetry payload too large" }, { status: 413 });
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid telemetry JSON" }, { status: 400 });
    }
    const event = body.event;

    if (typeof event !== "string" || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json(
        { error: `Invalid event. Allowed: ${[...ALLOWED_EVENTS].join(", ")}` },
        { status: 400 },
      );
    }

    const payload = sanitizePayload(body.payload);

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
