/**
 * Locale Marketing Layout
 * Provides locale-aware SiteNavigation + SiteFooter for all
 * locale-prefixed marketing pages (/fr-CA/story, /fr-CA/pricing, etc.)
 *
 * NextIntlClientProvider is inherited from app/[locale]/layout.tsx.
 */
import LocaleSiteNavigation from './locale-site-navigation';
import LocaleSiteFooter from './locale-site-footer';

export default function LocaleMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LocaleSiteNavigation />
      <main className="pt-16 md:pt-20">{children}</main>
      <LocaleSiteFooter />
    </>
  );
}
