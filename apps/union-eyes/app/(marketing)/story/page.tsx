/**
 * Story Page - Why Union Eyes Exists
 * 
 * Purpose: Human-centered narrative about the platform's origins
 * Audience: Skeptical union leadership, organizers, member representatives
 * 
 * Tone: Authentic, organizer-first, anti-corporate
 * Message: Built with unions, not for unions. By people who understand labor.
 */


export const dynamic = 'force-dynamic';

import * as React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  CalloutPresets,
} from '@/components/marketing/human-centered-callout';
import { Heart, Users, Shield, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Our Story | Union Eyes',
  description:
    'Union Eyes was built by people who understand labor, not Silicon Valley. This is why we exist and what we stand for.',
};

export default function StoryPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full text-sm text-red-700 font-medium mb-6">
            <Heart className="h-4 w-4" />
            <span>Built with unions, not for unions</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Union Eyes exists because workers deserve better than pen and paper
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            This platform was co-designed with union stewards who spent years managing
            grievances in spreadsheets, losing documents, and watching cases fall through
            the cracks while employers had million-dollar HR systems.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Origin Story */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">How this started</h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-lg text-slate-700 leading-relaxed mb-4">
              In 2023, a steward from a healthcare union in Ontario was managing 47 open
              grievances in a shared Excel file. One day, someone accidentally deleted a
              column. Weeks of documentation—gone. No backup. No audit trail. Just
              frustration and members waiting for justice.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed mb-4">
              Meanwhile, the employer had a sophisticated HR system that tracked every
              interaction, every timeline, every deadline. The power imbalance wasn&apos;t just
              in the boardroom—it was in the tools.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed mb-4">
              That&apos;s when we asked: <strong>What if unions had infrastructure?</strong>
            </p>
            <p className="text-lg text-slate-700 leading-relaxed">
              Not software that &ldquo;disrupts&rdquo; or &ldquo;scales.&rdquo; Not a SaaS product designed by people
              who&apos;ve never walked a picket line. <strong>Infrastructure</strong>—the kind that
              utilities and governments have. The kind that doesn&apos;t break. The kind that
              respects the seriousness of the work.
            </p>
          </div>
        </section>

        {/* Core Principles */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            What we stand for
          </h2>
          <div className="space-y-6">
            <PrincipleCard
              icon={<Users className="h-6 w-6" />}
              title="Organizers are the central actors"
              description="Technology serves people, never replaces them. Stewards make the decisions. The system provides support. There is no 'AI case manager.' There never will be."
            />
            <PrincipleCard
              icon={<Shield className="h-6 w-6" />}
              title="No surveillance, no weaponized metrics"
              description="We don&apos;t track 'organizer productivity' or 'case closure rates.' We don&apos;t build leaderboards. We don&apos;t measure things that could be used against workers. System health, yes. People surveillance, never."
            />
            <PrincipleCard
              icon={<Heart className="h-6 w-6" />}
              title="Human dignity comes first"
              description="Every grievance represents a person who was wronged. We treat that with the seriousness it deserves. No gamification. No corporate cheerfulness. Just respect."
            />
            <PrincipleCard
              icon={<Handshake className="h-6 w-6" />}
              title="Democratic governance baked in"
              description="Union Eyes has a golden share structure. Union members elect representatives who can veto any sale or mission change. This isn&apos;t marketing—it&apos;s in our shareholder agreement."
            />
          </div>
        </section>

        {/* Co-Design Process */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            How we build
          </h2>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              Every feature is co-designed with organizers
            </h3>
            <ul className="space-y-3 text-slate-700">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                  1
                </span>
                <span>
                  <strong>Listen first:</strong> We sit with stewards and watch them work.
                  What breaks? What causes stress?
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                  2
                </span>
                <span>
                  <strong>Build in the open:</strong> Prototypes go to organizers first, not
                  investors. Does it feel right? Does it respect the work?
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                  3
                </span>
                <span>
                  <strong>Test with real cases:</strong> Pilots run for months. We measure
                  impact on <em>members</em> and <em>organizers</em>, not conversion rates.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                  4
                </span>
                <span>
                  <strong>Iterate forever:</strong> Labor law changes. Organizing strategies
                  evolve. We adapt with the movement, not according to a product roadmap.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            In their own words
          </h2>
          <div className="space-y-6">
            <TestimonialCard
              quote="For the first time, I can actually see all my cases in one place. I&apos;m not drowning in sticky notes. I&apos;m not afraid of losing documentation. I can focus on fighting for my members."
              author="Maria R."
              role="Shop Steward, Healthcare Union"
            />
            <TestimonialCard
              quote="They asked us what would make our jobs easier, not what would make us more 'efficient.' That difference matters. They understand we&apos;re not trying to optimize—we&apos;re trying to win."
              author="James T."
              role="Chief Steward, Manufacturing Local"
            />
            <TestimonialCard
              quote="I was skeptical. Another tech startup promising to fix unions? But then I saw they had a golden share for union members. They put democratic control in the shareholder agreement. That changed everything."
              author="Aisha K."
              role="Union Executive, Public Service Alliance"
            />
          </div>
        </section>

        {/* What We&apos;re Not */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            What we&apos;re <em>not</em>
          </h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  ❌ We&apos;re not &ldquo;disrupting&rdquo; labor
                </h3>
                <p className="text-sm text-red-800">
                  Unions don&apos;t need disruption. They need support.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  ❌ We&apos;re not replacing organizers
                </h3>
                <p className="text-sm text-red-800">
                  AI doesn&apos;t organize. People do. We amplify, never replace.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  ❌ We&apos;re not selling your data
                </h3>
                <p className="text-sm text-red-800">
                  Member data is sacred. No resale, no ads, no monetization.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  ❌ We&apos;re not venture-backed growth-hackers
                </h3>
                <p className="text-sm text-red-800">
                  We grow with union trust, not by burning capital.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Governance Transparency */}
        <section className="mb-16">
          <CalloutPresets.BuiltWithUnions />
          <div className="mt-6">
            <Button variant="outline" asChild>
              <Link href="/trust">View our trust dashboard →</Link>
            </Button>
          </div>
        </section>

        {/* Call to Action */}
        <section className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Ready to see if we&apos;re the right fit?
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            We don&apos;t do demos. We do conversations. Tell us about your challenges. We&apos;ll
            be honest about whether Union Eyes can help—or if something else would serve you
            better.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/pilot-request">Request a pilot program</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/contact">Start a conversation</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * Helper Components
 */
interface PrincipleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function PrincipleCard({ icon, title, description }: PrincipleCardProps) {
  return (
    <div className="flex gap-4 p-6 bg-white border border-slate-200 rounded-lg">
      <div className="shrink-0 w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-700">{description}</p>
      </div>
    </div>
  );
}

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
}

function TestimonialCard({ quote, author, role }: TestimonialCardProps) {
  return (
    <div className="bg-slate-50 border-l-4 border-blue-600 p-6 rounded-r-lg">
      <p className="text-lg text-slate-800 italic mb-4">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-semibold">
          {author.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{author}</p>
          <p className="text-sm text-slate-600">{role}</p>
        </div>
      </div>
    </div>
  );
}
