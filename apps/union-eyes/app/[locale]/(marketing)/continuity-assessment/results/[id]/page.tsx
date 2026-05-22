/**
 * ARTIFACT TYPE: Next.js Page
 * DOCTRINE_VERSION: 1.0.0
 *
 * Results page — fetches profile from DB and renders ICRAProfile.
 * Fully public. No auth. Accessible via the unique link provided after
 * assessment submission.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getIcraProfile } from '@/actions/icra/get-profile';
import { ICRAProfile } from '@/components/icra/ICRAProfile';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  return {
    title: 'Your Continuity Profile | Union Eyes',
    description: 'Your OCI Continuity Risk Assessment results.',
    alternates: buildLocaleAlternates(locale, `/continuity-assessment/results/${id}`),
    robots: { index: false },
  };
}

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tierUnlocked = typeof sp.tier_unlocked === 'string' ? sp.tier_unlocked : null;

  if (!id || !UUID_RE.test(id)) notFound();

  const profile = await getIcraProfile(id);
  if (!profile) notFound();

  const tierLabel: Record<string, string> = {
    executive_continuity_brief: 'Executive Continuity Brief',
    institutional_continuity_diagnostic: 'Institutional Continuity Diagnostic',
  };

  return (
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-16 md:pt-20">
      <div className="mb-8">
        <Link
          href="/continuity-assessment"
          className="text-sm text-stone-500 hover:text-stone-800"
        >
          ← About this assessment
        </Link>
      </div>

      {tierUnlocked && tierLabel[tierUnlocked] && (
        <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-800">
          <span className="font-semibold">{tierLabel[tierUnlocked]}</span> unlocked.{' '}
          Your full report is now available below.
        </div>
      )}

      <ICRAProfile profile={profile} tierId={profile.reportTierId} />
    </main>
  );
}
