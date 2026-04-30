import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { listOperationalRecords } from '@/lib/maestria-persistence'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(searchParams, 'quote.manage', 'proposal.pdf.generate', `proposal:${id}`)
  if (auth.response) return auth.response

  const proposal = listOperationalRecords('proposal', 200).find((item) => item.id === id)
  if (!proposal) {
    return NextResponse.json({ ok: false, error: 'proposal_not_found' }, { status: 404 })
  }

  const payload = proposal.payload
  const total = typeof payload.total === 'number' ? payload.total : 0
  const depositRequired = typeof payload.depositRequired === 'number' ? payload.depositRequired : total * 0.4
  const locale = searchParams.locale === 'fr-CA' ? 'fr-CA' : 'en-CA'

  const { renderProposalPdf } = await import('@/lib/proposal-pdf')

  const pdf = await renderProposalPdf({
    proposalId: proposal.id,
    title: proposal.title,
    customerName: typeof payload.customerName === 'string' ? payload.customerName : 'Shop Moi Ca',
    summary: proposal.body,
    total,
    depositRequired,
    locale,
  })

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="proposal-${proposal.id}.pdf"`,
    },
  })
}
