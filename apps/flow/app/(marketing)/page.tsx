/**
 * Flow — Marketing Landing Page
 * ─────────────────────────────
 * Premium, Nzila-quality public site matching the Union Eyes design standard:
 * scroll-triggered reveals, rich imagery, animated stats, animated features
 * grid, mission section with glass-card overlay, and CTA.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import AnimatedFeatures from "./components/animated-features";
import AnimatedCTA from "./components/animated-cta";

export const metadata: Metadata = {
  title: "Flow — Order-Centric Commerce Engine",
  description:
    "Quote, order, produce, ship, deliver — every workflow enforced by state machines, every payment gated, every event tracked. Powered by Nzila.",
  openGraph: {
    title: "Flow — Order-Centric Commerce Engine",
    description:
      "State-machine-enforced trade operations with payment gating, domain events, and real-time shipment tracking. Built on NzilaOS.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=630&fit=crop&q=80",
        width: 1200,
        height: 630,
        alt: "Modern commerce operations — Flow by Nzila",
      },
    ],
  },
};

export default function MarketingPage() {
  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&q=80"
          alt="Business professional completing a digital commerce transaction — representing Flow trade operations"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/95 via-navy/90 to-navy/95" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, rgba(37,99,235,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 30%, rgba(212,168,67,0.2) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-32 sm:px-6 lg:px-8">
          <ScrollReveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
              </span>
              NzilaOS Commerce Engine
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="max-w-3xl font-poppins text-5xl font-bold leading-tight text-white drop-shadow-lg md:text-7xl lg:text-8xl">
              Trade Operations,{" "}
              <span className="bg-gradient-to-r from-gold-light via-gold to-electric-light bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-x drop-shadow-none" style={{ filter: 'drop-shadow(0 0 12px rgba(212,168,67,0.4))' }}>
                Fully Enforced
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-white/90 drop-shadow-sm md:text-2xl">
              Quote, order, produce, ship, deliver — every transition
              state-machine-enforced, every payment gated, every event tracked
              and auditable.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-xl bg-electric px-8 py-4 font-poppins text-lg font-bold text-white shadow-lg shadow-electric/30 transition-all hover:bg-blue-700"
              >
                Start Free
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/15 px-8 py-4 font-poppins text-lg font-bold text-white backdrop-blur transition-all hover:bg-white/25"
              >
                Sign In
              </Link>
            </div>
          </ScrollReveal>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
          <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-white/30 p-1.5">
            <div className="h-3 w-1.5 animate-bounce rounded-full bg-white/60" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════ STATS BAR ═══════════════════════ */}
      <section className="relative overflow-hidden bg-navy-light py-16">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, rgba(37,99,235,0.15) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: "5,000+", label: "Quotes Created" },
              { value: "14", label: "Order Transitions" },
              { value: "3-Gate", label: "Payment Verification" },
              { value: "44", label: "Domain Event Types" },
            ].map((stat) => (
              <ScrollReveal key={stat.label}>
                <div className="text-center">
                  <div className="font-poppins text-4xl font-bold text-white md:text-5xl">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-sm font-medium uppercase tracking-wider text-white/70">
                    {stat.label}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FEATURES ═══════════════════════ */}
      <section className="bg-white px-4 py-24 md:px-6">
        <div className="mx-auto max-w-7xl">
          <AnimatedFeatures />
        </div>
      </section>

      {/* ═══════════════════════ MISSION ═══════════════════════ */}
      <section className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <span className="mb-4 inline-block rounded-full bg-electric/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-electric">
                Why Flow
              </span>
              <h2 className="font-poppins text-3xl font-bold text-navy md:text-5xl">
                Commerce That{" "}
                <span className="text-electric">Cannot Break</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-700">
                Flow was born when an importer shipped $40K of product before
                the deposit cleared — because nothing enforced the rule. We
                built state-machine-driven workflows, canonical payment gates,
                and event-sourced audit trails so that every business rule is
                code, not convention.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  "Zero Illegal Transitions",
                  "Deposit Enforcement",
                  "Evidence-First Audit",
                  "Order-Centric Design",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-electric" />
                    <span className="text-sm font-medium text-gray-700">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative aspect-4/3 overflow-hidden rounded-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80"
                  alt="Team reviewing trade operations on dashboard — Flow commerce platform"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-linear-to-t from-navy/40 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 glass-card rounded-xl p-4">
                  <div className="flex items-center gap-6 text-white">
                    <div>
                      <div className="text-2xl font-bold">5</div>
                      <div className="text-xs font-medium text-white/70">
                        State Machines
                      </div>
                    </div>
                    <div className="h-10 w-px bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">3</div>
                      <div className="text-xs font-medium text-white/70">
                        Payment Gates
                      </div>
                    </div>
                    <div className="h-10 w-px bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">44</div>
                      <div className="text-xs font-medium text-white/70">
                        Event Types
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ WORKFLOW VISUAL ═══════════════════════ */}
      <section className="bg-white px-4 py-24 md:px-6">
        <div className="mx-auto max-w-7xl text-center">
          <ScrollReveal>
            <span className="mb-4 inline-block rounded-full bg-electric/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-electric">
              End-to-End
            </span>
            <h2 className="font-poppins text-3xl font-bold text-navy md:text-5xl">
              The Complete Trade Lifecycle
            </h2>
            <p className="mx-auto mb-12 mt-4 max-w-2xl text-lg text-gray-600">
              Every stage enforced. Every transition validated. Every event persisted.
            </p>
          </ScrollReveal>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            {[
              { step: "Quote", icon: "📋" },
              { step: "Order", icon: "📦" },
              { step: "Payment", icon: "💰" },
              { step: "PO", icon: "📄" },
              { step: "Production", icon: "🏭" },
              { step: "Shipment", icon: "🚚" },
              { step: "Delivery", icon: "✅" },
            ].map((s, i) => (
              <ScrollReveal key={s.step} delay={i * 0.08}>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white shadow-md transition-all hover:-translate-y-1 hover:shadow-lg">
                    <span className="text-2xl">{s.icon}</span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-navy">
                      {s.step}
                    </span>
                  </div>
                  {i < 6 && (
                    <span className="hidden text-navy/30 md:inline">→</span>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <section className="relative overflow-hidden bg-navy py-24">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, rgba(37,99,235,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(212,168,67,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <AnimatedCTA />
        </div>
      </section>
    </main>
  );
}
