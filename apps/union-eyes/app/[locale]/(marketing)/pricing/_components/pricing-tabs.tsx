'use client';

/**
 * PricingTabs — client-side tabbed shell for the /pricing page.
 *
 * Compacts the long-form pricing narrative into five accessible tabs:
 *   1. "Start here"          → Assessment Ladder (entry tiers)
 *   2. "Engagement layers"   → Institutional engagement layers
 *   3. "The journey"         → 5-stage Continuity Journey
 *   4. "Why this exists"     → Continuity fragility + engagement moments
 *   5. "Procurement"         → Procurement-safe institutional commitments
 *
 * Tab state syncs with the URL hash (e.g. #engagement-layers) so individual
 * tabs are linkable from external materials (e.g. ICR page, proposals).
 *
 * Accessibility: tablist / tab / tabpanel roles, arrow-key navigation,
 * aria-selected, aria-controls, focus management.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Layers,
  Map,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirror the shapes built in page.tsx (kept local & lightweight so the
// client bundle does not need to import the full server-side copy module).
// ─────────────────────────────────────────────────────────────────────────────
export type LadderTier = {
  key: string;
  name: string;
  price: string;
  pricePosture: string;
  summary: string;
  includes: readonly string[];
  cta: string;
  ctaHref: string;
  featured: boolean;
};

export type EngagementLayer = {
  key: string;
  icon: LucideIcon;
  name: string;
  posture: string;
  layer: string;
  fit: string;
  feels: string;
  deliverables: readonly string[];
  range: string;
};

export type JourneyStep = {
  stage: string;
  name: string;
  outcome: string;
  summary: string;
};

export type NarrativeCard = { title: string; body: string };

export type PricingTabsCopy = {
  // Tab labels
  tabStartHere: string;
  tabEngagementLayers: string;
  tabJourney: string;
  tabWhy: string;
  tabProcurement: string;

  // "Start here" panel
  sectionLadderEyebrow: string;
  sectionLadderHeading: string;
  sectionLadderBody: string;
  sectionLadderFooter: string;
  ladderIncludesLabel: string;
  ladderFeaturedBadge: string;
  assessmentLadder: readonly LadderTier[];

  // "Engagement layers" panel
  section4Heading: string;
  section4Body: string;
  fitPrefix: string;
  deliverablesLabel: string;
  investmentLabel: string;
  rangeNote: string;
  unsureTitle: string;
  unsureBody: string;
  unsureCta: string;
  engagementLayers: readonly EngagementLayer[];

  // "Journey" panel
  section3Heading: string;
  section3Body: string;
  stageLabel: string;
  outcomeLabel: string;
  continuityJourney: readonly JourneyStep[];

  // "Why" panel (continuity fragility + engagement moments combined)
  section1Heading: string;
  section1Body: string;
  section2Heading: string;
  section2Body: string;
  continuityFragility: readonly NarrativeCard[];
  engagementMoments: readonly NarrativeCard[];

  // "Procurement" panel
  procurementLabel: string;
  commitmentsHeading: string;
  commitmentsBody: string;
  trustCenter: string;
  governanceStructure: string;
  institutionalProof: string;
  procurementCommitments: readonly NarrativeCard[];
};

type TabId = 'start-here' | 'engagement-layers' | 'journey' | 'why' | 'procurement';

type TabSpec = {
  id: TabId;
  label: string;
  icon: LucideIcon;
};

interface PricingTabsProps {
  locale: string;
  copy: PricingTabsCopy;
}

const VALID_TAB_IDS: readonly TabId[] = [
  'start-here',
  'engagement-layers',
  'journey',
  'why',
  'procurement',
];

function parseHashTab(hash: string): TabId | null {
  const clean = hash.replace(/^#/, '');
  return (VALID_TAB_IDS as readonly string[]).includes(clean) ? (clean as TabId) : null;
}

export default function PricingTabs({ locale, copy }: PricingTabsProps) {
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<TabId>('start-here');
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    'start-here': null,
    'engagement-layers': null,
    journey: null,
    why: null,
    procurement: null,
  });

  const tabs = useMemo<readonly TabSpec[]>(
    () => [
      { id: 'start-here', label: copy.tabStartHere, icon: Compass },
      { id: 'engagement-layers', label: copy.tabEngagementLayers, icon: Layers },
      { id: 'journey', label: copy.tabJourney, icon: Map },
      { id: 'why', label: copy.tabWhy, icon: Sparkles },
      { id: 'procurement', label: copy.tabProcurement, icon: ShieldCheck },
    ],
    [copy],
  );

  // Hydrate initial tab from URL hash (so deep links work) without forcing
  // scroll on first paint.
  useEffect(() => {
    const fromHash = parseHashTab(window.location.hash);
    if (fromHash) setActiveTab(fromHash);

    const onHashChange = () => {
      const next = parseHashTab(window.location.hash);
      if (next) setActiveTab(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const selectTab = useCallback((id: TabId, opts: { updateHash?: boolean; focus?: boolean } = {}) => {
    setActiveTab(id);
    if (opts.updateHash !== false) {
      // Use replaceState so the back button doesn't accumulate hash history.
      window.history.replaceState(null, '', `#${id}`);
    }
    if (opts.focus) {
      const btn = tabRefs.current[id];
      btn?.focus();
    }
  }, []);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
      selectTab(tabs[nextIndex].id, { focus: true });
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectTab(tabs[0].id, { focus: true });
    } else if (event.key === 'End') {
      event.preventDefault();
      selectTab(tabs[tabs.length - 1].id, { focus: true });
    }
  };

  return (
    <section className="py-14 bg-white border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tablist — sticky-ish, horizontally scrollable on small screens */}
        <div
          role="tablist"
          aria-label="Pricing sections"
          className="flex flex-wrap gap-2 mb-10 pb-3 border-b border-slate-200/80 overflow-x-auto"
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={`${baseId}-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(e) => onTabKeyDown(e, index)}
                className={
                  isActive
                    ? 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy text-white text-sm font-semibold transition-colors whitespace-nowrap'
                    : 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-navy hover:text-navy transition-colors whitespace-nowrap'
                }
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Panels */}
        <div
          id={`${baseId}-panel-start-here`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-start-here`}
          hidden={activeTab !== 'start-here'}
        >
          <StartHerePanel copy={copy} locale={locale} />
        </div>

        <div
          id={`${baseId}-panel-engagement-layers`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-engagement-layers`}
          hidden={activeTab !== 'engagement-layers'}
        >
          <EngagementLayersPanel copy={copy} locale={locale} />
        </div>

        <div
          id={`${baseId}-panel-journey`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-journey`}
          hidden={activeTab !== 'journey'}
        >
          <JourneyPanel copy={copy} />
        </div>

        <div
          id={`${baseId}-panel-why`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-why`}
          hidden={activeTab !== 'why'}
        >
          <WhyPanel copy={copy} />
        </div>

        <div
          id={`${baseId}-panel-procurement`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-procurement`}
          hidden={activeTab !== 'procurement'}
        >
          <ProcurementPanel copy={copy} locale={locale} />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panels
// ─────────────────────────────────────────────────────────────────────────────

function StartHerePanel({ copy, locale }: { copy: PricingTabsCopy; locale: string }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-navy text-white text-xs font-semibold tracking-wide uppercase mb-4">
        <Compass className="h-3.5 w-3.5" />
        {copy.sectionLadderEyebrow}
      </div>
      <h2 className="text-3xl font-semibold text-navy mb-3">{copy.sectionLadderHeading}</h2>
      <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">{copy.sectionLadderBody}</p>

      <div className="grid md:grid-cols-3 gap-5">
        {copy.assessmentLadder.map((tier) => (
          <article
            key={tier.key}
            className={
              tier.featured
                ? 'institution-panel calm-elevation p-6 flex flex-col ring-2 ring-navy/80 relative'
                : 'institution-panel calm-elevation p-6 flex flex-col'
            }
          >
            {tier.featured && (
              <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 px-3 py-1 bg-navy text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                <Sparkles className="h-3 w-3" />
                {copy.ladderFeaturedBadge}
              </div>
            )}
            <h3 className="text-lg font-semibold text-navy leading-tight mb-2">{tier.name}</h3>
            <div className="mb-1">
              <span className="text-2xl font-bold text-navy">{tier.price}</span>
            </div>
            <p className="text-xs text-slate-500 italic mb-4">{tier.pricePosture}</p>
            <p className="text-sm text-slate-700 leading-relaxed mb-5">{tier.summary}</p>

            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
              {copy.ladderIncludesLabel}
            </div>
            <ul className="space-y-2 mb-5">
              {tier.includes.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                  <CheckCircle2 className="h-4 w-4 text-[#1f5b84] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href={`/${locale}${tier.ctaHref}`}
              className={
                tier.featured
                  ? 'mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-[#1f5b84] transition-colors'
                  : 'mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-navy text-navy text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors'
              }
            >
              {tier.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-6 max-w-3xl leading-relaxed italic">{copy.sectionLadderFooter}</p>
    </div>
  );
}

function EngagementLayersPanel({ copy, locale }: { copy: PricingTabsCopy; locale: string }) {
  return (
    <div>
      <h2 className="text-3xl font-semibold text-navy mb-3">{copy.section4Heading}</h2>
      <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">{copy.section4Body}</p>

      <div className="grid md:grid-cols-2 gap-5">
        {copy.engagementLayers.map((tier) => {
          const Icon = tier.icon;
          return (
            <article key={tier.key} className="institution-panel calm-elevation p-6 flex flex-col">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-navy" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                    {tier.layer}
                  </div>
                  <h3 className="text-lg font-semibold text-navy leading-tight">{tier.name}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">
                    {tier.posture}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 italic mb-4">{tier.feels}</p>

              <p className="text-sm text-slate-700 leading-relaxed mb-5">
                <span className="font-semibold text-navy">{copy.fitPrefix}</span>
                {tier.fit}
              </p>

              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
                {copy.deliverablesLabel}
              </div>
              <ul className="space-y-2 mb-5">
                {tier.deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 text-[#1f5b84] mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-4 border-t border-slate-200/70">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  {copy.investmentLabel}
                </div>
                <p className="text-sm font-semibold text-navy">{tier.range}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{copy.rangeNote}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="institution-panel calm-elevation mt-8 p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-navy mb-1">{copy.unsureTitle}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{copy.unsureBody}</p>
        </div>
        <Link
          href={`/${locale}/contact`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-[#1f5b84] transition-colors whitespace-nowrap"
        >
          {copy.unsureCta} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function JourneyPanel({ copy }: { copy: PricingTabsCopy }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-slate-100 text-navy text-xs font-semibold tracking-wide uppercase mb-4">
        <Map className="h-3.5 w-3.5" />
        {copy.stageLabel} 1 → 5
      </div>
      <h2 className="text-3xl font-semibold text-navy mb-3">{copy.section3Heading}</h2>
      <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">{copy.section3Body}</p>

      <ol className="space-y-4">
        {copy.continuityJourney.map((step) => (
          <li
            key={step.stage}
            className="institution-panel calm-elevation p-5 flex flex-col md:flex-row md:items-start gap-4"
          >
            <div className="flex items-center gap-3 md:w-56 shrink-0">
              <div
                aria-hidden="true"
                className="w-10 h-10 rounded-full bg-navy text-white text-base font-bold flex items-center justify-center shrink-0"
              >
                {step.stage}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  {copy.stageLabel} {step.stage}
                </div>
                <div className="text-sm font-semibold text-navy leading-tight">{step.name}</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-[#1f5b84] font-semibold mb-1">
                {copy.outcomeLabel} — {step.outcome}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{step.summary}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function WhyPanel({ copy }: { copy: PricingTabsCopy }) {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-3xl font-semibold text-navy mb-3">{copy.section1Heading}</h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">{copy.section1Body}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {copy.continuityFragility.map((item) => (
            <article key={item.title} className="institution-panel calm-elevation p-5">
              <h3 className="text-sm font-semibold text-navy mb-2">{item.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-semibold text-navy mb-3">{copy.section2Heading}</h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">{copy.section2Body}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {copy.engagementMoments.map((item) => (
            <article key={item.title} className="institution-panel calm-elevation p-5">
              <h3 className="text-sm font-semibold text-navy mb-2">{item.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProcurementPanel({ copy, locale }: { copy: PricingTabsCopy; locale: string }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-slate-100 text-navy text-xs font-semibold tracking-wide uppercase mb-4">
        <ShieldCheck className="h-3.5 w-3.5" />
        {copy.procurementLabel}
      </div>
      <h2 className="text-3xl font-semibold text-navy mb-3">{copy.commitmentsHeading}</h2>
      <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">{copy.commitmentsBody}</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {copy.procurementCommitments.map((item) => (
          <article key={item.title} className="institution-panel calm-elevation p-5">
            <h3 className="text-sm font-semibold text-navy mb-2">{item.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-5">
        <Link
          href={`/${locale}/trust`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5b84] hover:text-navy transition-colors"
        >
          {copy.trustCenter} <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/${locale}/governance`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5b84] hover:text-navy transition-colors"
        >
          {copy.governanceStructure} <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/${locale}/proof`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5b84] hover:text-navy transition-colors"
        >
          {copy.institutionalProof} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
