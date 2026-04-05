/**
 * CFO — Client Detail Page (Server Component).
 *
 * Shows client entity info, members, financial summary,
 * and recent activity from audit_log.
 */
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect, notFound } from 'next/navigation'
import {
  ArrowLeft,
  Users,
  DollarSign,
  FileText,
  Clock,
  Building2,
} from 'lucide-react'
import { getClientDetail } from '@/lib/actions/client-actions'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const client = await getClientDetail(id)
  if (!client) notFound()

  const stats = [
    {
      label: 'Team Members',
      value: client.members.length,
      icon: Users,
      color: 'text-electric',
    },
    {
      label: 'Total Revenue',
      value: `$${(client.financialSummary?.totalRevenue ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-500',
    },
    {
      label: 'Documents',
      value: client.financialSummary?.documentCount ?? 0,
      icon: FileText,
      color: 'text-amber-500',
    },
    {
      label: 'Audit Events',
      value: client.financialSummary?.auditEventCount ?? 0,
      icon: Clock,
      color: 'text-purple-500',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Back nav */}
      <Link
        href="../clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-electric/10 text-electric">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="font-poppins text-2xl font-bold text-foreground">
              {client.legalName}
            </h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  client.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                }`}
              >
                {client.status}
              </span>
              <span>
                Created{' '}
                {client.createdAt
                  ? new Date(client.createdAt).toLocaleDateString('en-CA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-secondary ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="font-poppins text-xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Members */}
      <div>
        <h3 className="mb-3 font-poppins text-lg font-semibold text-foreground">
          Team Members
        </h3>
        {client.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {client.members.map((member: { userId: string; role: string; createdAt?: Date }) => (
                  <tr key={member.userId} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {member.userId.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-electric/10 px-2 py-0.5 text-xs font-medium text-electric">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.createdAt
                        ? new Date(member.createdAt).toLocaleDateString('en-CA')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="mb-3 font-poppins text-lg font-semibold text-foreground">
          Recent Activity
        </h3>
        {!client.financialSummary?.recentActivity?.length ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <div className="space-y-2">
            {client.financialSummary.recentActivity.map(
              (event: { id: string; action: string; createdAt: Date }, idx: number) => (
                <div
                  key={event.id ?? idx}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <span className="text-sm text-foreground">{event.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString('en-CA')}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}
