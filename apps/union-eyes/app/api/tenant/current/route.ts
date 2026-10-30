/**
 * GET /api/tenant/current — REMOVED
 *
 * The legacy compatibility wrapper answered 200 with an organization whose name, slug and tier were always null and whose
 * features were always empty; nothing in the application calls it. A client that still does is told the route is gone and where
 * the canonical one is, instead of receiving a success with no data.
 */

import { NextResponse } from "next/server";
import { goneResponse } from "@/lib/api/deprecation";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return goneResponse("/api/tenant/current", "Use /api/org/current, which returns the organization's name, slug, tier and features.");
}
