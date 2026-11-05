/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (organizational memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * organizational trust for democratic infrastructure.
 *
 * Case study coordination surface
 *
 * Coordination posture: representation workflow, case management, intake choreography,
 * and operational coordination across federation, leadership, member, and staff touchpoints.
 *
 * Governance posture: bylaw-aligned procedural cadence, constitutional consistency,
 * accountability surfaces, and compliance choreography across jurisdictions and mandates.
 *
 * Continuity posture: organizational memory preservation, succession-aware handoff,
 * stewardship of representational records, and procedural continuity across mandates.
 */
/**
 * Locale-aware Case Studies page
 * Accessible at /{locale}/case-studies
 */
'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CaseStudy } from '@/types/marketing';
import { CASE_STUDIES_VISIBLE } from '@/lib/marketing-feature-flags';
import { CaseStudyGrid } from '@/components/marketing/case-study-card';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { logger } from '@/lib/logger';
import { envelopeRows } from '@/lib/client/api-envelope';

const CASE_STUDIES_COPY: Record<string, {
  loading: string;
  failed: string;
  category: string;
  orgType: string;
  all: string;
  empty: string;
  ctaBody: string;
  ctaButton: string;
}> = {
  'en-CA': {
    loading: 'Loading case studies...',
    failed: 'Case studies could not be loaded. Please try again later.',
    category: 'Category',
    orgType: 'Org type',
    all: 'All',
    empty: 'No case studies match your filters. Try adjusting your selections.',
    ctaBody: 'Your organization could be the next guided rollout.',
    ctaButton: 'Start a guided review',
  },
  'fr-CA': {
    loading: 'Chargement des etudes de cas...',
    failed: "Les etudes de cas n'ont pas pu etre chargees. Veuillez reessayer plus tard.",
    category: 'Categorie',
    orgType: "Type d'organisation",
    all: 'Toutes',
    empty: 'Aucune etude de cas ne correspond a vos filtres. Essayez dajuster vos selections.',
    ctaBody: 'Votre organisation pourrait etre le prochain deploiement guide.',
    ctaButton: 'Faire le bilan',
  },
  it: {
    loading: 'Caricamento dei casi studio...',
    failed: 'Impossibile caricare i casi studio. Riprova piu tardi.',
    category: 'Categoria',
    orgType: 'Tipo di organizzazione',
    all: 'Tutte',
    empty: 'Nessun caso studio corrisponde ai filtri selezionati. Prova a modificarli.',
    ctaBody: 'La tua organizzazione potrebbe essere il prossimo deployment controllato.',
    ctaButton: 'Avvia un pilota controllato',
  },
  pt: {
    loading: 'Carregando estudos de caso...',
    failed: 'Nao foi possivel carregar os estudos de caso. Tente novamente mais tarde.',
    category: 'Categoria',
    orgType: 'Tipo de organizacao',
    all: 'Todas',
    empty: 'Nenhum estudo de caso corresponde aos filtros selecionados. Tente ajusta-los.',
    ctaBody: 'Sua organizacao pode ser a proxima implantacao controlada.',
    ctaButton: 'Iniciar um piloto controlado',
  },
};

export default function LocaleCaseStudiesPage() {
  if (!CASE_STUDIES_VISIBLE) {
    notFound();
  }
  const params = useParams();
  const locale = (params.locale as string) ?? 'en-CA';
  const t = useTranslations('marketing.caseStudies');
  const copy = CASE_STUDIES_COPY[locale] ?? CASE_STUDIES_COPY['en-CA'];

  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [filteredStudies, setFilteredStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedOrgType, setSelectedOrgType] = useState<string>('all');

  useEffect(() => {
    async function loadCaseStudies() {
      try {
        const response = await fetch('/api/case-studies?status=published');
        if (!response.ok) throw new Error(`Case studies answered ${response.status}`);
        const studies = envelopeRows(await response.json()) as CaseStudy[];
        setCaseStudies(studies);
        setFilteredStudies(studies);
      } catch (error) {
        logger.error('Failed to load case studies:', error);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }
    loadCaseStudies();
  }, []);

  useEffect(() => {
    let filtered = [...caseStudies];
    if (selectedCategory !== 'all') filtered = filtered.filter((cs) => cs.category === selectedCategory);
    if (selectedOrgType !== 'all') filtered = filtered.filter((cs) => cs.organizationType === selectedOrgType);
    setFilteredStudies(filtered);
  }, [caseStudies, selectedCategory, selectedOrgType]);

  const categories = ['all', ...new Set(caseStudies.map((cs) => cs.category))];
  const orgTypes = ['all', ...new Set(caseStudies.map((cs) => cs.organizationType))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600">{copy.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Hero Section with Imagery */}
      <MarketingHeroSection
        imageUrl={heroImagery.caseStudies}
        heading={t('heroHeading')}
        description={t('heroDescription')}
      />

      <div className="max-w-7xl mx-auto mt-12">

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          <FilterSelect
            label={copy.category}
            value={selectedCategory}
            options={categories}
            allLabel={copy.all}
            onChange={setSelectedCategory}
          />
          <FilterSelect
            label={copy.orgType}
            value={selectedOrgType}
            options={orgTypes}
            allLabel={copy.all}
            onChange={setSelectedOrgType}
          />
        </div>

        {/* Results */}
        {failed ? (
          <div className="text-center py-12" role="alert">
            <p className="text-red-700">{copy.failed}</p>
          </div>
        ) : filteredStudies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">{copy.empty}</p>
          </div>
        ) : (
          <CaseStudyGrid caseStudies={filteredStudies} />
        )}

        {/* Callout */}
        <div className="mt-16">
          <HumanCenteredCallout />
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-lg text-gray-600 mb-4">
            {copy.ctaBody}
          </p>
          <Link
            href={`/${locale}/organizational-continuity-risk`}
            className="inline-flex items-center px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 transition-colors"
          >
            {copy.ctaButton}
          </Link>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (v: string) => void;
}) {
  if (options.length <= 1) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <span className="font-medium">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === 'all' ? allLabel : opt}
          </option>
        ))}
      </select>
    </label>
  );
}
