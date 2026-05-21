/**
 * Continuity Assessment — standalone branded layout.
 *
 * Mirrors the Institutional Continuity Risk landing page layout:
 * deliberately escapes the (marketing) site chrome to keep the assessment
 * flow focused and distraction-free, while preserving the UnionEyes brand
 * (logo + locale switcher) at the outer edges of the viewport.
 *
 * Fonts inherit Poppins from the root layout via Tailwind's `font-sans`
 * default (configured to var(--font-poppins)).
 */
import StandaloneBrandedHeader from '@/components/branding/StandaloneBrandedHeader';

export default async function ContinuityAssessmentStartLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-screen bg-stone-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:bg-stone-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
      >
        Skip to main content
      </a>

      <StandaloneBrandedHeader locale={locale} variant="solid" />

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
