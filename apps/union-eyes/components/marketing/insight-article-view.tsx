import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PillarDiagram } from '@/components/marketing/institutional-visual-systems';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import ScrollReveal from '@/components/public/scroll-reveal';
import {
  getInstitutionalModeProfile,
  type InstitutionalMode,
  withInstitutionalContext,
} from '@/lib/institutional-context';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { getInsightHref, type InsightArticle } from '@/lib/insights-content';

interface InsightArticleViewProps {
  article: InsightArticle;
  related: InsightArticle[];
  locale?: string;
  contextMode?: InstitutionalMode;
  backHref?: string;
  backLabel?: string;
}

function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return '';
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 id={slugifyHeading(extractText(children))} className="text-3xl md:text-4xl font-semibold text-navy mt-12 mb-4 first:mt-0 tracking-tight">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 id={slugifyHeading(extractText(children))} className="text-2xl md:text-3xl font-semibold text-navy mt-10 mb-4 tracking-tight">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 id={slugifyHeading(extractText(children))} className="text-xl font-semibold text-navy mt-8 mb-3">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-base leading-8 text-slate-700 mb-5">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-6 space-y-2 mb-6 text-slate-700">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-6 space-y-2 mb-6 text-slate-700">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-7">{children}</li>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="text-[#1f5b84] underline underline-offset-4 hover:text-[#12324a]">
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-[#1f5b84]/30 pl-5 py-2 my-6 text-slate-700 italic bg-[#f2f6f9] rounded-r-xl">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-10 border-slate-200" />,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-navy">{children}</strong>
  ),
};

export function InsightArticleView({
  article,
  related,
  locale = 'en-CA',
  contextMode = 'executive',
  backHref = `/${locale}/insights`,
  backLabel = 'Back to Insights',
}: InsightArticleViewProps) {
  const profile = getInstitutionalModeProfile(contextMode);

  const methodologyByCategory: Record<string, string[]> = {
    'Institutional Continuity': [
      'Institutional Memory',
      'Governance Continuity',
      'Operational Coherence',
      'Organizational Resilience',
    ],
    'Governance Modernization': [
      'Fragmentation',
      'Coordination',
      'Explainability',
      'Alignment',
      'Continuity',
    ],
    'Explainable Governance Reasoning': [
      'Explainability Layer',
      'Human Oversight Layer',
      'Governance Review Layer',
      'Operational Transparency Layer',
      'Accountability Preservation Layer',
    ],
    'Labour-Safe AI': [
      'Human Oversight',
      'Governance Boundaries',
      'Explainable Outputs',
      'Trust Safeguards',
    ],
    'Governance Resilience': [
      'Transition Readiness',
      'Documentation Maturity',
      'Governance Explainability',
      'Continuity Redundancy',
    ],
    'Operational Fragility': [
      'Signal Detection',
      'Knowledge Distribution',
      'Process Stabilization',
      'Resilience Reinforcement',
    ],
    'Organizational Memory': [
      'Knowledge Discovery',
      'Context Mapping',
      'Institutional Structuring',
      'Continuity Operationalization',
    ],
  };

  const methodologyNodes = methodologyByCategory[article.categoryName] ?? [
    'Institutional Context',
    'Governance Visibility',
    'Continuity Alignment',
    'Strategic Resilience',
  ];

  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        revealTempo="conference"
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-[0.15em] uppercase rounded-full bg-white/15 text-white/90 border border-white/25">
            {article.categoryName} • {profile.label}
          </span>
        }
        heading={<>{article.title}</>}
        description={article.excerpt}
      />

      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f5b84] hover:text-[#12324a] transition-colors"
          >
            <span aria-hidden>←</span>
            {backLabel}
          </Link>
        </div>
      </div>

      <section className="py-10 bg-white border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 narrative-sequence">
            <div className="institution-panel px-4 py-3 text-sm text-slate-600">
              <p className="institution-kicker mb-1">Read Time</p>
              <p className="font-medium text-navy">{article.readTime}</p>
            </div>
            <div className="institution-panel px-4 py-3 text-sm text-slate-600">
              <p className="institution-kicker mb-1">Format</p>
              <p className="font-medium text-navy">{article.format}</p>
            </div>
            <div className="institution-panel px-4 py-3 text-sm text-slate-600">
              <p className="institution-kicker mb-1">Published</p>
              <p className="font-medium text-navy">{article.publishedOn}</p>
            </div>
            <div className="institution-panel px-4 py-3 text-sm text-slate-600">
              <p className="institution-kicker mb-1">Author</p>
              <p className="font-medium text-navy">{article.author}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600 max-w-3xl">Best for: {article.audience}</p>
        </div>
      </section>

      <section className="py-14 bg-[#f8f6f2]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-10">
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 lg:self-start narrative-sequence">
            <div className="institution-panel p-6">              <h2 className="text-sm font-semibold text-navy mb-4">Executive Summary Anchors</h2>
              <ul className="space-y-3">
                {article.takeaways.map((takeaway) => (
                  <li key={takeaway} className="text-sm text-slate-700 leading-relaxed">
                    {takeaway}
                  </li>
                ))}
              </ul>
            </div>

            <div className="institution-panel p-6">              <h2 className="text-sm font-semibold text-navy mb-4">On this page</h2>
              <ul className="space-y-2 text-sm text-slate-700">
                {article.headings.map((heading) => (
                  <li key={heading} className="leading-relaxed">
                    <a href={`#${slugifyHeading(heading)}`} className="hover:text-[#1f5b84] transition-colors">
                      {heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="institution-panel p-6">              <p className="text-sm text-slate-700 leading-relaxed">
                This publication is designed for governance-safe modernization: explainable rationale, human oversight, and continuity-first implementation.
              </p>
            </div>

            <div className="institution-panel p-6">              <h2 className="text-sm font-semibold text-navy mb-4">Visual execution pathway</h2>
              <PillarDiagram nodes={methodologyNodes} compact />
            </div>

            <div className="continuity-quote">
              <p className="institution-kicker mb-2">Continuity Principle</p>
              <p className="text-sm text-slate-700 leading-relaxed">
                Institutional trust is preserved when governance knowledge moves safely through time, people, and decisions.
              </p>
            </div>
          </aside>

          <article className="lg:col-span-8 institution-panel p-6 sm:p-10 continuity-guidance-shell">
            <span className="continuity-divider" aria-hidden />

            <div className="continuity-quote mb-8">
              <p className="text-sm md:text-base font-medium text-navy leading-relaxed">
                This doctrine brief translates fragmentation risk into continuity clarity through explainable governance pathways.
              </p>
            </div>

            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {article.bodyMarkdown}
            </ReactMarkdown>

            <span className="continuity-divider" aria-hidden />

            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="continuity-ring-muted" aria-hidden />
              <p className="leading-relaxed">
                Continuity marker: this publication aligns with explainability, governance accountability, and leadership transition resilience.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="py-16 bg-white border-y border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.03} duration={0.8} distance={12} tempo="conference">          </ScrollReveal>
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-2xl font-semibold text-navy mb-8 text-center">Continue the strategic reading path</h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-4 narrative-sequence">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={withInstitutionalContext(getInsightHref(item.slug, locale), contextMode)}
                className="institution-panel calm-elevation block p-5"
              >
                <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 mb-3">
                  {item.categoryName}
                </span>
                <h3 className="text-sm font-bold text-navy mb-2 leading-snug">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal delay={0.02} duration={0.75} distance={12} tempo="conference">
            <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">Strategic Application</p>
          </ScrollReveal>
          <ScrollReveal delay={0.08} duration={0.9} distance={16} tempo="conference">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">Apply this framework in your governance context</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-white/80 mb-8 leading-relaxed">
              Request an executive briefing tailored to your continuity obligations, governance structure, and modernization roadmap.
            </p>
          </ScrollReveal>
          <div className="flex flex-col sm:flex-row gap-4 justify-center narrative-sequence">
            <Link
              href="/pilot-request"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              Book an Executive Briefing
            </Link>
            <Link
              href={backHref}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-transparent text-white font-medium rounded-xl border border-white/40 hover:bg-white/10 transition-all"
            >
              {backLabel}
            </Link>
          </div>
        </div>
      </section>

      <div className="fixed bottom-4 right-4 z-40 lg:hidden">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-full bg-[#1f5b84] px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          <span aria-hidden>←</span>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
