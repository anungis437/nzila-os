/**
 * Next.js Middleware — framework entrypoint.
 *
 * ALL implementation lives in proxy.ts, which contains the full edge-safe
 * middleware stack:
 *   - CORS (strict origin allowlist, fail-secure in production)
 *   - Cron authentication (x-cron-secret header validation)
 *   - Idempotency-Key enforcement (auto-inject + warn for mutating requests)
 *   - Org-scoped rate limiting (per-org + route-group buckets via os-core)
 *   - IP-based rate limiting for auth endpoints (brute-force protection)
 *   - i18n locale routing (next-intl)
 *   - Locale alias normalisation (/en → /en-CA, /fr → /fr-CA)
 *   - Request-ID propagation (x-request-id for distributed tracing)
 *   - Payment redirect cleanup (strips checkout/payment_intent params)
 *
 * WHY PROXY.TS EXISTS:
 *   The implementation was extracted to `proxy.ts` to:
 *   1. Keep this Next.js entrypoint thin and framework-version independent.
 *   2. Allow the middleware stack to be unit-tested without Next.js bootstrap.
 *   3. Support external proxy layers (Cloudflare Workers, nginx, CDN edge
 *      functions) that can import the same logic without depending on
 *      Next.js naming conventions.
 *
 * ARCHITECTURE:
 *   middleware.ts (this file)  → Next.js framework hook (entrypoint only)
 *   proxy.ts                   → Edge middleware implementation (all logic)
 *   lib/middleware/            → Node.js-only middleware utilities (not edge-safe)
 *
 * NOTE ON THE "PROXY" NAMING:
 *   The file is named proxy.ts — not because of any Next.js deprecation —
 *   but to signal that this layer acts as an edge proxy (intercepts, inspects,
 *   and forwards/rejects requests) rather than application-level middleware.
 *   Next.js requires the entrypoint to be named `middleware.ts` and export
 *   a function named `middleware` (or `default`). This file fulfils that
 *   contract by re-exporting from proxy.ts.
 *
 * See: docs/security/RLS_AUTH_RBAC_ALIGNMENT.md for full architecture.
 */
export { proxy as middleware, config } from './proxy';
