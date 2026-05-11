/**
 * Locale-aware Case Studies page
 * Accessible at /{locale}/case-studies
 */
'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CaseStudy } from '@/types/marketing';
import { CaseStudyGrid } from '@/components/marketing/case-study-card';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { logger } from '@/lib/logger';

const CASE_STUDIES_COPY: Record<string, {
  loading: string;
  category: string;
  sector: string;
  orgType: string;
  jurisdiction: string;
  all: string;
  empty: string;
  ctaBody: string;
  ctaButton: string;
}> = {
  'en-CA': {
    loading: 'Loading case studies...',
    category: 'Category',
    sector: 'Sector',
    orgType: 'Org type',
    jurisdiction: 'Jurisdiction',
    all: 'All',
    empty: 'No case studies match your filters. Try adjusting your selections.',
    ctaBody: 'Your organization could be the next controlled deployment.',
    ctaButton: 'Start a Controlled Pilot',
  },
  'fr-CA': {
    loading: 'Chargement des etudes de cas...',
    category: 'Categorie',
    sector: 'Secteur',
    orgType: "Type d'organisation",
    jurisdiction: 'Juridiction',
    all: 'Toutes',
    empty: 'Aucune etude de cas ne correspond a vos filtres. Essayez dajuster vos selections.',
    ctaBody: 'Votre organisation pourrait etre le prochain deploiement controle.',
    ctaButton: 'Demarrer un pilote controle',
  },
  it: {
    loading: 'Caricamento dei casi studio...',
    category: 'Categoria',
    sector: 'Settore',
    orgType: 'Tipo di organizzazione',
    jurisdiction: 'Giurisdizione',
    all: 'Tutte',
    empty: 'Nessun caso studio corrisponde ai filtri selezionati. Prova a modificarli.',
    ctaBody: 'La tua organizzazione potrebbe essere il prossimo deployment controllato.',
    ctaButton: 'Avvia un pilota controllato',
  },
  pt: {
    loading: 'Carregando estudos de caso...',
    category: 'Categoria',
    sector: 'Setor',
    orgType: 'Tipo de organizacao',
    jurisdiction: 'Jurisdicao',
    all: 'Todas',
    empty: 'Nenhum estudo de caso corresponde aos filtros selecionados. Tente ajusta-los.',
    ctaBody: 'Sua organizacao pode ser a proxima implantacao controlada.',
    ctaButton: 'Iniciar um piloto controlado',
  },
};

export default function LocaleCaseStudiesPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? 'en-CA';
  const t = useTranslations('marketing.caseStudies');
  const copy = CASE_STUDIES_COPY[locale] ?? CASE_STUDIES_COPY['en-CA'];

  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [filteredStudies, setFilteredStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedOrgType, setSelectedOrgType] = useState<string>('all');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('all');

  useEffect(() => {
    async function loadCaseStudies() {
      try {
        const response = await fetch('/api/case-studies?status=published');
        if (response.ok) {
          const data = await response.json();
          setCaseStudies(data.caseStudies || []);
          setFilteredStudies(data.caseStudies || []);
        }
      } catch (error) {
        logger.error('Failed to load case studies:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCaseStudies();
  }, []);

  useEffect(() => {
    let filtered = [...caseStudies];
    if (selectedCategory !== 'all') filtered = filtered.filter((cs) => cs.category === selectedCategory);
    if (selectedSector !== 'all') filtered = filtered.filter((cs) => cs.sector === selectedSector);
    if (selectedOrgType !== 'all') filtered = filtered.filter((cs) => cs.organizationType === selectedOrgType);
    if (selectedJurisdiction !== 'all') filtered = filtered.filter((cs) => cs.jurisdiction === selectedJurisdiction);
    setFilteredStudies(filtered);
  }, [caseStudies, selectedCategory, selectedSector, selectedOrgType, selectedJurisdiction]);

  const categories = ['all', ...new Set(caseStudies.map((cs) => cs.category))];
  const sectors: string[] = ['all', ...new Set(caseStudies.map((cs) => cs.sector).filter((x): x is string => Boolean(x)))];
  const orgTypes = ['all', ...new Set(caseStudies.map((cs) => cs.organizationType))];
  const jurisdictions: string[] = ['all', ...new Set(caseStudies.map((cs) => cs.jurisdiction).filter((x): x is string => Boolean(x)))];

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
            label={copy.sector}
            value={selectedSector}
            options={sectors}
            allLabel={copy.all}
            onChange={setSelectedSector}
          />
          <FilterSelect
            label={copy.orgType}
            value={selectedOrgType}
            options={orgTypes}
            allLabel={copy.all}
            onChange={setSelectedOrgType}
          />
          <FilterSelect
            label={copy.jurisdiction}
            value={selectedJurisdiction}
            options={jurisdictions}
            allLabel={copy.all}
            onChange={setSelectedJurisdiction}
          />
        </div>

        {/* Results */}
        {filteredStudies.length === 0 ? (
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
            href={`/${locale}/pilot-request`}
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
