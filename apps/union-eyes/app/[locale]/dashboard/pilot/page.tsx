export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import PilotDashboard from './pilot-dashboard';

export const metadata: Metadata = {
  title: 'Pilot Program | Union Eyes',
  description: 'Pilot health metrics, milestones, and progress tracking',
};

export default async function PilotDashboardPage() {
  await requireUser();

  const hasAccess = await hasMinRole('officer');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <PilotDashboard />;
}
