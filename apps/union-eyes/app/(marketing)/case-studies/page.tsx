// @ts-nocheck
/**
 * Case Studies Public Listing Page
 * 
 * Showcases successful Union Eyes implementations with filtering
 * by category, sector, organization type, and jurisdiction.
 */

'use client';
import Link from 'next/link';

import { useState, useEffect } from 'react';
import { CaseStudy } from '@/types/marketing';
import { CaseStudyGrid } from '@/components/marketing/case-study-card';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
import { logger } from '@/lib/logger';

export default function CaseStudiesPage() {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [filteredStudies, setFilteredStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedOrgType, setSelectedOrgType] = useState<string>('all');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('all');

  // Load case studies
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

  // Apply filters
  useEffect(() => {
    let filtered = [...caseStudies];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((cs) => cs.category === selectedCategory);
    }

    if (selectedSector !== 'all') {
      filtered = filtered.filter((cs) => cs.sector === selectedSector);
    }

    if (selectedOrgType !== 'all') {
      filtered = filtered.filter((cs) => cs.organizationType === selectedOrgType);
    }

    if (selectedJurisdiction !== 'all') {
      filtered = filtered.filter((cs) => cs.jurisdiction === selectedJurisdiction);
    }

    setFilteredStudies(filtered);
  }, [caseStudies, selectedCategory, selectedSector, selectedOrgType, selectedJurisdiction]);

  // Extract unique filter options
  const categories = ['all', ...new Set(caseStudies.map((cs) => cs.category))];
  const sectors = ['all', ...new Set(caseStudies.map((cs) => cs.sector).filter(Boolean))];
  const orgTypes = ['all', ...new Set(caseStudies.map((cs) => cs.organizationType))];
  const jurisdictions = ['all', ...new Set(caseStudies.map((cs) => cs.jurisdiction).filter(Boolean))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600">Loading case studies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Union Eyes Success Stories
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Real unions, real results. See how Union Eyes helps locals protect
            members and strengthen workplace power.
          </p>
        </div>

        <HumanCenteredCallout
          variant="transparency"
          message="All metrics are verified and reported by participating unions. Some details are anonymized to protect bargaining strategies."
          className="mb-8"
        />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Sector Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sector
              </label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector === 'all' ? 'All Sectors' : sector}
                  </option>
                ))}
              </select>
            </div>

            {/* Organization Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Type
              </label>
              <select
                value={selectedOrgType}
                onChange={(e) => setSelectedOrgType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {orgTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Types' : type}
                  </option>
                ))}
              </select>
            </div>

            {/* Jurisdiction Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jurisdiction
              </label>
              <select
                value={selectedJurisdiction}
                onChange={(e) => setSelectedJurisdiction(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {jurisdictions.map((jurisdiction) => (
                  <option key={jurisdiction} value={jurisdiction}>
                    {jurisdiction === 'all' ? 'All Jurisdictions' : jurisdiction}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(selectedCategory !== 'all' ||
            selectedSector !== 'all' ||
            selectedOrgType !== 'all' ||
            selectedJurisdiction !== 'all') && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedSector('all');
                  setSelectedOrgType('all');
                  setSelectedJurisdiction('all');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Results Count */}
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredStudies.length} of {caseStudies.length} case studies
          </div>
        </div>

        {/* Case Studies Grid */}
        {filteredStudies.length > 0 ? (
          <CaseStudyGrid caseStudies={filteredStudies} variant="full" />
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">
              No case studies match your filters
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedSector('all');
                setSelectedOrgType('all');
                setSelectedJurisdiction('all');
              }}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-16 bg-blue-600 text-white rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Want to share your story?</h2>
          <p className="text-lg mb-6 text-blue-100">
            If you&apos;re a Union Eyes pilot partner and have a success story to share,
            we&apos;d love to feature it here (with your approval, of course).
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/pilot-request"
              className="bg-white text-blue-600 px-6 py-3 rounded-md font-medium hover:bg-blue-50 transition-colors"
            >
              Join Pilot Program
            </Link>
            <a
              href="mailto:stories@unioneyes.org"
              className="bg-blue-700 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-800 transition-colors"
            >
              Share Your Story
            </a>
          </div>
        </div>

        {/* Trust Footer */}
        <div className="mt-12 text-center text-sm text-gray-600">
          <p>
            All case studies are verified and approved by participating organizations.
          </p>
          <p className="mt-2">
            See our{' '}
            <Link href="/trust" className="text-blue-600 hover:underline">
              Trust Dashboard
            </Link>{' '}
            for system integrity metrics.
          </p>
        </div>
      </div>
    </div>
  );
}
