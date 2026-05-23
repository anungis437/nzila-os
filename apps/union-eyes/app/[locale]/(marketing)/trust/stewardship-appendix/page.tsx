/**
 * Corporate Stewardship Appendix — procurement-grade content.
 *
 * This page is INTENTIONALLY deep and not surfaced in primary navigation.
 * It exists for procurement reviewers, RFP follow-ups, and diligence requests
 * that need to understand UnionEyes' corporate stewardship structure.
 *
 * Per organizational realignment directive: vendor-side governance mechanics
 * (ownership structure, founder protections, control mechanics) are NOT
 * surfaced as public marketing pillars. They live here as a procurement
 * appendix only.
 *
 * The word "governance" in UnionEyes public surfaces refers exclusively to
 * the CUSTOMER's organizational governance ecosystem.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Users, FileText, Vote } from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Corporate Stewardship Appendix | UnionEyes',
    description:
      'Procurement-grade appendix documenting UnionEyes corporate stewardship structure. For diligence and procurement reviewers.',
    alternates: buildLocaleAlternates(locale, '/trust/stewardship-appendix'),
    robots: {
      index: true,
      follow: true,
      nocache: true,
    },
  };
}

const provisions = [
  {
    icon: Vote,
    title: 'Veto on change of control',
    body: 'A reserved special share gives an elected labour council authority to block any sale, merger, or transfer of controlling interest without affirmative labour consent.',
  },
  {
    icon: Shield,
    title: 'Mission lock',
    body: 'Changes to the company mission require reserved-share consent, protecting worker-first purpose against investor or executive drift.',
  },
  {
    icon: Users,
    title: 'Labour-elected council seats',
    body: 'Reserved board seats are held by labour-elected representatives with full voting rights on strategic decisions.',
  },
  {
    icon: FileText,
    title: 'Reserved matters',
    body: 'Critical decisions such as major pricing changes, data-sharing policy, and data residency shifts require reserved-share approval.',
  },
];

export default function StewardshipAppendixPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Neutral procurement header — no marketing chrome, no hero imagery */}
      <header className="bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-300 mb-4">
            Procurement appendix
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Corporate stewardship structure
          </h1>
          <p className="text-lg text-gray-200 leading-relaxed max-w-2xl">
            This appendix documents the corporate stewardship structure of UnionEyes for
            procurement diligence and RFP follow-up. It is not part of the public marketing
            narrative.
          </p>
          <p className="text-sm text-gray-300 mt-4 max-w-2xl">
            The word &ldquo;governance&rdquo; on UnionEyes public surfaces refers to the
            customer&rsquo;s organizational governance ecosystem &mdash; not to corporate
            stewardship mechanics.
          </p>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-4">Structural overview</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            UnionEyes carries a reserved class of equity with veto rights over defined
            decisions, regardless of ordinary share distribution. The reserved share is held
            by a labour council elected by partner organizations.
          </p>
          <p className="text-gray-700 leading-relaxed">
            The structure was established at incorporation and cannot be removed without
            reserved-shareholder consent. It is designed to preserve procedural neutrality,
            mission alignment, and operational sovereignty across ownership transitions.
          </p>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">Reserved matters</h2>
          <div className="space-y-6">
            {provisions.map((p) => (
              <div
                key={p.title}
                className="flex gap-5 p-6 rounded-2xl border border-gray-100 shadow-sm"
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-electric/10 text-electric flex items-center justify-center">
                  <p.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-navy mb-2">{p.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">Frequently asked (procurement)</h2>
          <div className="space-y-6 divide-y divide-gray-100">
            {[
              {
                q: 'What if UnionEyes raises venture capital?',
                a: 'Investors may hold ordinary shares. The reserved share is separate, non-dilutive, and remains in force.',
              },
              {
                q: 'Can the stewardship model be changed later?',
                a: 'Only with reserved-share consent. The protection is designed specifically to prevent unilateral changes.',
              },
              {
                q: 'Who provides stewardship oversight?',
                a: 'A labour-elected council structure with reserved powers and documented oversight responsibilities.',
              },
              {
                q: 'Why is this content not in the main navigation?',
                a: 'Corporate stewardship mechanics are procurement-grade context, not public marketing identity. UnionEyes\u2019 external narrative is built around the customer\u2019s organizational governance, continuity, and operational trust \u2014 not vendor ownership structure.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="pt-6 first:pt-0">
                <h3 className="font-semibold text-navy mb-2">{q}</h3>
                <p className="text-gray-700 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-10">
          Platform tooling that surfaces structural stewardship data operates under
          human oversight, with full explainability available to any party conducting
          procurement review. No governance decision is automated; every output is
          reviewable by counsel, auditors, or labour-elected oversight bodies.
        </p>

        <div className="border-t border-gray-100 pt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="../" className="text-sm text-electric font-semibold hover:underline">
            ← Back to Trust &amp; Stewardship
          </Link>
          <Link
            href="../../contact"
            className="text-sm text-electric font-semibold hover:underline"
          >
            Procurement enquiries →
          </Link>
        </div>
      </section>
    </div>
  );
}
