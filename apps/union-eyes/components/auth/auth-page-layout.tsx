/**
 * AuthPageLayout — Premium split-screen auth layout
 * ─────────────────────────────────────────────────────
 * Designed as the canonical sign-in/sign-up experience across all Nzila apps.
 * Each app provides its own branding (logo, tagline, stats, image) while
 * the layout, effects, and animation are shared for portfolio cohesion.
 *
 * Usage:
 *   <AuthPageLayout appName="Union Eyes" tagline="..." stats={[...]}>
 *     <SignIn />
 *   </AuthPageLayout>
 */
'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface AuthStat {
  value: string;
  label: string;
}

interface AuthPageLayoutProps {
  /** The Clerk <SignIn> or <SignUp> component */
  children: ReactNode;
  /** App display name */
  appName: string;
  /** Headline for the brand panel */
  tagline: string;
  /** Supporting text below the tagline */
  subtitle?: string;
  /** Trust metrics shown on the brand panel */
  stats?: AuthStat[];
  /** Hero background image URL */
  heroImage?: string;
  /** Alt text for hero image */
  heroAlt?: string;
  /** Whether this is sign-up (shows different footer copy) */
  isSignUp?: boolean;
}

export default function AuthPageLayout({
  children,
  appName,
  tagline,
  subtitle,
  stats = [],
  heroImage = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920&q=80',
  heroAlt = 'Professional team meeting — representing organized labor collaboration',
  isSignUp: _isSignUp = false,
}: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* ───── Left Panel: Brand ───── */}
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
        {/* Navy overlay + mesh gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-navy/90 via-navy/80 to-navy/95" />
        <div className="absolute inset-0 bg-mesh opacity-60" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 lg:p-16">
          {/* Top: Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-electric to-violet flex items-center justify-center shadow-lg shadow-electric/25">
                <span className="text-white font-bold text-sm">UE</span>
              </div>
              <span className="text-xl font-bold text-white group-hover:text-electric-light transition-colors">
                {appName}
              </span>
            </Link>
          </motion.div>

          {/* Center: Tagline */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
                Powered by Nzila
              </span>
            </motion.div>

            <motion.h1
              className="text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {tagline.split(' ').slice(0, -2).join(' ')}{' '}
              <span className="gradient-text">
                {tagline.split(' ').slice(-2).join(' ')}
              </span>
            </motion.h1>

            {subtitle && (
              <motion.p
                className="text-lg text-gray-300 leading-relaxed mb-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                {subtitle}
              </motion.p>
            )}

            {/* Stats row */}
            {stats.length > 0 && (
              <motion.div
                className="flex items-center gap-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {stats.map((stat, i) => (
                  <div key={stat.label} className="flex items-center gap-8">
                    {i > 0 && <div className="w-px h-10 bg-white/20" />}
                    <div>
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
                      <div className="text-xs text-gray-400 font-medium tracking-wider uppercase">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Bottom: Trust indicators */}
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-emerald/20 text-emerald">
              SOC 2 Compliant
            </span>
            <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-gold/20 text-gold">
              PIPEDA Ready
            </span>
            <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-white/10 text-gray-300">
              End-to-End Encrypted
            </span>
          </motion.div>
        </div>
      </div>

      {/* ───── Right Panel: Auth Form ───── */}
      <div className="flex-1 flex flex-col min-h-screen bg-white">
        {/* Mobile header (hidden on desktop) */}
        <div className="lg:hidden bg-navy p-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-linear-to-br from-electric to-violet flex items-center justify-center">
              <span className="text-white font-bold text-xs">UE</span>
            </div>
            <span className="text-lg font-bold text-white">{appName}</span>
          </Link>
          <p className="text-gray-400 text-sm mt-2 max-w-sm">{subtitle}</p>
        </div>

        {/* Auth form container */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <motion.div
            className="w-full max-w-110"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {children}
          </motion.div>
        </div>

        {/* Footer */}
        <div className="px-6 py-6 text-center border-t border-gray-100">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <span>Part of</span>
            <Link
              href="https://nzilaventures.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-600 hover:text-electric transition-colors"
            >
              Nzila Ventures
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/legal/privacy" className="hover:text-gray-600 transition-colors">
              Privacy
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/legal/terms" className="hover:text-gray-600 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
