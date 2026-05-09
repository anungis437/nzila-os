/**
 * Organizational Memory — Platform module page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Clock, Search, Archive, Users, Layers } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';

export const metadata: Metadata = {
  title: 'Organizational Memory | Union Eyes Platform',
  description:
    'Preserve institutional knowledge across leadership transitions. Union Eyes Organizational Memory makes decades of institutional context operationally accessible.',
};

const capabilities = [
  { icon: BookOpen,  title: 'Precedent Preservation',       desc: 'Negotiation history, arbitration precedents, and institutional decisions preserved and searchable across decades.' },
  { icon: Clock,     title: 'Historical Context Access',     desc: 'Surface the historical context that informs present decisions — bylaws evolution, policy history, relationship maps.' },
  { icon: Search,    title: 'Institutional Knowledge Search', desc: 'Search across institutional memory with context-aware retrieval — not keyword matching, but organizational understanding.' },
  { icon: Archive,   title: 'Knowledge Capture',             desc: 'Systematically capture tacit knowledge before it walks out the door during leadership transitions.' },
  { icon: Users,     title: 'Succession Knowledge Transfer',  desc: 'Structured knowledge transfer pathways for incoming leaders, with institutional context intact.' },
  { icon: Layers,    title: 'Memory Continuity Mapping',     desc: 'Identify knowledge gaps and continuity vulnerabilities before they become organizational crises.' },
];

export default function OrganizationalMemoryPage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.organizationalMemoryModule}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            Platform · Organizational Memory
          </span>
        }
        heading={<>Institutional knowledge that<br />outlasts any individual leader.</>}
        description="Organizational Memory transforms tacit institutional knowledge into governed, accessible, and operationally useful organizational intelligence — so your institution remembers what it has learned across every generation of leadership."
        cta={
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
            Request a Demo
          </Link>
        }
      />

      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl font-bold text-navy mb-4">What gets lost without organizational memory</h2>
            <p className="text-gray-700 leading-relaxed">
              When an experienced union officer retires, your organization loses: negotiation strategies
              that took years to develop, relationship histories with employers and political allies,
              governance decisions and the reasoning behind them, and the institutional wisdom that
              prevents repeating costly mistakes.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((c) => (
              <div key={c.title} className="p-6 rounded-2xl bg-white border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <c.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-sm font-bold text-navy mb-2">{c.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Preserve what your institution knows</h2>
          <p className="text-white/70 mb-8">Request a demo to see Organizational Memory in action.</p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request a Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
