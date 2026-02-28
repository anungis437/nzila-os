"use client";

import Link from "next/link";
import Image from "next/image";
import { ScrollReveal } from "@/components/public/scroll-reveal";

const stats = [
  { value: "3,200+", label: "Vehicles Listed" },
  { value: "180+", label: "Partner Dealers" },
  { value: "$12M+", label: "Monthly GMV" },
  { value: "< 48h", label: "Avg. Deal Close" },
];

const features = [
  {
    title: "Vehicle Trading Platform",
    description:
      "End-to-end vehicle lifecycle — sourcing, valuation, listing, negotiation, and settlement for new and used automotive inventory.",
    icon: "🚗",
  },
  {
    title: "Spare Parts Marketplace",
    description:
      "OEM and aftermarket parts catalog, cross-compatibility search, supplier management, and logistics coordination across the DRC.",
    icon: "🔧",
  },
  {
    title: "Deal Pipeline Management",
    description:
      "Visual deal boards, automated follow-ups, credit checks, and commission tracking from lead to settlement.",
    icon: "📋",
  },
  {
    title: "Inventory Intelligence",
    description:
      "Real-time stock levels, aging reports, demand scoring, and automated reorder triggers for optimal inventory turns.",
    icon: "📦",
  },
  {
    title: "Logistics & Transport",
    description:
      "Transport coordination, route optimization, and delivery tracking for vehicle and parts shipments across Central Africa.",
    icon: "🚚",
  },
  {
    title: "Finance & Compliance",
    description:
      "OHADA-compliant invoicing, multi-currency settlement, import duty calculation, and audit-ready financial reporting.",
    icon: "💰",
  },
];

export default function MarketingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=1920&q=80"
          alt="Modern vehicles on a busy commercial street"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-navy/85" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, rgba(251,191,36,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 30%, rgba(245,158,11,0.2) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-32">
          <ScrollReveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              $12M+ Monthly Trade Volume
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="max-w-3xl font-poppins text-5xl font-bold leading-tight text-white md:text-7xl">
              Commerce{" "}
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-x">
                Without Borders
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
              The automotive commerce and trade management platform built for
              the DRC and Central Africa. Vehicle trading, spare parts logistics,
              and deal lifecycle — all unified.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/sign-up"
                className="rounded-xl bg-amber-400 px-8 py-4 font-poppins font-semibold text-navy shadow-lg shadow-amber-400/25 transition-all hover:bg-amber-300 hover:shadow-xl hover:shadow-amber-400/30"
              >
                Start Trading
              </Link>
              <Link
                href="/platform"
                className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-poppins font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                View Marketplace
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
                Everything to Power Your Trade
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                Vehicle sourcing, parts logistics, and deal management in one
                platform
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 0.1}>
                <div className="group rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl">
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

      {/* Mission / Commerce */}
      <section id="commerce" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div>
                <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
                  Built for DRC Commerce Realities
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-slate-600">
                  TradeOps is purpose-built for the multi-currency, multi-border
                  trade realities of the DRC and Central African corridor — where
                  import logistics are complex, dealer networks are distributed,
                  and OHADA compliance is non-negotiable.
                </p>
                <p className="mt-4 font-poppins font-semibold text-amber-600">
                  180+ partner dealers across 6 provinces, processing $12M+
                  monthly.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative overflow-hidden rounded-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80"
                  alt="Auto dealership with vehicles on display"
                  width={800}
                  height={600}
                  className="rounded-2xl object-cover"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-navy/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 font-poppins text-sm font-bold text-white">
                      TO
                    </div>
                    <div>
                      <div className="font-poppins text-sm font-semibold text-white">
                        TradeOps Platform
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
              "radial-gradient(circle at 30% 50%, rgba(251,191,36,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(245,158,11,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-white md:text-5xl">
              Ready to Scale Your Trade Operations?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
              Join the dealers and distributors using TradeOps to streamline
              commerce across the DRC and Central African markets.
            </p>
            <div className="mt-10">
              <Link
                href="/sign-up"
                className="rounded-xl bg-amber-400 px-10 py-4 font-poppins text-lg font-semibold text-navy shadow-lg shadow-amber-400/25 transition-all hover:bg-amber-300 hover:shadow-xl"
              >
                Get Started Today
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
