/**
 * Admin Duplicate Review Panel (§8)
 * Server component — auth guard, delegates to client console.
 */
export const dynamic = 'force-dynamic';

import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import DuplicateReviewConsole from '@/components/admin/duplicate-review-console';

export default async function AdminDuplicatesPage() {
  await requireUser();
  const isAdmin = await hasMinRole('admin');
  if (!isAdmin) redirect('/dashboard');

  return <DuplicateReviewConsole />;
}
