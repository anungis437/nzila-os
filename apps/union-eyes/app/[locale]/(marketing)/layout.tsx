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
      <LocaleSiteNavigation />
      <main className="pt-16 md:pt-20">{children}</main>
      <LocaleSiteFooter />
    </>
  );
}
