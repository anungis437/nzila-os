import { auth } from '@nzila/platform-auth/entra/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { resolveDemoContext } from '@/lib/demo-mode';

const roiRows = [
  {
    label: 'Investigation hours saved',
    value: '180 hrs / quarter',
    note: 'Structured timelines, assignments, and export-ready reporting reduce manual coordination work.',
  },
  {
    label: 'Reporting time saved',
    value: '28 hrs / quarter',
    note: 'Executive dashboard and export views replace manual board-pack compilation.',
  },
  {
    label: 'Remediation follow-through lift',
    value: '+22%',
    note: 'Ownership and overdue tracking reduce dropped accountability actions.',
  },
  {
    label: 'Avoided consultant spend estimate',
    value: '$35k-$60k',
    note: 'Internal teams can manage investigations and readiness artifacts with less outside advisory support.',
  },
];

export default async function RoiPage({
  searchParams,
}: {
  searchParams?: Promise<{ demo?: string; org?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const t = await getTranslations('abrDashboard.roi');
  const demo = resolveDemoContext((await searchParams) ?? undefined);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{t('title')}</h2>
        <p className="mt-1 text-slate-600">{t('subtitle', { organization: demo.organizationName })}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {roiRows.map((row) => (
          <Card key={row.label}>
            <div className="space-y-2 p-6">
              <p className="text-xs uppercase tracking-wide text-slate-500">{row.label}</p>
              <p className="font-poppins text-2xl font-semibold text-navy">{row.value}</p>
              <p className="text-sm text-slate-600">{row.note}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
