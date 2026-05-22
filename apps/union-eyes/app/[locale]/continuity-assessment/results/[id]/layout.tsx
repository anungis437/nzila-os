/**
 * Continuity Assessment Results — standalone enterprise layout.
 *
 * Escapes the (marketing) site chrome so paid results read as an executive
 * deliverable rather than a marketing page. Carries the UnionEyes brand
 * (standalone branded header) and a discreet enterprise footer.
 *
 * Fonts: Poppins inherits from the root layout (font-sans = var(--font-poppins)).
 */
import Link from 'next/link';
import StandaloneBrandedHeader from '@/components/branding/StandaloneBrandedHeader';

export default async function ContinuityAssessmentResultsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 font-sans antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:bg-stone-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
      >
        Skip to main content
      </a>

      <StandaloneBrandedHeader locale={locale} variant="solid" />

      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>

      {/* Enterprise footer — deliberately minimal, no marketing nav. */}
      <footer className="mt-16 border-t border-stone-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-xs text-stone-500 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-medium text-stone-700">
              UnionEyes &middot; Institutional Continuity Intelligence
            </p>
            <p>
              &copy; {year} UnionEyes. Canadian-hosted &middot; Bilingual-first &middot; Doctrine v1.0.0
            </p>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href={`/${locale}/legal/privacy`}
              className="hover:text-stone-900 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href={`/${locale}/legal/terms`}
              className="hover:text-stone-900 transition-colors"
            >
              Terms
            </Link>
            <Link
              href={`/${locale}/trust`}
              className="hover:text-stone-900 transition-colors"
            >
              Trust &amp; Sovereignty
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="hover:text-stone-900 transition-colors"
            >
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
