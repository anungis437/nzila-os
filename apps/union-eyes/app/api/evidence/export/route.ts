/**
 * GET /api/evidence/export — controlled procurement evidence boundary.
 *
 * This endpoint cannot attest controls, an SBOM, a sealed bundle, or a build
 * without reading and verifying those artifacts. Until the verified evidence
 * pipeline is integrated, it refuses to issue a purported evidence pack.
 * The refusal is still actor/tenant-bound and durably audited.
 */
import { NextResponse } from 'next/server';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { minRole: 'officer' }, requireOrg: true },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('An authenticated organization officer is required');
    }

    // The session's verified organization is the only possible evidence scope.
    // A caller cannot issue even a refused attestation in another org's name.
    const requestedOrg = request.nextUrl.searchParams.get('orgId');
    if (requestedOrg && requestedOrg !== organizationId) {
      throw ApiError.forbidden('Requested organization differs from authenticated organization');
    }

    // An evidence export attempt is security-relevant even when the artifact
    // is unavailable. Audit before responding; audit failure must not yield
    // an apparently successful export or an unaudited response.
    await withRLSContext({ organizationId, userId }, async (tx) => {
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'evidence.export.unavailable',
        resourceType: 'evidence_export',
        details: {
          reason: 'verified_sealed_artifact_not_loaded',
          format: 'json',
        },
      });
    });

    return NextResponse.json({
      app: 'union-eyes',
      org_id: organizationId,
      status: 'not_attested',
      verified: false,
      error: 'VERIFIED_EVIDENCE_UNAVAILABLE',
      message: 'No verified sealed evidence bundle is loaded by this endpoint. No control, isolation, SBOM, or build assertion has been made.',
      nextStep: 'Produce, seal, and independently verify the evidence bundle using the evidence pipeline before publication.',
      evidencePipeline: {
        collect: 'scripts/evidence/collect.mjs',
        seal: 'scripts/evidence/seal.mjs',
        verify: 'scripts/evidence/verify.mjs',
      },
      sbom: { status: 'not_attested', artifact: null },
      policy_checks: { status: 'not_attested', results: null },
      org_isolation: { status: 'not_attested', results: null },
      build: { status: 'not_attested', commit: null, timestamp: null },
    }, {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  },
);
