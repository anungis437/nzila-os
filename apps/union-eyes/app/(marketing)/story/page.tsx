// cognition-governance-ci: file-allow-vocabulary — Marketing/anti-surveillance copy: this file declares what the platform DOES NOT DO. Forbidden terms appear deliberately in negated context.
/**
 * Story Page - Our Story
 * 
 * Purpose: Authentic founder narrative about UnionEyes' origins
 * Audience: Union leadership, organizers, member representatives
 * 
 * Tone: Personal, authentic, founder-driven
 * Message: Two brothers — one who lived labour, one who builds technology.
 */


export const dynamic = 'force-dynamic';

import * as React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Heart, Users, Shield, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Our Story | UnionEyes',
  description:
    'UnionEyes begins with two brothers, two careers, and one shared conviction: unions deserve better tools.',
};

export default function StoryPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full text-sm text-red-700 font-medium mb-6">
            <Heart className="h-4 w-4" />
            <span>Our Story</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Two brothers. Two careers.<br />One shared conviction.
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            UnionEyes begins with a Labour Relations Officer turned lawyer
            and a CIO turned SaaS builder — and the moment their paths
            converged on an obvious opportunity.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Origin Story */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Where it all began</h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-lg text-slate-700 leading-relaxed mb-4">
              Mike spent years on the inside — first as a Labour Relations Officer for
              a national union, then as a lawyer conducting workplace investigations
              and assessments. Moving from working <em>in</em> a union to working <em>with</em> unions
              gave him an unfiltered view of where the friction lived: the workflows,
              the gaps, the moments where the right information simply wasn&apos;t in the
              right hands.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed mb-4">
              Oby took a different path. As CIO of a national sporting association
              and a seasoned SaaS builder, he made a career out of one idea — that
              technology should feel human. That the most powerful platforms are the
              ones people actually use.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed mb-4">
              When their paths converged, the opportunity was obvious. Mike knew
              exactly what was broken. Oby knew exactly how to fix it.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed font-semibold">
              UnionEyes is what happened next.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="mb-16">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              Our mission
            </h3>
            <p className="text-lg text-slate-700 leading-relaxed">
              Put the same clarity, accountability, and operational control that large
              organizations take for granted into the hands of every union — built by
              someone who lived it, and someone who knows how to scale it.
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
              description="UnionEyes has a golden share structure. Union members elect representatives who can veto any sale or mission change. This isn&apos;t marketing—it&apos;s in our shareholder agreement."
              learnMoreHref="/governance"
              learnMoreLabel="How the golden share works →"
            />
          </div>
        </section>

        {/* Call to Action */}
        <section className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Ready to see if we&apos;re the right fit?
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            We don&apos;t do demos. We do conversations. Tell us about your challenges. We&apos;ll
            be honest about whether UnionEyes can help — or if something else would serve you
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
  learnMoreHref?: string;
  learnMoreLabel?: string;
}

function PrincipleCard({ icon, title, description, learnMoreHref, learnMoreLabel }: PrincipleCardProps) {
  return (
    <div className="flex gap-4 p-6 bg-white border border-slate-200 rounded-lg">
      <div className="shrink-0 w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-700">{description}</p>
        {learnMoreHref && learnMoreLabel && (
          <Link href={learnMoreHref} className="inline-block mt-3 text-sm font-semibold text-blue-700 hover:underline">
            {learnMoreLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
