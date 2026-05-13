/**
 * Governance & Continuity (customer-institutional).
 *
 * Per realignment directive, "governance" on UnionEyes public surfaces refers
 * to the CUSTOMER's institutional governance ecosystem: constitutional
 * operations, resolutions, committees, delegate coordination, and continuity
 * of mandate across leadership transitions.
 *
 * Vendor-side corporate stewardship mechanics live exclusively at
 * /trust/stewardship-appendix and are not surfaced here.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Landmark, ScrollText, Network, Infinity as InfinityIcon } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Governance & Continuity | UnionEyes',
    description:
      'Constitutional operations infrastructure for federated democratic organizations \u2014 resolutions, committees, mandates, and continuity of institutional memory across leadership transitions.',
    alternates: buildLocaleAlternates(locale, '/governance'),
  };
}

const pillars = [
  {
    icon: Landmark,
    title: 'Constitutional operations',
    body: 'Constitutions, bylaws, and standing orders are first-class operational artifacts \u2014 versioned, queryable, and enforced through procedural workflow rather than tribal knowledge.',
  },
  {
    icon: ScrollText,
    title: 'Resolutions & mandate lifecycle',
    body: 'Every motion, amendment, vote, and ratification flows through an auditable lifecycle. Mandates are tracked from adoption through expiration, with explicit ownership at every stage.',
  },
  {
    icon: Network,
    title: 'Committees & delegate coordination',
    body: 'Standing committees, ad-hoc working groups, and delegate bodies operate inside the same governance fabric \u2014 with explicit reporting lines, scoped authority, and traceable deliverables.',
  },
  {
    icon: InfinityIcon,
    title: 'Continuity beyond any individual',
    body: 'Decisions, deliberation context, and institutional reasoning survive every leadership transition. New officers inherit the full body of work, not a blank desk and a pile of binders.',
  },
];

export default function GovernancePage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.governance}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Governance &amp; Continuity
          </span>
        }
        heading="Constitutional operations for federated organizations."
        description="UnionEyes turns your constitution, resolutions, and mandates into operational infrastructure \u2014 so institutional reasoning survives every leadership transition."
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-4">
            Why institutional governance is operational infrastructure
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            For federated democratic organizations, governance is not paperwork or quarterly
            ritual. It is the protocol that determines what the organization is allowed to
            decide, who is allowed to decide it, and what happens when an officer&rsquo;s term
            ends.
          </p>
          <p className="text-gray-700 leading-relaxed">
            UnionEyes treats that protocol as production infrastructure: durable, versioned,
            queryable, and continuously auditable.
          </p>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">The four governance pillars</h2>
          <div className="space-y-6">
            {pillars.map((p) => (
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
          <h2 className="text-2xl font-bold text-navy mb-8">Frequently asked</h2>
          <div className="space-y-6 divide-y divide-gray-100">
            {[
              {
                q: 'Is this a document management system?',
                a: 'No. Documents are an artifact of governance, not its substance. UnionEyes models the procedural mechanics \u2014 motions, amendments, votes, mandates, committee authority \u2014 as first-class state, with documents attached as evidence.',
              },
              {
                q: 'How does this handle federated structures?',
                a: 'Local, regional, and national bodies each carry their own governance state, with explicit delegation, escalation, and ratification pathways. Cross-tier resolutions are coordinated through the same protocol \u2014 not over email threads.',
              },
              {
                q: 'What happens when leadership changes?',
                a: 'Incoming officers inherit complete deliberation history, active mandates, pending motions, and committee state. Procedural neutrality is enforced by the platform, not by trust in the outgoing officer.',
              },
              {
                q: 'How is UnionEyes itself governed?',
                a: 'UnionEyes operates under a documented corporate stewardship structure designed to keep platform neutrality and labour alignment durable across ownership transitions. Procurement reviewers can find structural details in the stewardship appendix.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="pt-6 first:pt-0">
                <h3 className="font-semibold text-navy mb-2">{q}</h3>
                <p className="text-gray-700 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="../institutional-continuity"
            className="text-sm text-electric font-semibold hover:underline"
          >
            Institutional Memory →
          </Link>
          <Link href="../trust" className="text-sm text-electric font-semibold hover:underline">
            Trust &amp; Stewardship →
          </Link>
        </div>
      </section>
    </div>
  );
}
