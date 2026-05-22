/**
 * ARTIFACT TYPE: Next.js Page
 * DOCTRINE_VERSION: 1.0.0
 *
 * Assessment entry page — mounts the ICRAAssessmentFlow client component.
 * Fully public. No auth. Renders under the standalone branded layout
 * (no marketing chrome) for a focused, distraction-free experience.
 */

import type { Metadata } from 'next';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { ICRAAssessmentFlow } from '@/components/icra/ICRAAssessmentFlow';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const METADATA_COPY = {
  'en-CA': {
    title: 'Begin Assessment | OCI Continuity Risk Assessment | Union Eyes',
    description:
      'Complete your OCI Continuity Risk Assessment. Takes 15-25 minutes. No account required.',
  },
  'fr-CA': {
    title: "Commencer l'évaluation | Évaluation du risque de continuité institutionnelle | Union Eyes",
    description:
      "Complétez votre évaluation du risque de continuité institutionnelle. Prévoir 15 à 25 minutes. Aucun compte requis.",
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const copy = METADATA_COPY[locale as keyof typeof METADATA_COPY] ?? METADATA_COPY['en-CA'];
  return {
    title: copy.title,
    description: copy.description,
    alternates: buildLocaleAlternates(locale, '/continuity-assessment/start'),
    robots: { index: false },
  };
}

export default async function AssessmentStartPage({ params }: PageProps) {
  const { locale } = await params;

  return (
    <div className="mx-auto max-w-4xl px-6 pb-24 pt-12 md:pt-16">
      <ICRAAssessmentFlow locale={locale} />
    </div>
  );
}
