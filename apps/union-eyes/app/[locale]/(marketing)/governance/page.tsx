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
import { ArrowRight, Landmark, ScrollText, Network, Infinity as InfinityIcon } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export default async function GovernancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

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
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
            >
              Request a governance briefing <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/trust`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              Review the trust record
            </Link>
          </div>
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue="challenge" className="space-y-8">
          <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4 gap-2 bg-transparent p-0 my-3">
              <TabsTrigger value="challenge" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                Challenge
              </TabsTrigger>
              <TabsTrigger value="pathways" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                Pathways
              </TabsTrigger>
              <TabsTrigger value="proof" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                Proof
              </TabsTrigger>
              <TabsTrigger value="action" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                Action
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── CHALLENGE ── */}
          <TabsContent value="challenge" className="space-y-12">

            <section className="py-16 bg-gray-50 rounded-2xl">
              <div className="max-w-3xl mx-auto px-6">
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
            </section>

            <section className="py-16 bg-white">
              <div className="max-w-5xl mx-auto px-6">
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
            </section>

            <section className="py-16 bg-gray-50 rounded-2xl">
              <div className="max-w-3xl mx-auto px-6">
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
            </section>

          </TabsContent>

          {/* ── PATHWAYS ── */}
          <TabsContent value="pathways" className="space-y-12">

            <section className="py-16 bg-gray-50 rounded-2xl">
              <div className="max-w-5xl mx-auto px-6">
                <h2 className="text-2xl font-bold text-navy mb-3">
                  Overlay infrastructure, non-disruptive adoption
                </h2>
                <p className="text-gray-600 max-w-3xl mb-8">
                  UnionEyes operates as a continuity layer that augments existing constitutional
                  documents, resolution archives, and parliamentary practice — not as a replacement.
                  Adoption proceeds at the pace constitutional review permits.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Overlay infrastructure', desc: 'A continuity layer that runs alongside existing constitutional and procedural systems rather than replacing them.' },
                    { title: 'Alongside existing systems', desc: 'Resolution archives, delegate registries, and parliamentary tools continue to operate — UnionEyes adds traceability and continuity.' },
                    { title: 'Non-disruptive implementation', desc: 'Phased adoption sequencing with explicit governance checkpoints — operational calm preserved throughout.' },
                    { title: 'Coexistence with parliamentary practice', desc: 'Procedural authority remains with chairs, parliamentarians, and constitutional officers; UnionEyes provides supporting continuity.' },
                    { title: 'Canadian-hosted', desc: 'Institutional data residency aligned with Canadian governance and procurement expectations.' },
                    { title: 'Bilingual-first', desc: 'English and French as first-class procedural surfaces, reflecting how federated Canadian institutions actually operate.' },
                  ].map((item) => (
                    <article key={item.title} className="p-5 rounded-xl bg-white border border-gray-100">
                      <h3 className="text-sm font-bold text-navy mb-2">{item.title}</h3>
                      <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="py-16 bg-white border-y border-gray-100">
              <div className="max-w-5xl mx-auto px-6">
                <h2 className="text-2xl font-bold text-navy mb-3">
                  Governance-safe assistive intelligence
                </h2>
                <p className="text-gray-600 max-w-3xl mb-8">
                  Where intelligence supports procedural work, it operates under full human
                  oversight. Every suggestion is reviewable, explainable, and traceable to its source
                  evidence — never autonomous, never substituting for procedural authority.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { title: 'Human oversight', desc: 'Chairs, parliamentarians, and committee officers retain procedural authority over every decision.' },
                    { title: 'Explainability', desc: 'Every assistive suggestion is traceable to its source record — constitutional clause, prior resolution, or procedural precedent.' },
                    { title: 'Reviewability', desc: 'Procedural artifacts are reviewable end-to-end so disposition can be audited by delegates and constitutional officers.' },
                    { title: 'Assistive, not autonomous', desc: 'Intelligence supports procedural continuity; it does not direct, dispose, or replace deliberative authority.' },
                  ].map((item) => (
                    <article key={item.title} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
                      <h3 className="text-sm font-bold text-navy mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="py-16 bg-gray-50 rounded-2xl">
              <div className="max-w-5xl mx-auto px-6">
                <h2 className="text-2xl font-bold text-navy mb-8">
                  Operational reassurance for constitutional review
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { title: 'Adoption calm', desc: 'Phased rollout pacing with explicit governance checkpoints — adoption proceeds at the pace constitutional review permits.' },
                    { title: 'Procedural stability', desc: 'Constitutional officers and parliamentarians retain procedural authority; UnionEyes supports rather than substitutes.' },
                    { title: 'Federated resilience', desc: 'Constitutional intent and delegate continuity persist across cycles, leadership transitions, and federated coordination.' },
                  ].map((item) => (
                    <article key={item.title} className="p-5 rounded-xl bg-white border border-gray-100">
                      <h3 className="text-sm font-bold text-navy mb-2">{item.title}</h3>
                      <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

          </TabsContent>

          {/* ── PROOF ── */}
          <TabsContent value="proof" className="space-y-12">

            <section className="py-16 bg-gray-50 rounded-2xl">
              <div className="max-w-5xl mx-auto px-6">
                <h2 className="text-2xl font-bold text-navy mb-3">
                  Procedural artifacts that make governance reviewable
                </h2>
                <p className="text-gray-600 max-w-3xl mb-8">
                  Evidence is presented as procedural artifacts — resolution lineage records, mandate
                  trails, committee disposition logs, and delegate continuity registries — not
                  abstract claims.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Resolution lineage', desc: 'Every motion carries its full adoption history — amendment trail, vote record, and ratification chain — from introduction to active mandate.' },
                    { title: 'Mandate expiry tracking', desc: 'Active mandates surface ownership, scope, and expiration in a single queryable view. Nothing silently lapses.' },
                    { title: 'Committee disposition logs', desc: 'Referrals, deliberations, and committee recommendations are logged as procedural artifacts attached to the originating resolution.' },
                    { title: 'Delegate continuity registry', desc: 'Delegate credentials, authority scope, and historical participation travel with the record — not with the individual.' },
                    { title: 'Constitutional version history', desc: 'Bylaw and constitutional amendments are versioned with effective dates, so the governing instrument at any past moment is recoverable.' },
                    { title: 'Cross-tier coordination log', desc: 'Local-to-regional-to-national ratification steps are logged with timestamps and approving body signatures.' },
                  ].map((item) => (
                    <article key={item.title} className="p-5 rounded-xl bg-white border border-gray-100">
                      <h3 className="text-sm font-bold text-navy mb-2">{item.title}</h3>
                      <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="py-16 bg-white border-y border-gray-100">
              <div className="max-w-4xl mx-auto px-6">
                <div className="grid sm:grid-cols-3 gap-6 text-center">
                  {[
                    { label: 'Procedural neutrality', sub: 'Alongside existing parliamentary practice' },
                    { label: 'Human oversight required', sub: 'Chairs and parliamentarians retain authority' },
                    { label: 'Constitutional traceability', sub: 'Every resolution carries its full lineage' },
                  ].map((item) => (
                    <div key={item.label} className="p-6 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="text-sm font-bold text-navy mb-1">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </TabsContent>

          {/* ── ACTION ── */}
          <TabsContent value="action" className="space-y-12">

            <section className="py-20 bg-gray-50 rounded-2xl">
              <div className="max-w-3xl mx-auto px-6 text-center">
                <h2 className="text-3xl font-bold text-navy mb-4">
                  Ready to make your governance infrastructure durable?
                </h2>
                <p className="text-gray-600 text-lg mb-10">
                  Book a governance briefing to see how UnionEyes handles constitutional operations,
                  resolution lifecycle, and continuity across leadership transitions — without
                  disrupting existing parliamentary practice.
                </p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href={`/${locale}/pilot-request`}
                    className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
                  >
                    Request a governance briefing <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    href={`/${locale}/trust`}
                    className="inline-flex items-center justify-center px-7 py-3.5 border border-electric text-electric font-semibold rounded-xl hover:bg-electric/5 transition-all"
                  >
                    Review the trust record
                  </Link>
                </div>
              </div>
            </section>

            <section className="py-12 border-t border-gray-100">
              <div className="max-w-3xl mx-auto px-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Link
                    href={`/${locale}/institutional-continuity`}
                    className="text-sm text-electric font-semibold hover:underline"
                  >
                    Institutional Memory →
                  </Link>
                  <Link
                    href={`/${locale}/trust`}
                    className="text-sm text-electric font-semibold hover:underline"
                  >
                    Trust &amp; Stewardship →
                  </Link>
                  <Link
                    href={`/${locale}/conventions`}
                    className="text-sm text-electric font-semibold hover:underline"
                  >
                    Conventions &amp; Federated Governance →
                  </Link>
                </div>
              </div>
            </section>

          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
