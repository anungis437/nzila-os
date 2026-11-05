import { notFound, redirect } from 'next/navigation';
import { hasMinRole } from '@/lib/api-auth-guard';
import { requireOrganizationScope } from '@/lib/page-data/organization-scope';
import { readExitInterview } from '@/lib/knowledge-transfer/governance/read-interview';
import { checkModuleEntitlement, PLATFORM_MODULES } from '@/services/platform-economics/entitlement-guard';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ExitInterviewDetailPage({ params }: PageProps) {
  const { userId, organizationId } = await requireOrganizationScope();
  const { id } = await params;

  // The detail page is for officers and above, as the index and the creation page are (the persona matrix). The interview's own sensitivity
  // floor, consent flag and workflow state then apply on top, as they do in the API.
  if (!(await hasMinRole('officer'))) {
    redirect('/dashboard');
  }

  // The same module the interview API requires.
  if (!(await checkModuleEntitlement(organizationId, PLATFORM_MODULES.UNION_KNOWLEDGE_SUITE)).allowed) {
    redirect('/dashboard');
  }

  // Sensitivity floor, consent and workflow state apply here as they do in the API: an interview the reader may not read is not found.
  const item = await readExitInterview({
    organizationId,
    userId,
    interviewId: id,
    // The officer floor above includes the steward floor.
    stewardPlus: true,
    hasMinRole,
  });

  if (!item) {
    notFound();
  }

  return (
    <section className="space-y-6 rounded-lg border bg-card p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
        <p className="text-sm text-muted-foreground">
          {[item.retiringEmployeeName, item.roleInUnion, item.yearsOfService != null ? `${item.yearsOfService} years` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <div className="space-y-4 text-sm">
        {item.summary ? (
          <div>
            <h2 className="font-semibold">Summary</h2>
            <p className="mt-1 whitespace-pre-wrap">{item.summary}</p>
          </div>
        ) : null}

        <div>
          <h2 className="font-semibold">Key lessons</h2>
          <p className="mt-1 whitespace-pre-wrap">{item.keyLessons}</p>
        </div>

        {item.bestPractices ? (
          <div>
            <h2 className="font-semibold">Best practices</h2>
            <p className="mt-1 whitespace-pre-wrap">{item.bestPractices}</p>
          </div>
        ) : null}

        {item.bargainingAdvice ? (
          <div>
            <h2 className="font-semibold">Bargaining advice</h2>
            <p className="mt-1 whitespace-pre-wrap">{item.bargainingAdvice}</p>
          </div>
        ) : null}

        {item.mediationAdvice ? (
          <div>
            <h2 className="font-semibold">Mediation advice</h2>
            <p className="mt-1 whitespace-pre-wrap">{item.mediationAdvice}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
