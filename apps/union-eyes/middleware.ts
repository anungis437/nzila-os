/**
 * Next.js Edge Middleware entrypoint.
 *
 * Next.js requires the middleware to live in `middleware.ts` at the
 * application root and to export a function named `middleware` (or default).
 * The real implementation lives in `./proxy` — see that file for the full
 * stack ordering and rationale.
 *
 * Do NOT add logic here. All edge behaviour belongs in `./proxy`.
 */
export { proxy as middleware, config } from './proxy';
