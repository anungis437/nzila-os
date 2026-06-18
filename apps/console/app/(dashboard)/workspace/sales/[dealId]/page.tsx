import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  UserIcon,
  BanknotesIcon,
  CalendarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { CommandPageShell } from '@/components/command-page-shell'
import { Card, CardBody, Badge, Button } from '@/components/ui'
import {
  loadDealDetail,
  detailToEditable,
  STAGE_METADATA,
  type DealStage,
} from '../../_lib/sales'
import { updateDeal, deleteDeal } from '../../_lib/sales-actions'
import { requireWorkspaceUser } from '../../_lib/workspace-auth'
import { DealFields, STAGE_LABELS } from '../_components/deal-fields'
import { formatCurrency } from '../../_lib/ventures'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-gray-300">{icon}</span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-0.5 text-sm text-gray-900">{value}</p>
      </div>
    </div>
  )
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>
}) {
  await requireWorkspaceUser()

  const { dealId } = await params
  const detail = await loadDealDetail(dealId)
  if (!detail) notFound()

  const editable = detailToEditable(detail)
  const canonical: DealStage | null = detail.canonicalStage
  const canonicalLabel = canonical ? STAGE_METADATA[canonical].label : 'Lost / inactive'

  return (
    <CommandPageShell as="div" className="space-y-8">
      {/* Back link + breadcrumb */}
      <div>
        <Link
          href="/workspace/sales"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Sales workspace
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{detail.accountName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="blue">{detail.product}</Badge>
            <Badge tone="gray">{canonicalLabel}</Badge>
            <span className="text-xs text-gray-400">Registered as “{STAGE_LABELS[detail.partnerStage]}”</span>
          </div>
        </div>
        <form action={deleteDeal}>
          <input type="hidden" name="dealId" value={detail.id} />
          <input type="hidden" name="redirectToList" value="1" />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon className="h-4 w-4" /> Delete deal
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Read view */}
        <Card className="lg:col-span-1">
          <CardBody>
            <h3 className="text-base font-semibold text-gray-900">Details</h3>
            <div className="mt-2 divide-y divide-gray-50">
              <DetailRow icon={<BuildingOffice2Icon className="h-5 w-5" />} label="Account" value={detail.accountName} />
              <DetailRow icon={<UserIcon className="h-5 w-5" />} label="Contact" value={detail.contactName} />
              <DetailRow
                icon={<EnvelopeIcon className="h-5 w-5" />}
                label="Contact email"
                value={
                  <a href={`mailto:${detail.contactEmail}`} className="text-blue-600 hover:underline">
                    {detail.contactEmail}
                  </a>
                }
              />
              <DetailRow
                icon={<BanknotesIcon className="h-5 w-5" />}
                label="Estimated ARR"
                value={formatCurrency(detail.estimatedArr)}
              />
              <DetailRow icon={<UserIcon className="h-5 w-5" />} label="Owner / reviewer" value={detail.owner || 'Unassigned'} />
              <DetailRow icon={<CalendarIcon className="h-5 w-5" />} label="Expected close" value={fmtDate(detail.expectedCloseDate)} />
              <DetailRow icon={<CalendarIcon className="h-5 w-5" />} label="Created" value={fmtDate(detail.createdAt)} />
              <DetailRow icon={<CalendarIcon className="h-5 w-5" />} label="Last updated" value={fmtDate(detail.updatedAt)} />
            </div>
            {detail.notes && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{detail.notes}</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Edit form */}
        <Card className="lg:col-span-2">
          <CardBody>
            <h3 className="text-base font-semibold text-gray-900">Edit deal</h3>
            <p className="mt-1 text-sm text-gray-500">
              Update stage, value, owner, and close date. Contact identity is fixed after registration.
            </p>
            <form action={updateDeal} className="mt-5 space-y-5">
              <input type="hidden" name="dealId" value={detail.id} />
              <DealFields deal={editable} />
              <div className="flex justify-end">
                <Button type="submit" size="sm">Save changes</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </CommandPageShell>
  )
}
