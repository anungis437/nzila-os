/**
 * CourtLens public intake API route — Phase 2A.
 *
 * POST /api/courtlens/public-intake
 *
 * - No authentication required (listed in proxy.ts isPublicRoute).
 * - Idempotency-Key header required in non-dev mode (enforced by proxy).
 * - Rate-limited by proxy middleware.
 * - Never returns legal advice, internal notes, reviewer data, or raw events.
 * - Legal boundary notice is mandatory in the success response.
 *
 * Tenant resolver: Phase 2A accepts tenantId in the request body.
 * Slug-to-orgId resolution is a Phase 2B deliverable.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRequestContext } from '@/lib/api-guards';
import { logAuditEvent } from '@/lib/audit-log';
import {
  createMatterFromPublicIntake,
  validatePublicIntakeInput,
} from '@/modules/incidents/public-intake';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    // Parse body — return 400 on malformed JSON
    const rawBody = await request.json().catch(() => null);
    if (rawBody === null) {
      return NextResponse.json(
        { error: 'Request body must be valid JSON', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    // Validate intake payload
    const validation = validatePublicIntakeInput(rawBody);
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: 'Invalid intake payload',
          code: 'INVALID_INTAKE_PAYLOAD',
          errors: validation.errors,
        },
        { status: 400 },
      );
    }

    const { input } = validation;

    // Create tenant-scoped matter via service layer
    const confirmation = await createMatterFromPublicIntake(input);

    // Audit the public intake submission (tenant-scoped, no client PII in log)
    await logAuditEvent({
      action: 'courtlens.public_intake.submitted',
      actorUserId: 'public',
      orgId: input.tenantSlug,
      entityType: 'matter',
      details: {
        matterId: confirmation.matterId,
        practiceArea: input.practiceArea,
        severity: 'auto-derived',
      },
    });

    return NextResponse.json(
      {
        ok: true,
        ...confirmation,
      },
      { status: 201 },
    );
  });
}
