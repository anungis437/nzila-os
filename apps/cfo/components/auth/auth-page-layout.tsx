"use client";

import Image from "next/image";
import Link from "next/link";
import { SignIn, SignUp } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

interface AuthPageLayoutProps {
  mode: "sign-in" | "sign-up";
  appName?: string;
  appAbbrev?: string;
  tagline?: string;
  subtitle?: string;
  heroImage?: string;
  stats?: { label: string; value: string }[];
}

const defaultStats = [
  { label: "Active Clients", value: "5,000+" },
  { label: "Financial Accuracy", value: "99.5%" },
  { label: "Jurisdictions", value: "40+" },
  { label: "Avg Turnaround", value: "< 4h" },
];

export function AuthPageLayout({
  mode,
  appName = "LedgerIQ",
  appAbbrev = "LQ",
  tagline = "AI-Powered Virtual CFO Platform",
  subtitle = "Automate financial operations, deliver strategic insights, and scale your advisory practice with confidence.",
  heroImage = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1920&q=80",
  stats = defaultStats,
}: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left — hero panel */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <Image
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
          fill
        />
        <div className="absolute inset-0 bg-gradient-to-br from-navy/90 via-navy/70 to-electric/40" />

        <div className="relative flex h-full flex-col justify-between p-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 font-poppins text-sm font-bold text-white backdrop-blur-sm">
              {appAbbrev}
            </div>
            <span className="font-poppins text-xl font-semibold text-white">
              {appName}
            </span>
          </Link>

          {/* Tagline */}
          <div className="space-y-6">
            <h1 className="max-w-md font-poppins text-4xl font-bold leading-tight text-white">
              {tagline}
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-slate-300">
              {subtitle}
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <div className="font-poppins text-2xl font-bold text-white">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              SOC 2 Type II — In Progress
            </span>
            <span>•</span>
            <span>PIPEDA Committed</span>
            <span>•</span>
            <span>256-bit Encryption</span>
          </div>
        </div>
      </div>

      {/* Right — Clerk form */}
      <div className="flex w-full items-center justify-center bg-slate-50 px-6 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex justify-center lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric font-poppins text-sm font-bold text-white">
                {appAbbrev}
              </div>
              <span className="font-poppins text-xl font-semibold text-navy">
                {appName}
              </span>
            </Link>
          </div>

          {/* Clerk component */}
          <div className="flex justify-center">
            {mode === "sign-in" ? (
              <SignIn
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border border-slate-200 rounded-xl",
                  },
                }}
              />
            ) : (
              <SignUp
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border border-slate-200 rounded-xl",
                  },
                }}
              />
            )}
          </div>

          {/* Footer link */}
          <p className="text-center text-sm text-slate-500">
            {mode === "sign-in" ? (
              <>
                Don&apos;t have an account?{" "}
                <Link
                  href="/sign-up"
                  className={cn(
                    "font-medium text-electric transition-colors hover:text-electric/80",
                  )}
                >
                  Start free trial
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  href="/sign-in"
                  className={cn(
                    "font-medium text-electric transition-colors hover:text-electric/80",
                  )}
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
