import Link from 'next/link';
import {
  type InstitutionalMode,
  withInstitutionalContext,
} from '@/lib/institutional-context';

export type InsightsHubSection = {
  key: 'overview' | 'doctrine' | 'methodology' | 'resonance' | 'categories';
  label: string;
  href: (locale: string) => string;
  description: string;
};

export function getInsightsHubSections(locale: string): InsightsHubSection[] {
  const fr = locale === 'fr-CA';

  return [
    {
      key: 'overview',
      label: fr ? 'Apercu' : 'Overview',
      href: (value) => `/${value}/insights`,
      description: fr
        ? 'Le carrefour executif et les points forts doctrinaux du moment.'
        : 'The executive hub and current doctrine highlights.',
    },
    {
      key: 'doctrine',
      label: fr ? 'Doctrine' : 'Doctrine',
      href: (value) => `/${value}/insights/doctrine`,
      description: fr
        ? 'Normes editoriales, narration et publications en vedette.'
        : 'Editorial standards, storytelling, and featured publications.',
    },
    {
      key: 'methodology',
      label: fr ? 'Methodologie' : 'Methodology',
      href: (value) => `/${value}/insights/methodology`,
      description: fr
        ? 'Cadres canoniques et visualisation de continuite.'
        : 'Canonical frameworks and continuity visualization.',
    },
    {
      key: 'resonance',
      label: fr ? 'Resonance' : 'Resonance',
      href: (value) => `/${value}/insights/resonance`,
      description: fr
        ? 'Ancrages de memoire emotionnelle et langage de confiance executive.'
        : 'Emotional memory anchors and executive trust language.',
    },
    {
      key: 'categories',
      label: fr ? 'Categories' : 'Categories',
      href: (value) => `/${value}/insights/categories`,
      description: fr
        ? 'Parcourir les domaines de gouvernance et les parcours thematiques.'
        : 'Browse the governance domains and topic pathways.',
    },
  ];
}

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
  const sections = getInsightsHubSections(locale);

  return (
    <nav className="border-b border-slate-200/70 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((section) => {
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
