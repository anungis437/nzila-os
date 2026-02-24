export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { listRecognitionPrograms } from '@/actions/rewards-actions';
import { ProgramsList } from '@/components/rewards/admin/programs-list';
import { CreateProgramDialog } from '@/components/rewards/admin/create-program-dialog';

export const metadata: Metadata = {
  title: 'Recognition Programs | Admin',
  description: 'Manage recognition programs and award types',
};

export default async function AdminProgramsPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const t = await getTranslations('rewards.admin.programs');

  // Fetch programs
  const programsResult = await listRecognitionPrograms();
  const programs = programsResult.success ? programsResult.data || [] : [];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <Link
            href="/dashboard/admin/rewards"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← {t('backToAdmin', { defaultValue: 'Back to Admin' })}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('title', { defaultValue: 'Recognition Programs' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('description', {
              defaultValue: 'Create and manage recognition programs and their award types',
            })}
          </p>
        </div>
        <CreateProgramDialog />
      </div>

      {/* Programs List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('list.title', { defaultValue: 'All Programs' })}
          </CardTitle>
          <CardDescription>
            {t('list.description', {
              defaultValue: 'Configure programs, award types, and approval workflows',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProgramsList programs={programs} />
        </CardContent>
      </Card>
    </div>
  );
}
