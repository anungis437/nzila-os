import Link from 'next/link';
import {
  institutionalModes,
  type InstitutionalMode,
  withInstitutionalContext,
} from '@/lib/institutional-context';

export type InsightsHubSection = {
  key: 'overview' | 'doctrine' | 'methodology' | 'resonance' | 'categories';
  label: string;
  href: (locale: string) => string;
  description: string;
};

export const insightsHubSections: InsightsHubSection[] = [
  {
    key: 'overview',
    label: 'Overview',
    href: (locale) => `/${locale}/insights`,
    description: 'The executive hub and current doctrine highlights.',
  },
  {
    key: 'doctrine',
    label: 'Doctrine',
    href: (locale) => `/${locale}/insights/doctrine`,
    description: 'Editorial standards, storytelling, and featured publications.',
  },
  {
    key: 'methodology',
    label: 'Methodology',
    href: (locale) => `/${locale}/insights/methodology`,
    description: 'Canonical frameworks and continuity visualization.',
  },
  {
    key: 'resonance',
    label: 'Resonance',
    href: (locale) => `/${locale}/insights/resonance`,
    description: 'Emotional memory anchors and executive trust language.',
  },
  {
    key: 'categories',
    label: 'Categories',
    href: (locale) => `/${locale}/insights/categories`,
    description: 'Browse the governance domains and topic pathways.',
  },
];

type InsightsHubSubmenuProps = {
  locale: string;
  active: InsightsHubSection['key'];
  contextMode?: InstitutionalMode;
};

export function InsightsHubSubmenu({
  locale,
  active,
  contextMode = 'executive',
}: InsightsHubSubmenuProps) {
  const modeLabel: Record<InstitutionalMode, string> = {
    executive: 'Executive',
    governance: 'Governance',
    operations: 'Operations',
    procurement: 'Procurement',
    conference: 'Conference',
  };

  const modeConcern: Record<InstitutionalMode, string> = {
    executive: 'Continuity and resilience',
    governance: 'Explainability and accountability',
    operations: 'Coordination and organizational coherence',
    procurement: 'Trust and reviewability',
    conference: 'Narrative simplicity and memorability',
  };

  const activeSection = insightsHubSections.find((section) => section.key === active);

  return (
    <nav className="border-b border-slate-200/70 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Context Mode: {modeLabel[contextMode]}
          </p>
          <p className="text-xs text-slate-500 truncate">{modeConcern[contextMode]}</p>
        </div>

        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {institutionalModes.map((mode) => {
            const isActiveMode = mode === contextMode;
            const activeHref = activeSection ? activeSection.href(locale) : `/${locale}/insights`;

            return (
              <Link
                key={mode}
                href={withInstitutionalContext(activeHref, mode)}
                aria-current={isActiveMode ? 'true' : undefined}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActiveMode
                    ? 'border-[#1f5b84] bg-[#1f5b84] text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#12324a]'
                }`}
              >
                {modeLabel[mode]}
              </Link>
            );
          })}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {insightsHubSections.map((section) => {
            const isActive = section.key === active;

            return (
              <Link
                key={section.key}
                href={withInstitutionalContext(section.href(locale), contextMode)}
                aria-current={isActive ? 'page' : undefined}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-[#1f5b84] bg-[#1f5b84] text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#12324a]'
                }`}
              >
                {section.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
