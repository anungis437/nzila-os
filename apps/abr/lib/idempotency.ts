/**
 * CourtLens client-side idempotency helper — Phase 2E.5.
 *
 * The ABR proxy middleware requires an `Idempotency-Key` header on every
 * non-dev POST/PUT/PATCH/DELETE request to `/api/*` (see apps/abr/proxy.ts).
 * Missing keys are rejected with `400 IDEMPOTENCY_KEY_REQUIRED` in
 * pilot/production.
 *
 * This helper generates a fresh key per mutation. The server currently accepts
 * any non-empty value; UUIDs are the safest choice because they are:
 *   - unique per action (no accidental request deduplication)
 *   - opaque (no sensitive info leaked)
 *   - short enough for header transport
 */

/**
 * Generate a fresh idempotency key.
 * Uses `crypto.randomUUID()` when available (all modern browsers + Node 19+).
 * Falls back to a time+random composition only for legacy JSDOM environments
 * that do not implement `crypto.randomUUID` — never for production paths.
 */
export function createIdempotencyKey(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();

  // JSDOM fallback (test only). Never used in modern browsers or in Node 19+.
  const rand = Math.random().toString(36).slice(2, 14);
  const time = Date.now().toString(36);
  return `${time}-${rand}-${Math.random().toString(36).slice(2, 10)}`;
}
