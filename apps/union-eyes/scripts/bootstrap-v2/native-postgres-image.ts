/** Pinned disposable PostgreSQL 16 / pgvector 0.8.1 images, selected for the
 * local runtime architecture so native acceptance does not use CPU emulation.
 * ARM64 digest: official pgvector/pgvector:0.8.1-pg16 OCI index, 2026-11-18.
 * The existing AMD64 pin remains unchanged. No mutable tag fallback is allowed.
 */
const images = {
  arm64:
    'pgvector/pgvector:0.8.1-pg16@sha256:417eabe00c71238357315d66d024607c6b9a414be3a3ea401d442c5bcbf0c00d',
  x64: 'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337',
} as const

export function nativePostgres16Image(architecture: string = process.arch): string {
  if (architecture !== 'arm64' && architecture !== 'x64')
    throw new Error(`UE_V2_NATIVE_POSTGRES_ARCHITECTURE_UNSUPPORTED:${architecture}`)
  return images[architecture]
}
