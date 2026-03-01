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
import { logger } from '@/lib/logger';

export default function LocaleCaseStudiesPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? 'en-CA';
  const t = useTranslations('marketing.caseStudies');
  const isFr = locale === 'fr-CA';

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
  const sectors = ['all', ...new Set(caseStudies.map((cs) => cs.sector).filter(Boolean))];
  const orgTypes = ['all', ...new Set(caseStudies.map((cs) => cs.organizationType))];
  const jurisdictions = ['all', ...new Set(caseStudies.map((cs) => cs.jurisdiction).filter(Boolean))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600">{isFr ? 'Chargement des études de cas…' : 'Loading case studies…'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('heroHeading')}</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">{t('heroDescription')}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          <FilterSelect
            label={isFr ? 'Catégorie' : 'Category'}
            value={selectedCategory}
            options={categories}
            onChange={setSelectedCategory}
          />
          <FilterSelect
            label={isFr ? 'Secteur' : 'Sector'}
            value={selectedSector}
            options={sectors}
            onChange={setSelectedSector}
          />
          <FilterSelect
            label={isFr ? "Type d'organisation" : 'Org type'}
            value={selectedOrgType}
            options={orgTypes}
            onChange={setSelectedOrgType}
          />
          <FilterSelect
            label={isFr ? 'Juridiction' : 'Jurisdiction'}
            value={selectedJurisdiction}
            options={jurisdictions}
            onChange={setSelectedJurisdiction}
          />
        </div>

        {/* Results */}
        {filteredStudies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {isFr
                ? "Aucune étude de cas ne correspond à vos filtres. Essayez d'ajuster vos sélections."
                : 'No case studies match your filters. Try adjusting your selections.'}
            </p>
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
            {isFr ? 'Votre syndicat pourrait être la prochaine réussite.' : 'Your union could be the next success story.'}
          </p>
          <Link
            href={`/${locale}/pilot-request`}
            className="inline-flex items-center px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 transition-colors"
          >
            {isFr ? 'Demander un projet pilote' : 'Request a pilot program'}
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
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
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
            {opt === 'all' ? (label === 'Catégorie' || label === 'Category' ? (label === 'Catégorie' ? 'Toutes' : 'All') : 'All') : opt}
          </option>
        ))}
      </select>
    </label>
  );
}
