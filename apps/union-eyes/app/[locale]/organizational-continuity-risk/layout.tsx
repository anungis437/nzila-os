/**
 * Institutional Continuity Risk — standalone landing layout.
 *
 * Deliberately escapes the (marketing) layout. The ICRA landing page is a
 * focused, distraction-free institutional surface: it does not carry the
 * full marketing site navigation or footer, but remains branded with a
 * minimal top bar (UnionEyes logo + locale switcher).
 *
 * Fonts inherit Poppins from the root layout via Tailwind's
 * `font-sans` default (configured to var(--font-poppins)).
 */
import StandaloneBrandedHeader from '@/components/branding/StandaloneBrandedHeader';

export default async function InstitutionalContinuityRiskLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:bg-stone-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
      >
        Skip to main content
      </a>

      <StandaloneBrandedHeader locale={locale} variant="overlay" />

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
