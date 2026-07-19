/**
 * Platform Admin — SAGE workspace index
 *
 * Authenticated, org-scoped list of SAGE (Service Assurance & Governance
 * Evidence) workspaces. Read-only for viewers; create is gated on write role.
 * No score, rank, grade, or certification is shown.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { SAGE_INSTITUTION_TYPES, SAGE_RISK_SURFACES } from '@nzila/sage-core'
import { getPageOrgContext } from '../../lib/page-org-context'
import {
  ActiveOrgBadge,
  ForbiddenPanel,
  OrgPickerPanel,
} from '../../lib/org-page-fallbacks'
import { canWrite } from '../../lib/org-scope-guard'
import { listSageWorkspacesForScope } from '../../lib/sage/workspace-service'
import { CreateWorkspaceForm } from './components/create-workspace-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SAGE | Platform Admin',
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function SageWorkspaceIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>
}) {
  const [sp, t] = await Promise.all([searchParams, getTranslations('sage')])
  const result = await getPageOrgContext(sp)

  if (result.status === 'unauthenticated') redirect('/sign-in')
  if (result.status === 'no-selection') {
    return <OrgPickerPanel candidates={result.candidates} returnTo="/sage" />
  }
  if (result.status === 'forbidden') {
    return <ForbiddenPanel orgId={result.orgId} />
  }

  const { orgId, orgName, orgRole } = result.context
  const { workspaces } = await listSageWorkspacesForScope({
    actorId: result.context.actorId,
    orgId,
    orgRole,
  })
  const writable = canWrite(orgRole)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{t('breadcrumb')}</span>
        <ActiveOrgBadge orgName={orgName} orgId={orgId} orgRole={orgRole} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">{t('pageDescription')}</p>
        </div>
        {writable && (
          <CreateWorkspaceForm
            orgId={orgId}
            institutionTypes={SAGE_INSTITUTION_TYPES}
            riskSurfaces={SAGE_RISK_SURFACES}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <caption className="sr-only">{t('tableCaption')}</caption>
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">{t('columns.workspace')}</th>
              <th scope="col" className="px-4 py-3 text-left">{t('columns.institutionType')}</th>
              <th scope="col" className="px-4 py-3 text-left">{t('columns.riskSurface')}</th>
              <th scope="col" className="px-4 py-3 text-left">{t('columns.status')}</th>
              <th scope="col" className="px-4 py-3 text-left">{t('columns.updated')}</th>
              <th scope="col" className="px-4 py-3 text-right">{t('columns.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {workspaces.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  {t('emptyState')}
                </td>
              </tr>
            ) : (
              workspaces.map((ws) => (
                <tr key={ws.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{ws.name}</td>
                  <td className="px-4 py-3 text-gray-600">{humanize(ws.institutionType)}</td>
                  <td className="px-4 py-3 text-gray-600">{humanize(ws.riskSurface)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {humanize(ws.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(ws.updatedAt).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/sage/${ws.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {t('columns.open')}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
