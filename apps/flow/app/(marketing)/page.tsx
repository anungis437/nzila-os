"use client";

import Link from "next/link";
import Image from "next/image";
import { ScrollReveal } from "@/components/public/scroll-reveal";

const stats = [
  { value: "5,000+", label: "Quotes Created" },
  { value: "99.9%", label: "Tax Accuracy" },
  { value: "200+", label: "Businesses" },
  { value: "3x", label: "Faster Proposals" },
];

const features = [
  {
    title: "Smart Quoting",
    description:
      "Create tiered proposals (Budget / Standard / Premium) with automatic tax calculations and margin tracking.",
    icon: "📋",
  },
  {
    title: "AI-Assisted Pricing",
    description:
      "Leverage AI-powered pricing suggestions with full audit trail and governance review for every pricing decision.",
    icon: "✨",
  },
  {
    title: "Evidence-First Audit",
    description:
      "Every quote transition produces hash-chained audit entries for IRAP compliance and complete decision traceability.",
    icon: "🔒",
  },
  {
    title: "Margin Analytics",
    description:
      "Real-time margin tracking with configurable floor gates per org, ensuring profitability on every quote.",
    icon: "📊",
  },
  {
    title: "Client Management",
    description:
      "Organize clients, track quote history, and build lasting relationships with CRM-integrated workflows.",
    icon: "👥",
  },
  {
    title: "Bulk Import",
    description:
      "Import product catalogs, client lists, and pricing data from CSV/Excel with validation and conflict resolution.",
    icon: "📦",
  },
];

export default function MarketingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&q=80"
          alt="Professional quoting"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-navy/85" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, rgba(37,99,235,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 30%, rgba(212,168,67,0.2) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-32">
          <ScrollReveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
              </span>
              NzilaOS Commerce Engine
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="max-w-3xl font-poppins text-5xl font-bold leading-tight text-white md:text-7xl">
              Professional Quoting,{" "}
              <span className="bg-gradient-to-r from-electric-light via-gold to-electric-light bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-x">
                Made Simple
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
              Create tiered proposals, calculate taxes automatically, and
              track every decision with an evidence-first audit trail powered by
              AI.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/sign-up"
                className="rounded-xl bg-electric px-8 py-4 font-poppins font-semibold text-white shadow-lg shadow-electric/25 transition-all hover:bg-electric/90 hover:shadow-xl hover:shadow-electric/30"
              >
                Start Quoting
              </Link>
              <Link
                href="/features"
                className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-poppins font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                See Features
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
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <div className="text-center">
              <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
                Everything You Need to Quote Smarter
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                Built for gift box businesses that demand accuracy and speed
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 0.1}>
                <div className="group rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-2xl">
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

      {/* Mission */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div>
                <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
                  Quoting with Confidence
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-slate-600">
                  Flow empowers businesses to create accurate,
                  professional proposals in minutes. With AI-assisted pricing,
                  automatic tax calculation, and evidence-first audit trails,
                  every quote tells a trustworthy story.
                </p>
                <p className="mt-4 font-poppins font-semibold text-electric">
                  Built for modern commerce.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative overflow-hidden rounded-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80"
                  alt="Business proposals"
                  width={800}
                  height={600}
                  className="rounded-2xl object-cover"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-navy/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric font-poppins text-sm font-bold text-white">
                      SQ
                    </div>
                    <div>
                      <div className="font-poppins text-sm font-semibold text-white">
                        Flow Platform
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
              "radial-gradient(circle at 30% 50%, rgba(37,99,235,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(212,168,67,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-white md:text-5xl">
              Ready to Streamline Your Quoting?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
              Join hundreds of businesses using Flow to win more deals
              faster.
            </p>
            <div className="mt-10">
              <Link
                href="/sign-up"
                className="rounded-xl bg-electric px-10 py-4 font-poppins text-lg font-semibold text-white shadow-lg shadow-electric/25 transition-all hover:bg-electric/90 hover:shadow-xl"
              >
                Get Started Free
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
