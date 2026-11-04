'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

export const dynamic = 'force-dynamic';

/**
 * Survey response page.
 *
 * A survey cannot be answered in this release. GET /api/communications/surveys/{id} answers the survey row alone: no route serves a survey's
 * questions (survey_questions has no reader for a respondent and no writer at all), and no route stores an answer (survey_answers has no
 * writer; POST .../responses creates an empty in-progress response and drops the `answers` the old form sent). The page used to read
 * `data.survey` and `data.questions` from a body that has neither, so no survey ever loaded, and its thank-you screen and "View Results"
 * button (to a page that does not exist) promised a submission nothing recorded.
 */
export default function SurveyResponsePage() {
  const t = useTranslations('surveyPage');
  const locale = useLocale();

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('surveyNotAvailableTitle')}</h1>
      <p className="text-muted-foreground">{t('surveyNotAvailableDescription')}</p>
      <CapabilityUnavailable locale={locale} capability="UE-SURVEYS-RESPOND" />
    </div>
  );
}
