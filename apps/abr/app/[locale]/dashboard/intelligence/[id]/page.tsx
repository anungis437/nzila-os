import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { getComparableCases, getIntelligenceCase } from '@/modules/intelligence/service';

export default async function IntelligenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { id } = await params;
  const item = await getIntelligenceCase(id);
  if (!item) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8">Case intelligence record not found.</div>;
  }

  const related = await getComparableCases(id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{item.title}</h2>
        <p className="mt-1 text-slate-600">{item.conciseSummary}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><div className="p-5"><p className="text-xs text-slate-500">Jurisdiction</p><p className="mt-2 font-semibold text-navy">{item.jurisdiction}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Decision body</p><p className="mt-2 font-semibold text-navy">{item.decisionBody}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Source status</p><p className="mt-2 font-semibold text-navy">{item.sourceStatus}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Freshness</p><p className="mt-2 font-semibold text-navy">{item.freshnessDate}</p></div></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><div className="space-y-3 p-6"><h3 className="font-poppins text-lg font-semibold text-navy">Facts and Issues</h3><p className="text-sm text-slate-700">{item.facts}</p><ul className="list-disc pl-5 text-sm text-slate-700">{item.issues.map((issue: string) => <li key={issue}>{issue}</li>)}</ul></div></Card>
        <Card><div className="space-y-3 p-6"><h3 className="font-poppins text-lg font-semibold text-navy">Reasoning and Remedies</h3><p className="text-sm text-slate-700">{item.reasoningSummary}</p><ul className="list-disc pl-5 text-sm text-slate-700">{item.remedies.map((remedy: string) => <li key={remedy}>{remedy}</li>)}</ul></div></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><div className="space-y-3 p-6"><h3 className="font-poppins text-lg font-semibold text-navy">Lessons for Institutions</h3><ul className="list-disc pl-5 text-sm text-slate-700">{item.lessonsForInstitutions.map((lesson: string) => <li key={lesson}>{lesson}</li>)}</ul></div></Card>
        <Card><div className="space-y-3 p-6"><h3 className="font-poppins text-lg font-semibold text-navy">Comparable Matters</h3>{related.map((caseItem) => <p key={caseItem.id} className="text-sm text-slate-700">{caseItem.title}</p>)}</div></Card>
      </div>
    </div>
  );
}
