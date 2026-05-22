/**
 * ARTIFACT TYPE: Next.js Route — OCRA canonical alias
 * MODULE: OCI ↔ OCRA Convergence (Phase 2)
 *
 * Next.js requires `dynamic` and `runtime` to be statically declared in the
 * route file (not re-exported). The handler itself is reused from the ICRA
 * canonical route.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { POST } from '../../../icra/[assessmentId]/claim/route';
