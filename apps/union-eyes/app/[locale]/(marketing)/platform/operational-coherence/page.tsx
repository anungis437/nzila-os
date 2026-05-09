/**
 * Operational Coherence — Platform module page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Network, RefreshCw, BarChart3, Users, Layers, AlertCircle } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';

export const metadata: Metadata = {
  title: 'Operational Coherence | Union Eyes Platform',
  description:
    'Maintain operational coherence across distributed teams and leadership transitions. Union Eyes Operational Coherence platform module.',
};

const capabilities = [
  { icon: Network,     title: 'Cross-Functional Alignment',     desc: 'Surface alignment and coherence across distributed teams, regional offices, and functional departments.' },
  { icon: RefreshCw,   title: 'Continuity Through Transition',   desc: 'Maintain operational coherence during reorganization, succession, and structural change.' },
  { icon: BarChart3,   title: 'Operational Health Visibility',   desc: 'Executive-grade operational health indicators that surface coherence risks before they become crises.' },
  { icon: Users,       title: 'Team Continuity Mapping',         desc: 'Track continuity health across teams, identify knowledge transfer gaps, and plan for resilience.' },
  { icon: Layers,      title: 'Institutional Fragmentation Risk', desc: 'Identify the organizational fragmentation patterns that undermine long-term institutional effectiveness.' },
  { icon: AlertCircle, title: 'Operational Resilience Planning',  desc: 'Build resilience pathways before operational fragilities become continuity crises.' },
];

export default function OperationalCoherencePage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.operationalCoherenceModule}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            Platform · Operational Coherence
          </span>
        }
        heading={<>Distributed operations.<br />Unified institutional coherence.</>}
        description="Operational Coherence ensures that complex, distributed labour organizations maintain alignment, institutional continuity, and operational resilience — even through change, transition, and modernization."
        cta={
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
            Request a Demo
          </Link>
        }
      />

      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-3 text-center">Operational coherence capabilities</h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
            Built for the operational complexity of large, distributed labour organizations.
          </p>
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
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Maintain operational coherence through change</h2>
          <p className="text-white/70 mb-8">See Operational Coherence in a live platform demonstration.</p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request a Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
