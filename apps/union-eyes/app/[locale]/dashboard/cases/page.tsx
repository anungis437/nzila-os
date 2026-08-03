import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';

/**
 * /dashboard/cases — canonical route alias for the claims list.
 *
 * Wave 3 renamed the surface to /dashboard/claims.  This page redirects
 * so that any bookmarked or linked /cases URLs continue to work.
 */
export default async function CasesRedirectPage() {
  try {
    await requireUser();
  } catch {
    redirect('/login');
  }

  redirect('/dashboard/claims');
}
