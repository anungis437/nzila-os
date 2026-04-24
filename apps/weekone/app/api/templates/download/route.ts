import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@nzila/os-core/telemetry'

const log = createLogger('weekone.template_download')

const schema = z.object({
  email: z.string().email(),
  source: z.string().min(1).default('weekone-template-download'),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid template payload' }, { status: 400 })
  }

  log.info('download_requested', {
    email: parsed.data.email,
    source: parsed.data.source,
    occurredAt: new Date().toISOString(),
  })

  return NextResponse.json({
    ok: true,
    eventName: 'weekone.template.download',
    downloadUrl: '/templates/weekone-founder-monday-reset.txt',
  })
}
