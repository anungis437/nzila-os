/**
 * Case Studies Public Listing Page
 *
 * Static pilot results — published with union approval.
 * No fabricated logos. No invented names.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';

export const metadata: Metadata = {
  title: 'Pilot Results | UnionEyes',
  description: 'Real results from Canadian unions in the UnionEyes pilot program.',

const pilots = [
  {
    org: 'Healthcare Local, Ontario',
    sector: 'Healthcare',
    headline: 'Grievance cycle time cut by 58%',
    body: 'A healthcare local with 3,200 members moved from spreadsheet tracking to UnionEyes. Stewards now triage cases in a shared queue rather than individual inboxes. The result: median cycle time from intake to resolution dropped from 47 days to 20 days over a 6-month pilot.',
    metrics: [
      { label: 'Grievance cycle time', value: '−58%' },
      { label: 'Cases tracked', value: '140+' },
      { label: 'Pilot duration', value: '6 months' },
    ],
  },
  {
    org: 'Regional Council, British Columbia',
    sector: 'Public Sector',
    headline: 'Admin burden per rep down 44%',
    body: 'A regional council representing multiple locals used UnionEyes to consolidate member communications, board reporting, and bargaining prep into a single workflow. Representatives reported spending 44% less time on administrative coordination — time reinvested into direct member contact.',
    metrics: [
      { label: 'Admin burden per rep', value: '−44%' },
      { label: 'Locals consolidated', value: '7' },
      { label: 'Pilot duration', value: '4 months' },
    ],
  },
  {
    org: 'Education Local, Alberta',
    sector: 'Education',
    headline: 'Grievances filed increased 71%',
    body: 'After deploying UnionEyes, this education local saw a sharp increase in grievances filed — not because conditions worsened, but because members now knew how to access the intake process. Lower barrier to filing means more members got representation they were entitled to.',
    metrics: [
      { label: 'Grievances filed', value: '+71%' },
      { label: 'Member reach', value: '1,800+' },
      { label: 'Pilot duration', value: '3 months' },
    ],
  },
  {
    org: 'Manufacturing Region',
    sector: 'Manufacturing',
    headline: 'Board report prep time down 88%',
    body: 'Executive leadership at a manufacturing regional previously spent 6–8 hours compiling monthly board reports from email threads and spreadsheets. UnionEyes generates those reports automatically from live case data. Board prep now takes under an hour.',
    metrics: [
      { label: 'Board report prep', value: '−88%' },
      { label: 'Time saved per cycle', value: '~7 hours' },
      { label: 'Pilot duration', value: '5 months' },
    ],
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <section className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white mb-6">
            Pilot Results
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Real results from Canadian unions
          </h1>
          <p className="text-white/80 max-w-2xl text-lg">
            Early pilot outcomes reported by participating organizations. Metrics are
            self-reported by union leadership and anonymized where requested.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <HumanCenteredCallout
          variant="transparency"
          message="All metrics are reported directly by participating unions. Organization names are generalized to protect bargaining strategies. If you ask us in person, we can say more."
          className="mb-12"
        />

        <div className="space-y-10">
          {pilots.map((p) => (
            <article
              key={p.org}
              className="rounded-2xl border border-gray-100 shadow-sm p-8 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-xs font-semibold tracking-widest uppercase text-electric">
                  {p.sector}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{p.org}</span>
              </div>
              <h2 className="text-2xl font-bold text-navy mb-3">{p.headline}</h2>
              <p className="text-gray-700 mb-6 leading-relaxed">{p.body}</p>
              <div className="grid grid-cols-3 gap-4">
                {p.metrics.map((m) => (
                  <div key={m.label} className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
                    <div className="text-2xl font-extrabold text-electric mb-1">{m.value}</div>
                    <div className="text-xs text-gray-600">{m.label}</div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-navy text-white p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Become a pilot partner</h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            We&apos;re running a small cohort of Canadian unions through a structured pilot.
            No long-term commitment. Full data sovereignty from day one.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pilot-request"
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/25"
            >
              Apply for the Pilot
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-white/10 text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all"
            >
              Ask a Question First
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}


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
            UnionEyes Success Stories
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Real unions, real results. See how UnionEyes helps locals protect
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
            If you&apos;re a UnionEyes pilot partner and have a success story to share,
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
