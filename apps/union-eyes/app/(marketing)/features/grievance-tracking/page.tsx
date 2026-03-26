/**
 * Case & Grievance Management — Platform module page
 *
 * Describes the grievance lifecycle management system.
 * Tone: Practical, organizer-first. References real features in the app.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Metadata } from 'next';
import {
  FileText,
  Search,
  ShieldCheck,
  BarChart3,
  Clock,
  ArrowRight,
  Scale,
  Layers,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Grievance Tracking | Union Eyes',
  description:
    'End-to-end grievance management — from intake to arbitration. Smart case queues, AI triage, evidence packs, and precedent research built for stewards.',
};

const features = [
  {
    icon: FileText,
    title: 'Guided Intake',
    description:
      'A step-by-step filing form that captures grievance type, priority, incident details, and desired outcome — so nothing gets missed at intake.',
  },
  {
    icon: Layers,
    title: 'Full Lifecycle Tracking',
    description:
      'Every grievance moves through intake, triage, investigation, mediation, arbitration, and settlement with clear status at every step.',
  },
  {
    icon: Search,
    title: 'Precedent Engine',
    description:
      'Search labour arbitration case law by similarity. Get strengths, weaknesses, and critical factors surfaced automatically to prepare stronger cases.',
  },
  {
    icon: ShieldCheck,
    title: 'Tamper-Evident Evidence Packs',
    description:
      'Bundle documents into evidence packs with SHA-256 hash chain verification stored in immutable cloud storage. Built for arbitration.',
  },
  {
    icon: Clock,
    title: 'Smart Case Queue',
    description:
      'Filter by status, priority, employer, or steward. See workload at a glance — active cases, overdue items, and average days in each stage.',
  },
  {
    icon: Scale,
    title: 'AI-Assisted Triage',
    description:
      'Optional AI scoring for priority, complexity, and category. Suggests relevant CBA clauses and precedents. Always under human control — enabled per organization via feature flag.',
  },
];

export default function GrievanceTrackingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-full text-sm text-violet-700 font-medium mb-6">
            <FileText className="h-4 w-4" />
            <span>Core Module</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Grievance tracking that actually works for stewards
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            No more spreadsheets, no more lost documents. Track every grievance
            from the moment it&apos;s filed to the day it&apos;s resolved — with the
            evidence chain employers can&apos;t dispute.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-violet-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            How a grievance moves through the system
          </h2>
          <div className="flex flex-col md:flex-row items-start gap-4">
            {[
              { step: '1', label: 'File', desc: 'Steward fills guided intake form' },
              { step: '2', label: 'Triage', desc: 'Assign priority and responsible steward' },
              { step: '3', label: 'Investigate', desc: 'Gather evidence, research precedents' },
              { step: '4', label: 'Negotiate', desc: 'Mediation with employer' },
              { step: '5', label: 'Resolve', desc: 'Settlement, arbitration, or withdrawal' },
            ].map((item, i) => (
              <div key={item.step} className="flex-1 text-center">
                <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h4 className="font-semibold text-slate-900 mb-1">{item.label}</h4>
                <p className="text-sm text-slate-500">{item.desc}</p>
                {i < 4 && (
                  <ArrowRight className="h-4 w-4 text-slate-300 mx-auto mt-3 hidden md:block rotate-0" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            See it in action
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            We&apos;re piloting grievance tracking with unions like CUPE and CAPE.
            Request a walkthrough — no pitch deck, just the real tool.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pilot-request"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors text-sm"
            >
              Request a Pilot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/story"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              Read Our Story
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
