"use client";

import Link from "next/link";
import { ScrollReveal } from "@/components/public/scroll-reveal";

const audience = [
  "HR and People Ops teams",
  "Unions and associations",
  "Universities and colleges",
  "Public sector and municipalities",
  "Healthcare networks and hospitals",
  "Federations and member organizations",
];

const pains = [
  {
    title: "Case handling is fragmented",
    description: "Critical context lives across email, spreadsheets, and inconsistent local practices.",
  },
  {
    title: "SLA ownership is unclear",
    description: "Teams struggle to enforce deadlines and escalation accountability across departments.",
  },
  {
    title: "Reporting is manual and risky",
    description: "Leadership and oversight updates take too long and are hard to defend under scrutiny.",
  },
];

const roiSignals = [
  "Faster resolution time on scoped case workflows",
  "Reduced missed SLAs through assignment and escalation visibility",
  "Lower reporting effort through structured evidence and exports",
  "Improved manager confidence through consistent operating workflows",
];

const procurementReadiness = [
  "Pilot proposal, annual SaaS, and public sector proposal templates",
  "Security one-pager and procurement checklist",
  "Role-aware governance and evidence-handling summaries",
  "Implementation timeline and success-metric framework",
];

const securityPosture = [
  "Role-based workflow and access controls",
  "Auditable case operations and export artifacts",
  "Evidence integrity process and verification workflow",
  "Policy-gated operations for trust-sensitive workflows",
];

const implementationSpeed = [
  { phase: "Week 1", detail: "Discovery, baseline KPI mapping, and scope lock" },
  { phase: "Week 2-3", detail: "Intake, assignment, SLA, and reporting setup" },
  { phase: "Week 4-6", detail: "Operational adoption and governance checkpoints" },
  { phase: "Week 7-8", detail: "Proof review and annual conversion plan" },
];

const faq = [
  {
    question: "Do we need to replace our current systems?",
    answer:
      "No. CourtLens can be deployed as the specialized intake, triage, and matter-management operating layer while existing systems remain in place.",
  },
  {
    question: "Can we start with one department before enterprise rollout?",
    answer:
      "Yes. The standard motion is a scoped pilot in one unit, then expansion by department once KPI outcomes are proven.",
  },
  {
    question: "How do you handle security and procurement review?",
    answer:
      "CourtLens includes procurement-ready security and governance collateral to support enterprise and public-sector review cycles.",
  },
  {
    question: "What is a realistic pilot timeline?",
    answer:
      "Eight weeks with weekly checkpoints, a baseline-to-proof scorecard, and a day-60 annual conversion decision.",
  },
];

export default function MarketingPage() {
  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-2xl -translate-x-1/2 rounded-2xl border border-white/20 bg-navy/95 p-3 shadow-2xl backdrop-blur md:bottom-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            CourtLens Revenue Motion
          </p>
          <div className="flex gap-2">
            <Link
              href="/sign-up?intent=demo"
              className="rounded-lg bg-electric px-4 py-2 text-sm font-semibold text-white hover:bg-electric/90"
            >
              Book Demo
            </Link>
            <Link
              href="/sign-up?intent=pilot"
              className="rounded-lg border border-white/25 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Launch Pilot
            </Link>
          </div>
        </div>
      </div>

      <section className="relative flex min-h-[86vh] items-center overflow-hidden bg-navy pb-28">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.45) 0%, transparent 45%), radial-gradient(circle at 80% 30%, rgba(212,168,67,0.35) 0%, transparent 42%), linear-gradient(145deg, #071128 0%, #0b1732 40%, #0c1f3f 100%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-32">
          <ScrollReveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200">
              CourtLens Flagship Platform
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="max-w-4xl font-poppins text-5xl font-bold leading-tight text-white md:text-7xl">
              CourtLens
              <span className="mt-3 block bg-linear-to-r from-electric-light via-gold to-electric-light bg-clip-text text-transparent">
                Access to justice. Evidence-backed. Referral-ready.
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-200 md:text-xl">
              Governed access-to-justice and legal matter-intelligence platform.
              Converts intake into triaged, evidence-backed, human-reviewed matters
              and referral-ready outputs — currently configured for housing,
              employment and debt practice areas. Built on the ABR technical
              substrate; retains FAIRCASE tribunal-intelligence capabilities.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/sign-up?intent=demo"
                className="rounded-xl bg-electric px-8 py-4 font-poppins font-semibold text-white shadow-lg shadow-electric/30 transition-all hover:bg-electric/90"
              >
                Book Demo
              </Link>
              <Link
                href="/sign-up?intent=pilot"
                className="rounded-xl border border-white/25 bg-white/5 px-8 py-4 font-poppins font-semibold text-white transition-all hover:bg-white/10"
              >
                Launch Pilot
              </Link>
            </div>
          </ScrollReveal>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              "Enterprise-grade workflow governance",
              "Pilot-to-annual conversion system",
              "Procurement and security readiness",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
              Who It Is For
            </h2>
          </ScrollReveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {audience.map((item, index) => (
              <ScrollReveal key={item} delay={index * 0.05}>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-700">
                  {item}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
              Pains Solved
            </h2>
          </ScrollReveal>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {pains.map((pain, index) => (
              <ScrollReveal key={pain.title} delay={index * 0.08}>
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="font-poppins text-lg font-semibold text-navy">{pain.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{pain.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <ScrollReveal>
              <div className="rounded-2xl border border-slate-200 p-7">
                <h2 className="font-poppins text-2xl font-bold text-navy">ROI Proof Model</h2>
                <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-600">
                  {roiSignals.map((item) => (
                    <li key={item} className="rounded-lg bg-slate-50 px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="rounded-2xl border border-slate-200 p-7">
                <h2 className="font-poppins text-2xl font-bold text-navy">Procurement Readiness</h2>
                <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-600">
                  {procurementReadiness.map((item) => (
                    <li key={item} className="rounded-lg bg-slate-50 px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <ScrollReveal>
              <div className="rounded-2xl border border-slate-200 bg-white p-7">
                <h2 className="font-poppins text-2xl font-bold text-navy">Security Posture</h2>
                <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-600">
                  {securityPosture.map((item) => (
                    <li key={item} className="rounded-lg bg-slate-50 px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="rounded-2xl border border-slate-200 bg-white p-7">
                <h2 className="font-poppins text-2xl font-bold text-navy">Implementation Speed</h2>
                <div className="mt-5 space-y-3">
                  {implementationSpeed.map((item) => (
                    <div key={item.phase} className="rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-navy">{item.phase}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">Testimonials</h2>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">
              Placeholders below are ready for approved customer references as pilots convert.
            </p>
          </ScrollReveal>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {["HR Enterprise Buyer", "Union Operations Leader", "Public Sector Sponsor"].map((item) => (
              <div key={item} className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Placeholder</p>
                <p className="mt-3 text-sm text-slate-600">
                  Insert approved customer quote and measurable outcome after reference approval.
                </p>
                <p className="mt-4 text-sm font-semibold text-navy">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">FAQ</h2>
          </ScrollReveal>
          <div className="mt-8 space-y-4">
            {faq.map((item, index) => (
              <ScrollReveal key={item.question} delay={index * 0.06}>
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="font-poppins text-lg font-semibold text-navy">{item.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.answer}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy py-24">
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, rgba(37,99,235,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(212,168,67,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-white md:text-5xl">
              Ready to Move CourtLens from Interest to Contract?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
              Book a focused demo or launch an 8-week pilot to prove value and
              convert with confidence.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/sign-up?intent=demo"
                className="rounded-xl bg-electric px-10 py-4 font-poppins text-lg font-semibold text-white shadow-lg shadow-electric/25 hover:bg-electric/90"
              >
                Book Demo
              </Link>
              <Link
                href="/sign-up?intent=pilot"
                className="rounded-xl border border-white/25 bg-white/5 px-10 py-4 font-poppins text-lg font-semibold text-white hover:bg-white/10"
              >
                Launch Pilot
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
