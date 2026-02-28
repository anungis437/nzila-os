"use client";

import Link from "next/link";
import Image from "next/image";
import { ScrollReveal } from "@/components/public/scroll-reveal";

const stats = [
  { value: "220+", label: "Agricultural Entities" },
  { value: "70+", label: "Business Modules" },
  { value: "99.5%", label: "Uptime SLA" },
  { value: "<30s", label: "Supply Chain Updates" },
];

const features = [
  {
    title: "Crop Planning & Seasons",
    description:
      "Multi-season crop planning, planting schedules, rotation management, and yield projection optimized for DRC and Central African climates.",
    icon: "🌱",
  },
  {
    title: "Supply Chain Intelligence",
    description:
      "End-to-end produce traceability, cold-chain monitoring, and logistics coordination for DRC/CA export corridors with real-time visibility.",
    icon: "🚜",
  },
  {
    title: "Harvest & Quality Management",
    description:
      "Yield tracking, quality grading, batch management, and automated sorting workflows from field to distribution center.",
    icon: "🌾",
  },
  {
    title: "Market Price Intelligence",
    description:
      "Live commodity pricing, seasonal demand forecasting, and wholesale marketplace connectivity to maximize farm-gate returns.",
    icon: "💹",
  },
  {
    title: "IoT & Sensor Integration",
    description:
      "Soil moisture, temperature, and crop health telemetry connected to automated alerts and prescription actions across all fields.",
    icon: "📡",
  },
  {
    title: "Carbon & Sustainability",
    description:
      "Emissions tracking, sustainable-practice logging, and export-ready sustainability reports aligned with B Corp environmental metrics.",
    icon: "🌍",
  },
];

export default function MarketingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1595508064774-5ff825920c76?w=1920&q=80"
          alt="Agricultural workers harvesting crops in a lush tropical field"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-navy/85" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, rgba(16,185,129,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 30%, rgba(212,168,67,0.2) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-32">
          <ScrollReveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
              </span>
              Powering 220+ Agricultural Entities
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="max-w-3xl font-poppins text-5xl font-bold leading-tight text-white md:text-7xl">
              Farm to Market,{" "}
              <span className="bg-gradient-to-r from-emerald via-gold to-emerald bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-x">
                Fully Traced
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
              The agricultural supply chain and operations ERP purpose-built for
              the DRC and Central African corridor. Crop planning, logistics,
              IoT integration, and market intelligence — all in one platform.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/sign-up"
                className="rounded-xl bg-emerald px-8 py-4 font-poppins font-semibold text-white shadow-lg shadow-emerald/25 transition-all hover:bg-emerald/90 hover:shadow-xl hover:shadow-emerald/30"
              >
                Start Free Trial
              </Link>
              <Link
                href="/platform"
                className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-poppins font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                See a Demo
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
                End-to-End Agricultural Operations
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                Everything your agri-business needs, from planting to export
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 0.1}>
                <div className="group rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald/10 text-2xl">
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
                  Built for the DRC & Central African Corridor
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-slate-600">
                  PonduOps is purpose-built for the logistics realities of the
                  Democratic Republic of Congo and Central African markets —
                  where connectivity is intermittent, supply chains are complex,
                  and traceability is critical for export compliance.
                </p>
                <p className="mt-4 font-poppins font-semibold text-emerald">
                  70+ modules covering every dimension of agricultural operations.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative overflow-hidden rounded-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80"
                  alt="Organised crop rows on agricultural farmland"
                  width={800}
                  height={600}
                  className="rounded-2xl object-cover"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-navy/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald font-poppins text-sm font-bold text-white">
                      PO
                    </div>
                    <div>
                      <div className="font-poppins text-sm font-semibold text-white">
                        PonduOps Platform
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
              "radial-gradient(circle at 30% 50%, rgba(16,185,129,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(212,168,67,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-white md:text-5xl">
              Ready to Transform Your Agricultural Operations?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
              Join hundreds of cooperatives and farms using PonduOps to bring
              transparency, efficiency, and intelligence to their supply chains.
            </p>
            <div className="mt-10">
              <Link
                href="/sign-up"
                className="rounded-xl bg-emerald px-10 py-4 font-poppins text-lg font-semibold text-white shadow-lg shadow-emerald/25 transition-all hover:bg-emerald/90 hover:shadow-xl"
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
