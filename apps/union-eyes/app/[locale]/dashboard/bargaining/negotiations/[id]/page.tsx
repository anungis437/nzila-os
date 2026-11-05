/**
 * Single negotiation view: not available.
 *
 * The page used to fetch /api/bargaining/negotiations/{id} from the server without forwarding the person's credentials, so the route (which requires them) refused it and
 * every visit ended in notFound(); and it read `negotiation`, `proposals`, `tentativeAgreements`, `sessions`, `teamMembers` and `statistics` from one answer, a shape no route
 * sends (the negotiation, its proposals and its tentative agreements are separate routes). The seven components that drew that answer are removed with it. Until a view is built
 * from the routes that exist, the page says so instead of pretending the negotiation was not found.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Button } from '@/components/ui/button';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function NegotiationDetailPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'bargainingNegotiationsDetailPage' });
  await requireUser();
  if (!(await hasMinRole('bargaining_committee'))) redirect(`/${locale}/dashboard`);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${locale}/dashboard/bargaining`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToDashboard')}
        </Link>
      </Button>
      <CapabilityUnavailable locale={locale} capability="UE-BARGAINING-NEGOTIATION-DETAIL" />
    </div>
  );
}
