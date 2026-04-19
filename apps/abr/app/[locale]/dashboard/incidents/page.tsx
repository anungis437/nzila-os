import { auth } from '@nzila/platform-auth/entra/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { listIncidents } from '@/modules/incidents/service';

export default async function IncidentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { locale } = await params;
  const orgId = process.env.ABR_DEMO_ORG_ID ?? 'metro-university';
  const incidents = await listIncidents(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">Incident Registry</h2>
        <p className="mt-1 text-slate-600">
          Track intake, triage, investigation, and remediation steps for ABR incidents.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {incidents.map((incident) => (
          <Card key={incident.id}>
            <div className="space-y-3 p-6">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>{incident.category.replaceAll('_', ' ')}</span>
                <span>{incident.severity}</span>
              </div>
              <h3 className="font-poppins text-base font-semibold text-navy">{incident.title}</h3>
              <p className="text-sm text-slate-700">{incident.summary}</p>
              <p className="text-xs text-slate-500">
                Status: {incident.status} | Updated {new Date(incident.updatedAt).toLocaleDateString()}
              </p>
              <Link
                href={`/${locale}/dashboard/incidents/${incident.id}`}
                className="text-sm font-semibold text-electric"
              >
                Open case details
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
