import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withNzilaSpan } from '@nzila/otel-core'
import {
  ConsentRole,
  ConsentScope,
  decideAccess,
  createAuditEvent,
} from '@nzila/consent-engine'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { onboardingSchema } from '@/lib/validation/onboarding'
import {
  generateDataGovernancePolicy,
  generatePrivacyPolicy,
} from '@/lib/compliance/policy-generator'
import type { Role } from '@/types/core'

const requestSchema = z.object({
  mode: z.enum(['privacy_policy', 'data_governance', 'both']).default('both'),
  input: onboardingSchema,
})

function toConsentRole(role: Role): ConsentRole {
  switch (role) {
    case 'platform_admin':
    case 'org_admin':
      return ConsentRole.ADMIN
    case 'staff':
      return ConsentRole.CLINICIAN
    case 'auditor':
      return ConsentRole.AUDITOR
  }
}

export const POST = withRequiredRole(
  ['org_admin', 'staff', 'auditor', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    const rawBody = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid AI policy request payload',
          issues: parsed.error.issues,
        },
        { status: 400 },
      )
    }

    const consentRole = toConsentRole(ctx.role)
    const access = decideAccess({
      actorId: ctx.userId,
      role: consentRole,
      patientId: 'trustcore-policy-generator',
      organizationId: ctx.orgId,
      siteId: 'trustcore',
      requestedScope: ConsentScope.READ_TIMELINE,
      reason: 'AI policy generation preview request',
    })

    if (!access.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: access.reason,
          requiresBreakGlass: access.requiresBreakGlass,
        },
        { status: 403 },
      )
    }

    const audit = createAuditEvent({
      actorId: ctx.userId,
      role: consentRole,
      tenantId: ctx.orgId,
      siteId: 'trustcore',
      patientId: 'trustcore-policy-generator',
      action: 'trustcore.ai.policy.generate',
      reason: parsed.data.mode,
      sessionId: undefined,
      source: 'trustcore-api',
    })

    const result = await withNzilaSpan('trustcore.ai.policy.generate', ctx.orgId, async () => {
      switch (parsed.data.mode) {
        case 'privacy_policy': {
          const policy = await generatePrivacyPolicy(parsed.data.input)
          return { privacyPolicy: policy }
        }
        case 'data_governance': {
          const policy = await generateDataGovernancePolicy(parsed.data.input)
          return { dataGovernancePolicy: policy }
        }
        case 'both':
        default: {
          const [privacyPolicy, dataGovernancePolicy] = await Promise.all([
            generatePrivacyPolicy(parsed.data.input),
            generateDataGovernancePolicy(parsed.data.input),
          ])
          return { privacyPolicy, dataGovernancePolicy }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        access,
        audit,
      },
    })
  },
)