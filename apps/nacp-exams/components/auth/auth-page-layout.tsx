/**
 * AuthPageLayout — Premium Split-Screen Auth Layout
 * ──────────────────────────────────────────────────
 * Left panel:  Hero image + navy overlay + mesh gradient + logo
 *              + animated gradient tagline + stats row + trust badges
 * Right panel: Auth component
 * Mobile:      Single-column fallback (right panel only)
 *
 * Fully parameterized: appName, tagline, stats, heroImage, trustBadges.
 */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export interface AuthStat {
  value: string;
  label: string;
}

export interface TrustBadge {
  label: string;
  color: 'emerald' | 'gold' | 'muted' | 'electric';
}

interface AuthPageLayoutProps {
  children: ReactNode;
  appName: string;
  appAbbrev: string;
  tagline: string;
  subtitle: string;
  stats: AuthStat[];
  heroImage: string;
  heroAlt?: string;
  trustBadges?: TrustBadge[];
  isSignUp?: boolean;
}

const badgeColorMap: Record<TrustBadge['color'], string> = {
  emerald: 'bg-emerald-500/20 text-emerald-300',
  gold: 'bg-gold/20 text-gold-light',
  muted: 'bg-white/10 text-white/70',
  electric: 'bg-electric/20 text-electric-light',
};

export default function AuthPageLayout({
  children,
  appName,
  appAbbrev,
  tagline,
  subtitle,
  stats,
  heroImage,
  heroAlt = 'Hero background',
  trustBadges = [],
  isSignUp = false,
}: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* ─────────── LEFT PANEL (hidden on mobile) ─────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Background image */}
        <Image
          src={heroImage}
          alt={heroAlt}
          fill
          priority
          className="object-cover"
          sizes="55vw"
        />
        {/* Overlays */}
        <div className="absolute inset-0 bg-linear-to-br from-navy/90 via-navy/80 to-navy/95" />
        <div className="absolute inset-0 bg-mesh opacity-50" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-electric flex items-center justify-center shadow-lg shadow-electric/30 group-hover:shadow-electric/50 transition-shadow">
              <span className="text-white font-bold text-sm">{appAbbrev}</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">{appName}</span>
          </Link>

          {/* Center content */}
          <div className="max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              <span className="gradient-text">{tagline}</span>
            </h1>
            <p className="text-lg text-gray-300 leading-relaxed mb-10">
              {subtitle}
            </p>

            {/* Stats row */}
            {stats.length > 0 && (
              <div className="flex gap-8">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-3xl font-bold text-white">{stat.value}</div>
                    <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trust badges */}
          {trustBadges.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {trustBadges.map((badge) => (
                <div
                  key={badge.label}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${badgeColorMap[badge.color]}`}
                >
                  <div className="relative w-1.5 h-1.5 rounded-full bg-current">
                    <div className="absolute inset-0 rounded-full bg-current animate-ping opacity-40" />
                  </div>
                  {badge.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─────────── RIGHT PANEL ─────────── */}
      <div className="flex-1 flex items-center justify-center bg-white p-6 sm:p-12 lg:w-[45%]">
        <div className="w-full max-w-md">
          {/* Mobile logo (hidden on desktop) */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-electric flex items-center justify-center shadow-lg shadow-electric/30">
              <span className="text-white font-bold text-sm">{appAbbrev}</span>
            </div>
            <span className="font-bold text-xl text-navy">{appName}</span>
          </div>

          {/* Mobile heading */}
          <div className="lg:hidden mb-8">
            <h1 className="text-2xl font-bold text-navy mb-2">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-gray-500">
              {isSignUp
                ? `Sign up for ${appName} to get started`
                : `Sign in to your ${appName} account`}
            </p>
          </div>

          {/* Auth component slot */}
          {children}
        </div>
      </div>
    </div>
  );
}
