import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { ExecutiveToday } from '@/components/executive/executive-today';
import { buildExecutiveToday, getTodayCopy, hasVerifiedMandate } from '@/lib/executive/today';
import { getLeadershipDashboardMetrics } from '@/lib/services/dashboard-kpi-service';
import { emitCapeAuditEvent, CAPE_AUDIT_EVENTS } from '@/lib/audit/cape-audit-events';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${getTodayCopy(locale).title} · UnionEyes` };
}

export default async function ExecutiveTodayPage({ params }: PageProps) {
  const { locale } = await params;

  let user;
  try {
    user = await requireUser();
  } catch {
    redirect('/login');
  }

  // Same floor as the leadership aggregates that feed this page. Presentation
  // never grants access; this is the server-side guard.
  if (!(await hasMinRole('officer'))) {
    redirect('/dashboard');
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    redirect('/dashboard');
  }

  let metrics: Awaited<ReturnType<typeof getLeadershipDashboardMetrics>> | null = null;
  let sourceError = false;
  try {
    metrics = await getLeadershipDashboardMetrics({ organizationId, timeframe: 'monthly' });
  } catch (error) {
    sourceError = true;
    logger.warn('Executive Today source unavailable', { error: String(error) });
  }

  if (metrics) {
    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.LEADERSHIP_REPORT_VIEWED,
      userId: user.userId,
      organizationId,
      resource: 'executive_today',
      details: { timeframe: 'monthly' },
    }).catch((error) => logger.warn('Executive Today audit event failed', { error: String(error) }));
  }

  const model = buildExecutiveToday({
    metrics,
    mandatePresent: await hasVerifiedMandate(user.userId, organizationId),
    canSeeFinance: await hasMinRole('secretary_treasurer'),
  });

  return <ExecutiveToday locale={locale} model={model} sourceError={sourceError} />;
}
