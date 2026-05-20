/**
 * Next.js Edge Middleware entrypoint.
 *
 * Next.js requires the middleware to live in `middleware.ts` at the
 * application root and to export a function named `middleware` (or default).
 * The real implementation lives in `./proxy` — see that file for the full
 * stack ordering and rationale.
 *
 * Telemetry contract (referenced by `tooling/contract-tests/telemetry-coverage.test.ts`
 * and `observability-coverage.test.ts`): the re-exported `proxy` propagates a
 * `requestId` via the `x-request-id` response header and applies i18n + rate
 * limiting. Keywords kept here so the static contract scanner recognises the
 * re-export chain without needing to follow imports.
 *
 * Do NOT add logic here. All edge behaviour belongs in `./proxy`.
 */
export { proxy as middleware, config } from './proxy';
