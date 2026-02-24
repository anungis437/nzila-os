/**
 * Individual Case Study Detail Page
 * 
 * Full case study view with complete narrative, metrics,
 * testimonials, and PDF export functionality.
 */


export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CaseStudy } from '@/types/marketing';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { ImpactMetricCard } from '@/components/marketing/impact-metric-card';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
import { logger } from '@/lib/logger';

interface CaseStudyPageProps {
  params: {
    slug: string;
  };
}

async function getCaseStudy(slug: string): Promise<CaseStudy | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/case-studies/${slug}`,
      { cache: 'no-store' }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.caseStudy;
  } catch (error) {
    logger.error('Failed to fetch case study:', error);
    return null;
  }
}

export default async function CaseStudyPage({ params }: CaseStudyPageProps) {
  const caseStudy = await getCaseStudy(params.slug);

  if (!caseStudy || caseStudy.status !== 'published') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-linear-to-r from-blue-600 to-blue-800 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 text-sm font-medium bg-white/20 rounded-full mb-4">
            {caseStudy.category}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {caseStudy.title}
          </h1>
          <p className="text-xl text-blue-100">
            {caseStudy.summary}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Organization Context */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Organization Context
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600 mb-1">Organization Type</p>
              <p className="font-semibold text-gray-900">
                {caseStudy.organizationType}
              </p>
            </div>
            {caseStudy.jurisdiction && (
              <div>
                <p className="text-gray-600 mb-1">Jurisdiction</p>
                <p className="font-semibold text-gray-900">
                  {caseStudy.jurisdiction}
                </p>
              </div>
            )}
            {caseStudy.sector && (
              <div>
                <p className="text-gray-600 mb-1">Sector</p>
                <p className="font-semibold text-gray-900">{caseStudy.sector}</p>
              </div>
            )}
            {caseStudy.memberCount && (
              <div>
                <p className="text-gray-600 mb-1">Member Count</p>
                <p className="font-semibold text-gray-900">
                  {caseStudy.memberCount.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {caseStudy.anonymized && (
            <HumanCenteredCallout
              variant="transparency"
              message="Some details in this case study have been anonymized to protect bargaining strategies and member privacy."
              className="mt-4"
              compact
            />
          )}
        </div>

        {/* Challenge */}
        {caseStudy.challenge && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              The Challenge
            </h2>
            <div
              className="prose prose-lg max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(caseStudy.challenge) }}
            />
          </div>
        )}

        {/* Solution */}
        {caseStudy.solution && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              The Solution
            </h2>
            <div
              className="prose prose-lg max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(caseStudy.solution) }}
            />
          </div>
        )}

        {/* Impact Metrics */}
        {caseStudy.metrics && caseStudy.metrics.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Measurable Impact
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {caseStudy.metrics.map((metric, idx) => (
                <ImpactMetricCard
                  key={idx}
                  label={metric.label}
                  before={metric.before}
                  after={metric.after}
                  unit={metric.unit}
                  improvement={metric.improvement}
                />
              ))}
            </div>
          </div>
        )}

        {/* Quote */}
        {caseStudy.quote && (
          <div className="bg-linear-to-r from-blue-600 to-blue-800 text-white rounded-lg p-8 mb-8">
            <blockquote className="text-2xl font-medium italic mb-4">
              {/* eslint-disable-next-line react/no-unescaped-entities, @typescript-eslint/no-explicit-any */}
              "{typeof caseStudy.quote === 'string' ? caseStudy.quote : (caseStudy.quote as any).text}"
            </blockquote>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <p className="text-blue-100">— {typeof caseStudy.quote === 'string' ? '' : (caseStudy.quote as any).attribution}</p>
          </div>
        )}

        {/* Results */}
        {caseStudy.results && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Results & Outcomes
            </h2>
            <div
              className="prose prose-lg max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(Array.isArray(caseStudy.results) ? caseStudy.results.join('') : (caseStudy.results as string)) }}
            />
          </div>
        )}

        {/* Lessons Learned */}
        {caseStudy.lessonsLearned && caseStudy.lessonsLearned.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Lessons Learned
            </h2>
            <ul className="space-y-3">
              {caseStudy.lessonsLearned.map((lesson, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-blue-600 text-xl mr-3">✓</span>
                  <span className="text-gray-800 text-lg">{lesson}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Replicability */}
        {caseStudy.replicability && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Can This Work for Your Union?
            </h2>
            <div
              className="prose prose-lg max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(Array.isArray(caseStudy.replicability) ? caseStudy.replicability.join('') : (caseStudy.replicability as string)) }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print / Save as PDF
          </button>

          <Link href="/case-studies"
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
          >
            View All Case Studies
          </Link>
        </div>

        {/* CTA */}
        <div className="bg-blue-600 text-white rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">
            Ready to create your own success story?
          </h2>
          <p className="text-lg mb-6 text-blue-100">
            Join our pilot program and see how Union Eyes can transform member advocacy
            at your local.
          </p>
          <Link href="/pilot-request"
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-md font-medium hover:bg-blue-50 transition-colors"
          >
            Apply for Pilot Program
          </Link>
        </div>

        {/* Metadata Footer */}
        <div className="mt-8 pt-8 border-t border-gray-200 text-sm text-gray-600 text-center">
          <p>
            Published: {new Date(caseStudy.publishedAt!).toLocaleDateString('en-US')}
          </p>
          {caseStudy.updatedAt &&
            new Date(caseStudy.updatedAt).getTime() !==
              new Date(caseStudy.createdAt).getTime() && (
              <p className="mt-1">
                Last updated:{' '}
                {new Date(caseStudy.updatedAt).toLocaleDateString('en-US')}
              </p>
            )}
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: CaseStudyPageProps) {
  const caseStudy = await getCaseStudy(params.slug);

  if (!caseStudy) {
    return {
      title: 'Case Study Not Found',
    };
  }

  return {
    title: `${caseStudy.title} | Union Eyes Case Studies`,
    description: caseStudy.summary,
  };
}
