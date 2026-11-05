/**
 * Member Case Timeline Page
 *
 * Not available. The page used to fetch /api/cases/{caseId}/timeline from the server without forwarding the member's credentials and to read
 * `data.timeline`, a case-journey object the route never sends: it answers { data: [updates] } (and names the person who wrote each update).
 * Every visit therefore ended in notFound(), and nothing links to the page. Until a member-safe source of the case's stages exists, the page
 * says so instead of pretending to be a case that was not found.
 */

export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

interface TimelinePageProps {
  params: Promise<{
    locale: string;
    caseId: string;
  }>;
}

export default async function CaseTimelinePage({ params }: TimelinePageProps) {
  const { locale } = await params;

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <CapabilityUnavailable locale={locale} capability="UE-MEMBER-CASE-TIMELINE" />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: TimelinePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'memberTimelinePage.metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}
