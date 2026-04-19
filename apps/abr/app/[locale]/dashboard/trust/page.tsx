import { auth } from '@nzila/platform-auth/entra/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';

const trustRows = [
  ['Security overview', 'Role-gated incident workflows, auditable event trails, and export controls.'],
  ['Privacy posture', 'Canada-first posture with configurable data residency patterns and scoped organizational access.'],
  ['Role controls summary', 'Explicit permission matrix for investigators, executives, auditors, and administrators.'],
  ['Auditability', 'Timeline, notes, state transitions, and remediation actions produce defensible records.'],
  ['Onboarding timeline', 'Pilot launch in 30 days with seeded demo mode and structured implementation plan.'],
  ['Support model', 'Joint implementation cadence, governance check-ins, and ABR admin enablement.'],
];

export default async function TrustPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const t = await getTranslations('abrDashboard.trust');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{t('title')}</h2>
        <p className="mt-1 text-slate-600">{t('subtitle')}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {trustRows.map(([label, value]) => (
          <Card key={label}>
            <div className="space-y-2 p-6">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className="text-sm text-slate-700">{value}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
