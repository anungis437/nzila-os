export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import NewVendorClient from './NewVendorClient';

export default async function NewVendorPage() {
  await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  return <NewVendorClient />;
}
