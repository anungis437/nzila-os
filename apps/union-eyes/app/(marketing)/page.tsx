/**
 * UnionEyes — Marketing Landing Page
 * ────────────────────────────────────
 * Workflow-first, decision-system positioning.
 * Minimal sections, strong spacing, clear narrative.
 */

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';
import WorkflowSection from './components/workflow-section';
import RolesSection from './components/roles-section';
import AnimatedCTA from './components/animated-cta';
import UnionWorkCarousel from './components/union-work-carousel';

export const metadata: Metadata = {
  title: 'UnionEyes — A Decision System for Labour Leadership',
  description: 'UnionEyes is a decision system for labour leadership. From intake to outcome, all in one system.',
  openGraph: {
    title: 'UnionEyes — A Decision System for Labour Leadership',
    description: 'Know what matters. Act with confidence. From intake to outcome, all in one system.',
    images: [{ url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Workers in a professional labor meeting — UnionEyes' }],
  },
};

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden -mt-16 md:-mt-20">
        <Image
          src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920"
          alt="Workers gathered in a professional labor meeting"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/90 via-navy/85 to-navy/95" />
        <div className="absolute inset-0 bg-mesh opacity-60" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white mb-6">
              A Decision System for Labour Leadership
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
              Know what to do.<br />
              <span className="gradient-text">Not just what&apos;s happening.</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-white mb-10 max-w-3xl">
              UnionEyes brings intake, casework, intelligence, and outcomes
              into one decision system — built with Canadian unions, now entering pilot.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/pilot-request"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                Request a Demo
              </Link>
              <Link
                href="/story"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
              >
                See How It Works
              </Link>
            </div>
          </ScrollReveal>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-3 rounded-full bg-white/60 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════ WORKFLOW ═══════════════════════ */}
      <section className="py-24 px-4 md:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <WorkflowSection />
        </div>
      </section>

      {/* ═══════════════════════ DIFFERENTIATION ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
                Why UnionEyes is different
              </h2>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-8">
            {[
              { before: 'Not a dashboard', after: 'A decision system' },
              { before: 'Not fragmented tools', after: 'One workflow' },
              { before: 'Not static analytics', after: 'Live intelligence' },
              { before: 'Not guesswork', after: 'Guided action' },
            ].map((item) => (
              <ScrollReveal key={item.before}>
                <div className="flex items-start gap-4 p-6 rounded-2xl bg-white border border-gray-100">
                  <div className="shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-electric" />
                  </div>
                  <div>
                    <p className="text-gray-400 line-through text-sm mb-1">{item.before}</p>
                    <p className="text-navy font-bold text-lg">{item.after}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ ROLES ═══════════════════════ */}
      <section className="py-24 px-4 md:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <RolesSection />
        </div>
      </section>

      {/* ═══════════════════════ UNION WORK CAROUSEL ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="mb-8 text-center">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                Real Workflows
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-navy mb-3">
                Union work, in one continuous workflow
              </h2>
              <p className="text-lg text-gray-700 max-w-3xl mx-auto">
                A quick look at the day-to-day work UnionEyes is designed to support, from intake to leadership action.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <UnionWorkCarousel />
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ TRUST ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal direction="left">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                Governed &amp; Secure
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">
                Built on trust, <span className="text-electric">not surveillance</span>
              </h2>
              <p className="text-lg text-gray-800 mb-6 leading-relaxed">
                UnionEyes was born when a healthcare steward lost a winnable
                grievance because her notes were trapped in a spreadsheet. The employer
                had a million-dollar HR system. She had a notebook. We built a system
                that levels the playing field — governed by the people who use it.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'System effectiveness', detail: 'Outcome-driven' },
                  { label: 'Role-based access', detail: '35+ roles' },
                  { label: 'Audit-ready', detail: 'PIPEDA compliant' },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-xl bg-white border border-gray-100">
                    <div className="text-sm font-bold text-navy">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{item.detail}</div>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative rounded-2xl overflow-hidden aspect-4/3">
                <Image
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800"
                  alt="Diverse team collaborating — representing the people behind UnionEyes"
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

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedCTA />
        </div>
      </section>
    </main>
  );
}