import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { and, eq } from 'drizzle-orm';
import { exitInterviews } from '@/db/schema';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ExitInterviewDetailPage({ params }: PageProps) {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const [item] = await db
    .select()
    .from(exitInterviews)
    .where(and(eq(exitInterviews.id, id), eq(exitInterviews.organizationId, user.organizationId ?? '')))
    .limit(1);

  if (!item) {
    notFound();
  }

  return (
    <section className="space-y-6 rounded-lg border bg-card p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
        <p className="text-sm text-muted-foreground">
          {item.retiringEmployeeName} · {item.roleInUnion} · {item.yearsOfService} years
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
