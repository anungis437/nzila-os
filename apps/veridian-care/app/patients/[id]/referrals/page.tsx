import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SYNTHETIC_PATIENTS } from '@/lib/synthetic-patients'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const patient = SYNTHETIC_PATIENTS.find((p) => p.id === id)
  if (!patient) return { title: 'Not found' }
  return { title: `Referrals — ${patient.firstName} ${patient.lastName}` }
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  overdue: 'bg-rose-100 text-rose-800 border-rose-200',
}

export default async function ReferralsPage({ params }: Props) {
  const { id } = await params
  const patient = SYNTHETIC_PATIENTS.find((p) => p.id === id)
  if (!patient) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link href={`/patients/${patient.id}`} className="text-teal-600 hover:underline text-sm">
          ← Back to {patient.firstName} {patient.lastName}
        </Link>
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6">
        Referrals — {patient.firstName} {patient.lastName}
      </h1>
      <div className="space-y-4">
        {patient.referrals.map((referral) => (
          <div
            key={`${referral.date}-${referral.to}`}
            className={`p-6 rounded-2xl border ${statusColors[referral.status] ?? 'bg-slate-50 border-slate-200'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-bold text-slate-900 text-lg">{referral.to}</div>
                <div className="text-sm text-slate-600 mt-1">{referral.reason}</div>
                <div className="text-xs text-slate-400 mt-2">Referred: {referral.date}</div>
              </div>
              <span className="px-3 py-1.5 rounded-full text-sm font-bold capitalize border shrink-0 bg-white/60">
                {referral.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
