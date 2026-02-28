"use client";

import Link from "next/link";
import { ScrollReveal } from "@/components/public/scroll-reveal";

const capabilities = [
  {
    title: "Portfolio Overview",
    description:
      "Unified view of all Nzila Ventures products — health scores, deployment status, user metrics, and incident timeline across the entire portfolio.",
    icon: "🏢",
  },
  {
    title: "Financial Operations",
    description:
      "QuickBooks Online sync, Stripe settlement tracking, expense approval workflows, and real-time P&L dashboards per product.",
    icon: "💳",
  },
  {
    title: "AI & ML Workbench",
    description:
      "Model registry, experiment tracking, prompt management, and inference monitoring for the NzilaOS AI stack.",
    icon: "🤖",
  },
  {
    title: "Platform Metrics",
    description:
      "Infrastructure metrics, latency percentiles, error budgets, and SLO tracking aggregated across all deployments.",
    icon: "📊",
  },
  {
    title: "Content & Exports",
    description:
      "Blog content management, PDF report generation, data export pipelines, and investor report automation.",
    icon: "📦",
  },
  {
    title: "Team & Access",
    description:
      "Role-based access control, SSO configuration, audit logging, and team member management via Clerk.",
    icon: "🔐",
  },
];

export default function MarketingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[80vh] items-center overflow-hidden bg-navy">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, rgba(148,163,184,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 30%, rgba(100,116,139,0.2) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-32">
          <ScrollReveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              Internal Operations Platform
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="max-w-3xl font-poppins text-5xl font-bold leading-tight text-white md:text-7xl">
              Nzila{" "}
              <span className="bg-gradient-to-r from-slate-300 via-white to-slate-300 bg-[length:200%_auto] bg-clip-text text-transparent">
                Console
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 md:text-xl">
              The internal operations dashboard for Nzila Ventures. Portfolio
              management, financial operations, AI/ML tooling, and platform
              metrics — all in one place.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/sign-in"
                className="rounded-xl bg-white/10 px-8 py-4 font-poppins font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:shadow-xl"
              >
                Sign In to Console
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <div className="text-center">
              <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
                Everything You Need to Operate
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                Unified dashboard for portfolio management, finance, AI, and
                platform health
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap, i) => (
              <ScrollReveal key={cap.title} delay={i * 0.1}>
                <div className="group rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                    {cap.icon}
                  </div>
                  <h3 className="font-poppins text-lg font-semibold text-navy">
                    {cap.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {cap.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Platform */}
      <section id="platform" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div>
                <h2 className="font-poppins text-3xl font-bold text-navy md:text-4xl">
                  The Command Center for NzilaOS
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-slate-600">
                  Console aggregates data from every NzilaOS product — PonduOps,
                  CORA Insights, TradeOps, ABR, and the entire portfolio — into
                  a single operational view for the Nzila Ventures team.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {[
                    { label: "Products", value: "13+" },
                    { label: "Data Sources", value: "25+" },
                    { label: "Active Users", value: "Team" },
                    { label: "Uptime", value: "99.9%" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-center"
                    >
                      <div className="font-poppins text-xl font-bold text-navy">
                        {stat.value}
                      </div>
                      <div className="text-xs text-slate-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 font-poppins text-sm font-bold text-white">
                    NC
                  </div>
                  <div>
                    <div className="font-poppins text-sm font-semibold text-navy">
                      Nzila Console
                    </div>
                    <div className="text-xs text-slate-500">
                      Powered by NzilaOS
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      label: "Portfolio Health",
                      value: "All Green",
                      color: "bg-green-100 text-green-700",
                    },
                    {
                      label: "Active Deploys",
                      value: "3 in progress",
                      color: "bg-blue-100 text-blue-700",
                    },
                    {
                      label: "Revenue MTD",
                      value: "$142K",
                      color: "bg-amber-100 text-amber-700",
                    },
                    {
                      label: "Error Budget",
                      value: "97.2% remaining",
                      color: "bg-slate-100 text-slate-700",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
                    >
                      <span className="text-sm text-slate-600">
                        {item.label}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${item.color}`}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-navy py-24">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, rgba(148,163,184,0.3) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(100,116,139,0.2) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <ScrollReveal>
            <h2 className="font-poppins text-3xl font-bold text-white md:text-5xl">
              Access the Console
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              Sign in with your Nzila Ventures account to access the internal
              operations dashboard.
            </p>
            <div className="mt-10">
              <Link
                href="/sign-in"
                className="rounded-xl bg-white/10 px-10 py-4 font-poppins text-lg font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:shadow-xl"
              >
                Sign In
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
