import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { getDashboardSummary } from '@/modules/incidents/service';

export default async function AnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const orgId = process.env.ABR_DEMO_ORG_ID ?? 'metro-university';
  const snapshot = await getDashboardSummary(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">Accountability Analytics</h2>
        <p className="mt-1 text-slate-600">
          Executive pulse on incidents, overdue actions, and training posture.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><div className="p-5"><p className="text-xs text-slate-500">Open incidents</p><p className="mt-2 font-poppins text-xl text-navy">{snapshot.openIncidents}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Overdue investigations</p><p className="mt-2 font-poppins text-xl text-navy">{snapshot.overdueInvestigations}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Overdue actions</p><p className="mt-2 font-poppins text-xl text-navy">{snapshot.overdueActions}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Avg days open</p><p className="mt-2 font-poppins text-xl text-navy">{snapshot.avgDaysOpen}</p></div></Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><div className="p-5"><p className="text-xs text-slate-500">Training completion</p><p className="mt-2 font-poppins text-xl text-navy">{snapshot.trainingCompletionPct}%</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Unresolved hotspots</p><p className="mt-2 font-poppins text-xl text-navy">{snapshot.unresolvedHotspots}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Owner workload rows</p><p className="mt-2 font-poppins text-xl text-navy">{snapshot.ownerWorkload.length}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">90d buckets</p><p className="mt-2 font-poppins text-xl text-navy">{snapshot.trend90d.length}</p></div></Card>
      </div>

      <p className="text-xs text-slate-500">Generated at: {new Date(snapshot.generatedAt).toLocaleString()}</p>
    </div>
  );
}
