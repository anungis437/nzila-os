import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { upsertFlowLead, createFlowDeal } from '@/lib/services/crm-service'
import { emitTrialStarted } from '@nzila/platform-events/commercial'
import { PlatformEventBus } from '@nzila/platform-events'

const bus = new PlatformEventBus()

const trialSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email(),
  company: z.string().min(1),
  teamSize: z.string().optional(),
  primaryUseCase: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  brandName: z.string().optional(),
  primaryColor: z.string().optional(),
  logoUrl: z.string().optional(),
  currency: z.string().optional(),
  taxRegion: z.string().optional(),
  taxId: z.string().optional(),
  defaultTaxRate: z.string().optional(),
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        sku: z.string().min(1),
        unitPrice: z.string().optional(),
      }),
    )
    .optional(),
})

function estimateArrFromTeamSize(teamSize?: string): string {
  if (!teamSize) return '3000'
  if (teamSize === '100+') return '24000'

  const [min] = teamSize.split('-').map((part) => Number(part))
  if (Number.isFinite(min) && min >= 21) return '12000'
  if (Number.isFinite(min) && min >= 6) return '6000'
  return '3000'
}

export async function POST(request: NextRequest) {
  try {
    const body = trialSchema.parse(await request.json())
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const contactId = await upsertFlowLead({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      properties: {
        company: body.company,
        ...(body.teamSize ? { flow_team_size: body.teamSize } : {}),
        ...(body.primaryUseCase ? { flow_primary_use_case: body.primaryUseCase } : {}),
        ...(body.industry ? { flow_industry: body.industry } : {}),
        ...(body.website ? { website: body.website } : {}),
        ...(body.brandName ? { flow_brand_name: body.brandName } : {}),
        ...(body.primaryColor ? { flow_brand_primary_color: body.primaryColor } : {}),
        ...(body.logoUrl ? { flow_logo_url: body.logoUrl } : {}),
        ...(body.currency ? { flow_currency: body.currency } : {}),
        ...(body.taxRegion ? { flow_tax_region: body.taxRegion } : {}),
        ...(body.taxId ? { flow_tax_id: body.taxId } : {}),
        ...(body.defaultTaxRate ? { flow_default_tax_rate: body.defaultTaxRate } : {}),
        ...(body.products?.length
          ? {
              flow_seed_products: JSON.stringify(
                body.products.map((product) => ({
                  name: product.name,
                  sku: product.sku,
                  unitPrice: product.unitPrice ?? '',
                })),
              ),
            }
          : {}),
        flow_source: 'flow-trial-signup',
        flow_trial_status: 'trialing',
        flow_trial_ends_at: trialEndsAt,
      },
    })

    if (contactId) {
      await createFlowDeal({
        name: `Flow trial - ${body.company}`,
        stage: 'trial_active',
        contactId,
        properties: {
          flow_arr_estimate: estimateArrFromTeamSize(body.teamSize),
          flow_trial_ends_at: trialEndsAt,
          flow_close_probability: '0.25',
          ...(body.primaryUseCase ? { flow_primary_use_case: body.primaryUseCase } : {}),
          ...(body.taxRegion ? { flow_tax_region: body.taxRegion } : {}),
          ...(body.currency ? { flow_currency: body.currency } : {}),
        },
      })
    }

    void bus.emit(emitTrialStarted(
      {
        leadId: contactId ?? crypto.randomUUID(),
        email: body.email,
        company: body.company,
        appId: 'flow',
        trialEndsAt,
        teamSize: body.teamSize,
        primaryUseCase: body.primaryUseCase,
      },
      { orgId: process.env.PLATFORM_ORG_ID ?? 'system', actorId: 'system' },
    ))

    return NextResponse.json({ ok: true, trialEndsAt })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid trial payload', details: error.flatten().fieldErrors }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Failed to create trial lead' }, { status: 500 })
  }
}
