"use client";

import { SignIn, SignUp } from "@nzila/platform-auth/entra/client";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AuthStat {
  value: string;
  label: string;
}

interface TrustBadge {
  label: string;
}

interface AuthPageLayoutProps {
  mode: "sign-in" | "sign-up";
  appName?: string;
  appAbbrev?: string;
  tagline?: string;
  subtitle?: string;
  stats?: AuthStat[];
  heroImage?: string;
  trustBadges?: TrustBadge[];
}

const defaults = {
  appName: "Flow",
  appAbbrev: "SQ",
  tagline: "Professional Quoting Made Simple",
  subtitle:
    "Create tiered proposals, calculate taxes automatically, and track every decision with an evidence-first audit trail.",
  stats: [
    { value: "5K+", label: "Quotes Created" },
    { value: "99.9%", label: "Tax Accuracy" },
    { value: "3x", label: "Faster Proposals" },
  ] as AuthStat[],
  heroImage:
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&q=80",
  trustBadges: [
    { label: "SOC 2 Compliant" },
    { label: "PIPEDA Ready" },
    { label: "256-bit Encryption" },
  ] as TrustBadge[],
};

export function AuthPageLayout({
  mode,
  appName = defaults.appName,
  appAbbrev = defaults.appAbbrev,
  tagline = defaults.tagline,
  subtitle = defaults.subtitle,
  stats = defaults.stats,
  heroImage = defaults.heroImage,
  trustBadges = defaults.trustBadges,
}: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — hero */}
      <div className="relative hidden w-[55%] overflow-hidden lg:block">
        <Image
          src={heroImage}
          alt={appName}
          fill
          sizes="(max-width: 1024px) 0px, 55vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-navy/80" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, rgba(37,99,235,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(212,168,67,0.2) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric font-poppins text-lg font-bold text-white">
              {appAbbrev}
            </div>
            <span className="font-poppins text-xl font-semibold text-white">
              {appName}
            </span>
          </Link>

          <div className="max-w-lg space-y-6">
            <h1
              className={cn(
                "bg-gradient-to-r from-white via-electric-light to-gold bg-[length:200%_auto]",
                "animate-gradient-x bg-clip-text font-poppins text-4xl font-bold text-transparent"
              )}
            >
              {tagline}
            </h1>
            <p className="text-lg leading-relaxed text-slate-300">{subtitle}</p>

            <div className="flex gap-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-poppins text-2xl font-bold text-white">
                    {s.value}
                  </div>
                  <div className="text-sm text-slate-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {trustBadges.map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
                </span>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-6 lg:w-[45%]">
        {/* Mobile-only branding */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-electric font-poppins text-xl font-bold text-white">
            {appAbbrev}
          </div>
          <h2 className="font-poppins text-xl font-semibold text-navy">
            {mode === "sign-in" ? "Welcome Back" : "Create Account"}
          </h2>
        </div>

        {mode === "sign-in" ? (
          <SignIn
            forceRedirectUrl="/en-CA/dashboard"
            appearance={{
              elements: {
                rootBox: "mx-auto w-full max-w-md",
                card: "shadow-xl rounded-2xl border-0",
              },
            }}
          />
        ) : (
          <SignUp
            forceRedirectUrl="/en-CA/dashboard"
            appearance={{
              elements: {
                rootBox: "mx-auto w-full max-w-md",
                card: "shadow-xl rounded-2xl border-0",
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
