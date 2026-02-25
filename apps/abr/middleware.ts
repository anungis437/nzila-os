import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/about(.*)",
  "/platform(.*)",
  "/pricing(.*)",
  "/contact(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
  "/api/webhooks(.*)",
  "/legal(.*)",
  "/resources(.*)",
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  // 1. Auth layer — protect non-public routes (skip in dev — prevents Clerk handshake loops)
  if (process.env.NODE_ENV !== 'development' && !isPublicRoute(request)) {
    await auth.protect();
  }

  // 2. Request-ID propagation
  const response = NextResponse.next();
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  response.headers.set("x-request-id", requestId);
  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
