import type { Metadata } from 'next';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'API Reference — Zonga',
  description: 'REST API documentation for integrating with the Zonga music platform.',
};

const endpoints = [
  {
    group: 'Catalog',
    base: '/api/catalog',
    routes: [
      { method: 'GET', path: '/api/catalog', description: 'List all content assets for the org' },
      { method: 'POST', path: '/api/catalog', description: 'Create a new content asset (track, album, video)' },
      { method: 'GET', path: '/api/catalog/:id', description: 'Retrieve a single asset by ID' },
    ],
  },
  {
    group: 'Creators',
    base: '/api/creators',
    routes: [
      { method: 'GET', path: '/api/creators', description: 'List creators in the org' },
      { method: 'POST', path: '/api/creators', description: 'Register a new creator' },
      { method: 'GET', path: '/api/creators/:id', description: 'Retrieve creator profile' },
    ],
  },
  {
    group: 'Revenue',
    base: '/api/revenue',
    routes: [
      { method: 'GET', path: '/api/revenue', description: 'List revenue events with optional filters' },
      { method: 'POST', path: '/api/revenue', description: 'Record a new revenue event' },
    ],
  },
  {
    group: 'Payouts',
    base: '/api/payouts',
    routes: [
      { method: 'GET', path: '/api/payouts', description: 'List payouts with status filters' },
      { method: 'POST', path: '/api/payouts', description: 'Initiate a new payout' },
      { method: 'GET', path: '/api/payouts/:id', description: 'Retrieve payout details and ledger entries' },
    ],
  },
  {
    group: 'Events',
    base: '/api/events',
    routes: [
      { method: 'GET', path: '/api/events', description: 'List events for the org' },
      { method: 'POST', path: '/api/events', description: 'Create a new event with ticket types' },
      { method: 'GET', path: '/api/events/:id', description: 'Retrieve event details and ticket info' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function ApiReferencePage() {
  return (
    <main className="min-h-screen">
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
              API Reference
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Build on <span className="gradient-text">Zonga</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              RESTful APIs for catalog management, revenue tracking, payouts, and event ticketing.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {endpoints.map((group, i) => (
            <ScrollReveal key={group.group} delay={i * 0.08}>
              <div>
                <h2 className="text-2xl font-bold text-navy mb-2">{group.group}</h2>
                <p className="text-sm text-gray-400 mb-6 font-mono">{group.base}</p>
                <div className="border rounded-xl overflow-hidden divide-y">
                  {group.routes.map((r) => (
                    <div key={`${r.method}-${r.path}`} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold font-mono ${methodColors[r.method] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.method}
                      </span>
                      <code className="text-sm text-navy font-mono flex-shrink-0">{r.path}</code>
                      <span className="text-sm text-gray-500 ml-auto hidden sm:block">{r.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="glass-card-light rounded-2xl p-8">
              <h3 className="text-xl font-bold text-navy mb-4">Authentication</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                All API requests require a valid session token passed as a Bearer token in the Authorization header.
                Requests are scoped to the active organization.
              </p>
              <div className="bg-navy rounded-lg p-4 font-mono text-sm text-gray-300">
                <span className="text-electric">Authorization:</span> Bearer {'<session_token>'}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl font-bold text-white mb-6">
              Questions about the API?
            </h2>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
            >
              Contact Us
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
