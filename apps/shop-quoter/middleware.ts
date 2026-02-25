import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders } from "@nzila/os-core/rateLimit";

/* ── Layer 1 — Public route matcher ── */
const isPublicRoute = createRouteMatcher([
  "/",
  "/about(.*)",
  "/features(.*)",
  "/pricing(.*)",
  "/contact(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/health(.*)",
]);

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? "120");
const RATE_LIMIT_WINDOW_MS = Number(
  process.env.RATE_LIMIT_WINDOW_MS ?? "60000",
);

export default clerkMiddleware(async (auth, request) => {
  /* ── Layer 2 — Rate limiting (skip in dev — HMR triggers too many requests) ── */
  if (process.env.NODE_ENV !== "development") {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rl = checkRateLimit(ip, {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too Many Requests" },
        {
          status: 429,
          headers: rateLimitHeaders(rl, RATE_LIMIT_MAX),
        },
      );
    }
  }

  /* ── Layer 3 — Auth protection ── */
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  /* ── Layer 4 — Request-ID propagation ── */
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
