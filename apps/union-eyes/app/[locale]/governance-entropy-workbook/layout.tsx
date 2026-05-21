/**
 * Governance Entropy Workbook \u2014 standalone landing layout.
 *
 * Mirrors the ICRA landing layout pattern: escapes the (marketing) layout
 * and provides a minimal branded top bar so the page can stand on its
 * own visually.
 */
import StandaloneBrandedHeader from '@/components/branding/StandaloneBrandedHeader';

export default async function GovernanceEntropyWorkbookLayout({
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
