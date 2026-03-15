import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import TrusteePortalPage from '@/components/pension/trustee-portal-page';

export const dynamic = 'force-dynamic';

export default async function PensionTrusteePage() {
  await requireUser();
  await hasMinRole('member');

  return <TrusteePortalPage />;
}
