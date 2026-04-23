/**
 * Governance & Golden Share Explainer
 *
 * Plain-language explanation of the UnionEyes golden share structure
 * and democratic governance model. Linked from the Story page.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Users, FileText, Vote } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Governance Structure | UnionEyes',
  description:
    'How the UnionEyes golden share works — and why it means labour can never lose control of this platform.',
};

const provisions = [
  {
    icon: Vote,
    title: 'Veto on change of control',
    body: 'The golden share gives the Labour Council the right to block any proposed sale, merger, or transfer of controlling interest in UnionEyes. No acquisition can proceed without affirmative approval from elected labour representatives.',
  },
  {
    icon: Shield,
    title: 'Mission lock',
    body: "Any amendment to the company's stated mission — to build technology exclusively in service of workers and their unions — requires golden share consent. The mission is not adjustable by investors or a new board.",
  },
  {
    icon: Users,
    title: 'Labour-elected council seats',
    body: 'Two board seats are reserved for individuals elected by UnionEyes pilot partners. These are not advisory roles. They are full board seats with voting rights on all major decisions, including executive compensation and capital allocation.',
  },
  {
    icon: FileText,
    title: 'Reserved matters',
    body: 'Certain decisions — including pricing changes that exceed CPI, introducing data-sharing arrangements with third parties, and changes to the data residency policy — are "reserved matters" that cannot pass without golden share consent.',
  },
];

export default function GovernancePage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <section className="bg-navy text-white py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white mb-6">
            Governance
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            The golden share, explained
          </h1>
          <p className="text-white/80 text-lg max-w-2xl">
            This isn&apos;t a brand promise. It&apos;s a legal structure. Here is exactly what
            it means and what it prevents.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* What it is */}
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-4">What is a golden share?</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            A golden share is a special class of equity that carries veto rights over
            specific decisions, regardless of how many ordinary shares other investors
            hold. It originated in privatisation law and has since been used to protect
            public-interest entities from hostile takeovers or mission drift.
          </p>
          <p className="text-gray-700 leading-relaxed">
            In UnionEyes&apos;s case, the golden share is held by a Labour Council — a body
            elected by our pilot partner unions. This structure was put in place at
            incorporation, not retrofitted after the fact. It cannot be dissolved without
            the golden shareholder&apos;s consent.
          </p>
        </div>

        {/* Provisions */}
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">What the golden share protects</h2>
          <div className="space-y-6">
            {provisions.map((p) => (
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

        {/* FAQ */}
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">Frequently asked</h2>
          <div className="space-y-6 divide-y divide-gray-100">
            {[
              {
                q: 'What if UnionEyes raises venture capital?',
                a: 'Investors can hold ordinary shares and receive returns. The golden share sits in a separate class and cannot be diluted or converted. Investors are informed of this structure before they invest.',
              },
              {
                q: 'What happens if the company is wound up?',
                a: 'The articles of incorporation include a dissolution clause: residual assets after creditors are paid go first to the Labour Council reserve fund, not to shareholders. We will update this page if that changes.',
              },
              {
                q: 'Can I see the actual shareholder agreement?',
                a: "We're preparing a redacted version for publication. In the meantime, union legal counsel can request a full copy for due diligence purposes — contact us directly.",
              },
              {
                q: 'Who sits on the Labour Council today?',
                a: "During the pilot phase, the council is composed of representatives from pilot partner locals. Full elections will be held once we reach 10 active member organizations. We'll publish the council composition here at that time.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="pt-6 first:pt-0">
                <h3 className="font-semibold text-navy mb-2">{q}</h3>
                <p className="text-gray-700 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Back link */}
        <div className="border-t border-gray-100 pt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/story"
            className="text-sm text-electric font-semibold hover:underline"
          >
            ← Back to Our Story
          </Link>
          <Link
            href="/trust"
            className="text-sm text-electric font-semibold hover:underline"
          >
            View Trust Dashboard →
          </Link>
        </div>
      </section>
    </div>
  );
}
