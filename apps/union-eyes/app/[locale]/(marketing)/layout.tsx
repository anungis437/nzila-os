/**
 * Institutional Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (institutional memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure - non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default - every action remains
 * operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * institutional trust for democratic infrastructure.
 */
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-electric"
      >
        Skip to main content
      </a>
      <LocaleSiteNavigation />
      <main id="main-content" tabIndex={-1} className="pt-16 md:pt-20">{children}</main>
      <LocaleSiteFooter />
    </>
  );
}
