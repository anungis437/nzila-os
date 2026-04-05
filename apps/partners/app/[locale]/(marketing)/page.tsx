"use client";

import Link from "next/link";
import Image from "next/image";
import { ScrollReveal } from "@/components/public/scroll-reveal";

const stats = [
  { value: "120+", label: "Active Partners" },
  { value: "3", label: "Partner Tiers" },
  { value: "$4M+", label: "Partner Revenue" },
  { value: "92%", label: "Renewal Rate" },
];

const features = [
  {
    title: "Deal Registration",
    description:
      "Register and track deals through every pipeline stage with built-in deal protection, conflict resolution, and automated approvals.",
    icon: "🚀",
  },
  {
    title: "Commission Dashboard",
    description:
      "Real-time visibility into earnings, payouts, and tier multipliers. Automated calculations and transparent payout schedules.",
    icon: "💰",
  },
  {
    title: "Certifications & Training",
    description:
      "Role-based learning tracks with digital badges that unlock tier advancement, margin bumps, and co-sell eligibility.",
    icon: "🎓",
  },
  {
    title: "Co-Marketing Hub",
    description:
      "Co-branded collateral, campaign templates, MDF requests, and joint go-to-market playbooks ready to deploy.",
    icon: "📢",
  },
  {
    title: "API & Integration Hub",
    description:
      "Manage OAuth credentials, configure webhooks, monitor integration health, and access sandbox environments.",
    icon: "⚡",
  },
  {
    title: "Performance Analytics",
    description:
      "Pipeline analytics, tier progress tracking, peer benchmarking, and quarterly business review dashboards.",
    icon: "📊",
  },
];

export default function MarketingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80"
          alt="Business professionals shaking hands in a modern office"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-navy/85" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 30%, rgba(99,102,241,0.2) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-32">
          <ScrollReveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
              </span>
              120+ Active Channel Partners
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="max-w-3xl font-poppins text-5xl font-bold leading-tight text-white md:text-7xl">
              Grow with{" "}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400 bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-x">
                Nzila
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
              Your single pane of glass for deal registration, commissions,
              certifications, co-marketing, and API integrations. Built for
              channel partners, technology integrators, and enterprise clients.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/sign-up"
                className="rounded-xl bg-blue-500 px-8 py-4 font-poppins font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-400 hover:shadow-xl hover:shadow-blue-500/30"
              >
                Apply for Partnership
              </Link>
              <Link
                href="/portal"
                className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-poppins font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                Partner Portal
              </Link>
            </div>
          </ScrollReveal>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
            <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-white/20 p-1">
              <div className="h-2 w-1 animate-bounce rounded-full bg-white/60" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-navy-light">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {stats.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={i * 0.1}>
              <div className="text-center">
                <div className="font-poppins text-3xl font-bold text-white md:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <div className="text-center">
              <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
                Everything Partners Need
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                Deal flow, earnings, training, and co-marketing — all in one
                portal
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 0.1}>
                <div className="group rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">
                    {feature.icon}
                  </div>
                  <h3 className="font-poppins text-lg font-semibold text-navy">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {feature.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Partnership */}
      <section id="partnership" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div>
                <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
                  A Partner Program That Pays
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-slate-600">
                  Three tiers — Silver, Gold, and Platinum — each unlocking
                  higher commission multipliers, priority deal protection, MDF
                  access, and dedicated partner success management.
                </p>
                <p className="mt-4 font-poppins font-semibold text-blue-600">
                  92% partner renewal rate — because the economics work.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative overflow-hidden rounded-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80"
                  alt="Team collaborating around a table with laptops"
                  width={800}
                  height={600}
                  className="rounded-2xl object-cover"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-navy/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 font-poppins text-sm font-bold text-white">
                      NP
                    </div>
                    <div>
                      <div className="font-poppins text-sm font-semibold text-white">
                        Nzila Partners
                      </div>
                      <div className="text-xs text-slate-300">
                        Powered by NzilaOS
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-navy py-24">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, rgba(59,130,246,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(99,102,241,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-white md:text-5xl">
              Ready to Partner with Nzila?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
              Join 120+ channel partners, integrators, and resellers growing
              their business with the NzilaOS ecosystem.
            </p>
            <div className="mt-10">
              <Link
                href="/sign-up"
                className="rounded-xl bg-blue-500 px-10 py-4 font-poppins text-lg font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-400 hover:shadow-xl"
              >
                Apply for Partnership
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
