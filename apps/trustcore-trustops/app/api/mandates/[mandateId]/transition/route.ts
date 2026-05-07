import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import type { TrustOpsMandateStage } from '@nzila/trustcore-contracts'
import { evaluateTransition } from '@nzila/trustcore-trustops/fsm'
import { getMandate, transitionStage } from '../../../../../lib/mandates-store'

interface Params {
  readonly params: Promise<{ readonly mandateId: string }>
}

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: Params) {
  const { mandateId } = await params
  const mandate = getMandate(mandateId)
  if (!mandate) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
  }

  const form = await req.formData()
  const toStage = String(form.get('toStage') ?? '') as TrustOpsMandateStage

  const result = evaluateTransition({ fromStage: mandate.stage, toStage })
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 })
  }

  transitionStage(mandateId, toStage)
  redirect(`/mandates/${mandateId}`)
}
