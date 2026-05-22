/**
 * ARTIFACT TYPE: Next.js Route — OCRA canonical alias
 * MODULE: OCI ↔ OCRA Convergence (Phase 2)
 *
 * Canonical `/api/ocra/start` route. Re-exports the legacy
 * `/api/icra/start` handlers verbatim so both surfaces serve identical
 * behaviour. No behavioural divergence is permitted from this file.
 */
export { GET, POST } from '../../icra/start/route';
