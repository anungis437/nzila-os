"use client";

import Link from "next/link";
import Image from "next/image";
import { ScrollReveal } from "@/components/public/scroll-reveal";

const stats = [
  { value: "15+", label: "Data Models" },
  { value: "50+", label: "KPI Dashboards" },
  { value: "6", label: "Provinces Covered" },
  { value: "Real-time", label: "Analytics Pipeline" },
];

const features = [
  {
    title: "Yield Forecasting",
    description:
      "ML-powered crop yield predictions combining satellite imagery, historical data, and local climate patterns for accurate seasonal forecasts.",
    icon: "📊",
  },
  {
    title: "Climate & Weather Modeling",
    description:
      "Hyperlocal weather analytics, drought risk scoring, and monsoon pattern tracking tailored for DRC and Central African micro-climates.",
    icon: "🌦️",
  },
  {
    title: "Market Price Analytics",
    description:
      "Commodity price trend analysis, regional price differentials, and demand forecasting to optimize timing and contracts.",
    icon: "💹",
  },
  {
    title: "Regional Benchmarking",
    description:
      "Compare cooperative performance against provincial and national averages. Identify top-performing practices for replication.",
    icon: "📈",
  },
  {
    title: "Supply Chain Visibility",
    description:
      "Bottleneck detection, transport corridor analysis, and cold-chain compliance dashboards from farm-gate to port of export.",
    icon: "🔍",
  },
  {
    title: "Sustainability Scoring",
    description:
      "ESG metrics, carbon footprint tracking, and sustainability certification readiness reporting for B Corp and Fair Trade compliance.",
    icon: "🌿",
  },
];

export default function MarketingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80"
          alt="Data analytics dashboard showing agricultural metrics and charts"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-navy/85" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, rgba(34,211,238,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 30%, rgba(45,212,191,0.2) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-32">
          <ScrollReveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              Agricultural Intelligence Platform
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="max-w-3xl font-poppins text-5xl font-bold leading-tight text-white md:text-7xl">
              Insights that{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-400 bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-x">
                Grow Harvests
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
              Turn agricultural data into actionable intelligence. Yield
              forecasting, climate modeling, and market analytics designed for
              DRC and Central African agribusiness.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/sign-up"
                className="rounded-xl bg-cyan-400 px-8 py-4 font-poppins font-semibold text-navy shadow-lg shadow-cyan-400/25 transition-all hover:bg-cyan-300 hover:shadow-xl hover:shadow-cyan-400/30"
              >
                Explore the Platform
              </Link>
              <Link
                href="/platform"
                className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-poppins font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                View Sample Reports
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
                Intelligence for Every Decision
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                From planting season to export, data-driven insights at every
                stage
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 0.1}>
                <div className="group rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-2xl">
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

      {/* Mission / Insights */}
      <section id="insights" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div>
                <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
                  Data-Driven Agriculture for Central Africa
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-slate-600">
                  CORA Insights connects the dots across fragmented agricultural
                  data — satellite imagery, weather stations, market prices, and
                  cooperative reporting — to deliver a unified intelligence
                  layer for better decisions.
                </p>
                <p className="mt-4 font-poppins font-semibold text-cyan-600">
                  50+ KPI dashboards covering yield, quality, logistics, and
                  sustainability.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative overflow-hidden rounded-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80"
                  alt="Data analytics charts on a laptop screen"
                  width={800}
                  height={600}
                  className="rounded-2xl object-cover"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-navy/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 font-poppins text-sm font-bold text-white">
                      CO
                    </div>
                    <div>
                      <div className="font-poppins text-sm font-semibold text-white">
                        CORA Insights
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
              "radial-gradient(circle at 30% 50%, rgba(34,211,238,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(45,212,191,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-white md:text-5xl">
              See Your Agricultural Data Clearly
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
              Unlock yield forecasts, climate insights, and market intelligence.
              Make data-driven decisions that grow your output and margins.
            </p>
            <div className="mt-10">
              <Link
                href="/sign-up"
                className="rounded-xl bg-cyan-400 px-10 py-4 font-poppins text-lg font-semibold text-navy shadow-lg shadow-cyan-400/25 transition-all hover:bg-cyan-300 hover:shadow-xl"
              >
                Start Exploring Insights
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
