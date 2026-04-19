import { auth } from '@nzila/platform-auth/entra/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { resolveDemoContext } from '@/lib/demo-mode';
import {
  getLearningAnalyticsSummary,
  listLearningAssignments,
  listLearningCohorts,
  listLearningCourses,
  listLearningRecommendations,
  listLearningTracks,
} from '@/modules/learning/service';

export default async function LearningPage({
  searchParams,
}: {
  searchParams?: Promise<{ demo?: string; org?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const t = await getTranslations('abrDashboard.learning');
  const demo = resolveDemoContext((await searchParams) ?? undefined);
  const orgId = demo.organizationId;
  const tracks = listLearningTracks(orgId);
  const assignments = listLearningAssignments(orgId);
  const cohorts = listLearningCohorts(orgId);
  const courses = listLearningCourses();
  const recommendations = listLearningRecommendations();
  const analytics = getLearningAnalyticsSummary(orgId);

  return (
    <div className="space-y-6">
      {demo.enabled ? (
        <div className="rounded-2xl border border-electric/20 bg-electric/5 px-5 py-4 text-sm text-navy">
          {t('banner', { organization: demo.organizationName })}
        </div>
      ) : null}

      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{t('title')}</h2>
        <p className="mt-1 text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('completionRate')}</p><p className="mt-2 font-poppins text-xl text-navy">{analytics.completionRate}%</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('renewalsDue')}</p><p className="mt-2 font-poppins text-xl text-navy">{analytics.renewalDueCount}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('certificates')}</p><p className="mt-2 font-poppins text-xl text-navy">{analytics.downloadableCertificates}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">{t('overdueAssignments')}</p><p className="mt-2 font-poppins text-xl text-navy">{analytics.overdueAssignments}</p></div></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {tracks.map((track) => (
          <Card key={track.id}>
            <div className="space-y-2 p-6">
              <h3 className="font-poppins text-base font-semibold text-navy">{track.title}</h3>
              <p className="text-sm text-slate-600">{t('owner')}: {track.owner}</p>
              <p className="text-sm text-slate-600">{t('audience')}: {track.audience}</p>
              <p className="text-sm text-slate-700">{t('completion')}: {track.completionRate}%</p>
              <p className="text-xs text-slate-500">{t('recertification', { days: track.recertificationWindowDays })}</p>
              <p className="text-xs text-electric">{t('certificate')}: {track.certificateTemplate}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="space-y-3 p-6">
            <h3 className="font-poppins text-lg font-semibold text-navy">{t('courses')}</h3>
            {courses.map((course) => (
              <p key={course.id} className="text-sm text-slate-700">{course.title} • {course.durationMinutes} min</p>
            ))}
          </div>
        </Card>
        <Card>
          <div className="space-y-3 p-6">
            <h3 className="font-poppins text-lg font-semibold text-navy">{t('cohorts')}</h3>
            {cohorts.map((cohort) => (
              <p key={cohort.id} className="text-sm text-slate-700">{cohort.name} • {cohort.memberCount} • {cohort.completionRate}%</p>
            ))}
          </div>
        </Card>
        <Card>
          <div className="space-y-3 p-6">
            <h3 className="font-poppins text-lg font-semibold text-navy">{t('recommendations')}</h3>
            {recommendations.map((item) => (
              <p key={item.recommendedCourseId} className="text-sm text-slate-700">{item.incidentCategory}: {item.reason}</p>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-3 p-6">
          <h3 className="font-poppins text-lg font-semibold text-navy">{t('assignments')}</h3>
          {assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700">
              {assignment.userId} • {assignment.courseId} • {assignment.status} • {t('due')} {assignment.dueDate}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
