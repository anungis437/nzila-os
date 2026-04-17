'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface AuthStat {
  value: string;
  label: string;
}

interface AuthPageLayoutProps {
  children: ReactNode;
  appName: string;
  tagline: string;
  subtitle?: string;
  stats?: AuthStat[];
  heroImage?: string;
  heroAlt?: string;
}

export default function AuthPageLayout({
  children,
  appName,
  tagline,
  subtitle,
  stats = [],
  heroImage = 'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=2200&q=80&auto=format&fit=crop',
  heroAlt = 'Operations team collaborating in a data-driven control room',
}: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[55%] overflow-hidden lg:block">
        <Image
          src={heroImage}
          alt={heroAlt}
          fill
          priority
          className="object-cover"
          sizes="55vw"
        />
        <div className="absolute inset-0 bg-linear-to-br from-navy/90 via-navy/84 to-navy/95" />
        <div className="absolute inset-0 bg-mesh opacity-60" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="max-w-xl pt-6">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-electric/25 bg-electric/12 px-4 py-2 text-xs font-semibold tracking-widest uppercase text-electric-light">
              Nzila Operations Platform
            </span>
            <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
              {tagline}
            </h1>
            {subtitle && (
              <p className="mt-6 text-base leading-relaxed text-gray-200 xl:text-lg">
                {subtitle}
              </p>
            )}

            {stats.length > 0 && (
              <div className="mt-10 grid grid-cols-3 gap-3">
                {stats.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/12 bg-white/6 p-4 backdrop-blur-sm">
                    <p className="text-xl font-bold text-white">{item.value}</p>
                    <p className="mt-1 text-[11px] font-medium tracking-wider text-gray-300 uppercase">{item.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-emerald/18 px-3 py-1.5 text-emerald">SOC 2 Controls</span>
            <span className="rounded-full bg-gold/18 px-3 py-1.5 text-gold">Operational Audit Trail</span>
            <span className="rounded-full bg-white/12 px-3 py-1.5 text-gray-200">Cross-Product Governance</span>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen flex-1 items-center justify-center bg-gray-50 px-6 py-10 sm:px-10">
        <div className="w-full max-w-md rounded-3xl border border-gray-200/80 bg-white p-6 shadow-2xl shadow-navy/8 sm:p-8">
          <div className="mb-6 space-y-2">
            <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">{appName}</p>
            <h2 className="text-2xl font-bold text-navy">Sign In</h2>
            <p className="text-sm text-gray-500">Access your operations dashboard and governed workflows.</p>
          </div>

          {children}

          <div className="mt-6 border-t border-gray-100 pt-4 text-center text-xs text-gray-400">
            <span>Part of </span>
            <Link href="https://nzilaventures.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-600 transition-colors hover:text-electric">
              Nzila Ventures
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
