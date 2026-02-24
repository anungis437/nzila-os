/**
 * Case Study Card Component
 * 
 * Displays case study summaries in listings with impact metrics,
 * testimonials, and category filtering.
 */

import Link from 'next/link';
import { CaseStudy } from '@/types/marketing';
import { ImpactMetricCard } from './impact-metric-card';

interface CaseStudyCardProps {
  caseStudy: CaseStudy;
  variant?: 'full' | 'compact';
  showMetrics?: boolean;
}

export function CaseStudyCard({
  caseStudy,
  variant = 'full',
  showMetrics = true,
}: CaseStudyCardProps) {
  const isPublished = !!caseStudy.publishedAt;
  const hasMetrics = caseStudy.metrics && caseStudy.metrics.length > 0;

  if (variant === 'compact') {
    return (
      <Link
        href={`/case-studies/${caseStudy.slug}`}
        className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="inline-block px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full mb-2">
              {caseStudy.category}
            </span>
            <h3 className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
              {caseStudy.title}
            </h3>
          </div>
          {!isPublished && (
            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
              Draft
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {caseStudy.summary}
        </p>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{caseStudy.organizationType}</span>
        </div>
      </Link>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-xl transition-shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {caseStudy.category}
              </span>
              {!isPublished && (
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                  Draft
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {caseStudy.title}
            </h3>
          </div>
        </div>

        <p className="text-gray-700 mb-4">
          {caseStudy.summary}
        </p>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">Organization:</span>{' '}
            {caseStudy.organizationType}
          </div>
          <div>
            <span className="font-medium">Category:</span>{' '}
            {caseStudy.category}
          </div>
        </div>
      </div>

      {/* Metrics */}
      {showMetrics && hasMetrics && (
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Impact Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {caseStudy.metrics.slice(0, 4).map((metric, idx) => (
              <ImpactMetricCard
                key={idx}
                label={metric.label}
                before={metric.before}
                after={metric.after}
                unit={metric.unit}
                improvement={metric.improvement}
                compact={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quote */}
      {caseStudy.testimonial && (
        <div className="p-6 bg-blue-50 border-b border-gray-200">
          <blockquote className="italic text-gray-800 mb-2">
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            "{caseStudy.testimonial.quote}"
          </blockquote>
          <p className="text-sm text-gray-600">
            — {caseStudy.testimonial.author}, {caseStudy.testimonial.role}
            {caseStudy.testimonial.organization && ` (${caseStudy.testimonial.organization})`}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="p-6">
        <Link
          href={`/case-studies/${caseStudy.slug}`}
          className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          Read Full Case Study
          <svg
            className="ml-2 w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/**
 * Case Study Grid Component
 * For displaying multiple case studies in a responsive grid
 */
interface CaseStudyGridProps {
  caseStudies: CaseStudy[];
  variant?: 'full' | 'compact';
  showMetrics?: boolean;
}

export function CaseStudyGrid({
  caseStudies,
  variant = 'full',
  showMetrics = true,
}: CaseStudyGridProps) {
  if (caseStudies.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No case studies found</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${
      variant === 'compact'
        ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 lg:grid-cols-2'
    }`}>
      {caseStudies.map((caseStudy) => (
        <CaseStudyCard
          key={caseStudy.id}
          caseStudy={caseStudy}
          variant={variant}
          showMetrics={showMetrics}
        />
      ))}
    </div>
  );
}
