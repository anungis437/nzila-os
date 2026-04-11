import type { Metadata } from 'next';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'Status — Zonga',
  description: 'Real-time operational status of the Zonga platform services.',
};

const services = [
  { name: 'Web App', status: 'operational' as const },
  { name: 'API', status: 'operational' as const },
  { name: 'Catalog Ingestion', status: 'operational' as const },
  { name: 'Audio Fingerprinting', status: 'operational' as const },
  { name: 'Payout Processing', status: 'operational' as const },
  { name: 'Event Ticketing', status: 'operational' as const },
  { name: 'Authentication', status: 'operational' as const },
  { name: 'Media Storage', status: 'operational' as const },
];

const statusConfig = {
  operational: { label: 'Operational', dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  degraded: { label: 'Degraded', dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50' },
  outage: { label: 'Outage', dot: 'bg-red-400', text: 'text-red-600', bg: 'bg-red-50' },
};

export default function StatusPage() {
  const allOperational = services.every((s) => s.status === 'operational');

  return (
    <main className="min-h-screen">
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
              System Status
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Platform <span className="gradient-text">Status</span>
            </h1>
            {allOperational && (
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                <div className="relative w-2.5 h-2.5 rounded-full bg-emerald-400">
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
                </div>
                All Systems Operational
              </div>
            )}
          </ScrollReveal>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border rounded-xl overflow-hidden divide-y">
            {services.map((svc, i) => {
              const cfg = statusConfig[svc.status];
              return (
                <ScrollReveal key={svc.name} delay={i * 0.04}>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="font-medium text-navy">{svc.name}</span>
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">
            Last checked: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </section>
    </main>
  );
}
