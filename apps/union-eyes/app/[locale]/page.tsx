export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import ScrollReveal from '@/components/public/scroll-reveal';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import LocaleSiteNavigation from './(marketing)/locale-site-navigation';
import LocaleSiteFooter from './(marketing)/locale-site-footer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: 'Union Eyes | Institutional Governance & Continuity Infrastructure',
    description:
      'Institutional governance & continuity infrastructure for federated democratic organizations: governance-safe cognition, institutional memory, stewardship continuity, and anti-surveillance posture as one operating environment.',
    alternates: buildLocaleAlternates(locale),
  };
}

const outcomes = [
  {
    title: 'Institutional continuity',
    desc: 'Leadership transitions retain strategic memory, governance context, and operational direction.',
  },
  {
    title: 'Governance-safe cognition',
    desc: 'Every interpretation is bounded, evidence-anchored, and reviewer-of-record resolved.',
  },
  {
    title: 'Operational coherence',
    desc: 'Distributed teams work from one shared operating view instead of fragmented systems.',
  },
  {
    title: 'Anti-surveillance posture',
    desc: 'Continuity-safe modernization, anti-surveillance design, and human oversight enforced structurally at every layer.',
  },
];

const proofPoints = [
  { metric: '100%', label: 'Explainable decisions', sub: 'Every recommendation auditable' },
  { metric: '0', label: 'Worker surveillance paths', sub: 'Anti-surveillance by design' },
  { metric: 'Canada', label: 'Data residency', sub: 'Sovereign hosting, no cross-border egress' },
  { metric: '24/7', label: 'Institutional memory', sub: 'Continuity across leadership transitions' },
];

const principles = [
  'Human oversight is required, not optional.',
  'No black-box outputs: every result is explainable.',
  'No worker surveillance capability path.',
  'Complete audit trails for governance trust.',
];

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { userId } = await auth();

  if (userId) {
    redirect(`/${locale}/dashboard/priorities`);
  }

  return (
    <>
      <LocaleSiteNavigation />

      <main className="min-h-screen pt-16 md:pt-20">
        <section className="relative min-h-[82vh] flex items-center overflow-hidden -mt-16 md:-mt-20">
          <Image
            src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920"
            alt="Union leadership and operations teams in strategic session"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-linear-to-b from-navy/90 via-navy/85 to-navy/95" />
          <div className="absolute inset-0 bg-mesh opacity-60" />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28">
            <ScrollReveal>
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white mb-6">
                Institutional Governance & Continuity Infrastructure
              </span>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
                Confidence that<br />
                <span className="gradient-text">institutional memory will outlive any individual.</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.16}>
              <p className="text-xl md:text-2xl text-white mb-10 max-w-3xl">
                Union Eyes is the operational infrastructure layer for institutional labour continuity — governance-safe cognition, institutional memory, stewardship continuity, and anti-surveillance posture, embodied as one operating environment.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.24}>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/${locale}/pilot-request`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  Request Executive Briefing
                </Link>
                <Link
                  href={`/${locale}/solutions`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
                >
                  Explore Solutions
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="py-10 bg-white border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold tracking-widest uppercase text-gray-400 mb-6">
              Built-in platform guarantees
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {proofPoints.map((item) => (
                <div key={item.metric} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-3xl font-extrabold text-electric mb-1">{item.metric}</div>
                  <div className="text-sm font-semibold text-navy mb-0.5">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-12">                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                  Enterprise-grade operations, institution-first design
                </h2>
                <p className="text-lg text-gray-700 max-w-3xl mx-auto">
                  Union Eyes is designed for leadership continuity, governance modernization, and democratic trust at scale.
                </p>
              </div>
            </ScrollReveal>

            <div className="grid sm:grid-cols-2 gap-6">
              {outcomes.map((item) => (
                <ScrollReveal key={item.title}>
                  <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                    <h3 className="text-lg font-bold text-navy mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>                <h2 className="text-3xl md:text-4xl font-bold text-navy mb-5">
                  Explainable intelligence with democratic safeguards
                </h2>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  Intelligence recommends. People decide. Governance controls, labour-safe standards,
                  and auditable evidence are built into every workflow.
                </p>
                <ul className="space-y-3">
                  {principles.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-electric mt-2" />
                      {item}
                    </li>
                  ))}
                </ul>
              </ScrollReveal>

              <ScrollReveal delay={0.1}>
                <div className="relative rounded-2xl overflow-hidden aspect-4/3">
                  <Image
                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800"
                    alt="Labour leadership collaboration in governance session"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-navy/40 to-transparent" />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-20 bg-navy relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-30" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <ScrollReveal>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-5">
                Ready for institutional continuity at executive scale?
              </h2>
              <p className="text-xl text-gray-100 mb-9">
                Start with a guided pilot built around your governance and operations priorities.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={`/${locale}/pilot-request`}
                  className="inline-flex items-center justify-center px-10 py-5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  Request Executive Briefing
                </Link>
                <Link
                  href={`/${locale}/trust`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
                >
                  View Governance & Trust
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <LocaleSiteFooter />
    </>
  );
}
