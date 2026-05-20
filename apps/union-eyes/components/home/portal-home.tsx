'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Scale,
  BookOpen,
  CalendarDays,
  FolderOpen,
  BarChart3,
  Settings,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tile = {
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

const DEMO_TILES: Tile[] = [
  {
    label: 'Operations Dashboard',
    desc: 'Continuity signals, escalations, and casework overview',
    href: '/dashboard',
    icon: LayoutDashboard,
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
  },
  {
    label: 'Cases',
    desc: 'Representation files across your membership',
    href: '/dashboard/cases',
    icon: BriefcaseBusiness,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
  },
  {
    label: 'Grievances',
    desc: 'Formal dispute tracking and chronology',
    href: '/dashboard/grievances',
    icon: Scale,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
  },
  {
    label: 'Agreements',
    desc: 'Collective agreement library and clause reference',
    href: '/dashboard/agreements',
    icon: BookOpen,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
  },
  {
    label: 'Calendar',
    desc: 'Upcoming deadlines, hearings, and meetings',
    href: '/dashboard/calendar',
    icon: CalendarDays,
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
  },
  {
    label: 'Documents',
    desc: 'Evidence packages, minutes, and secure file library',
    href: '/dashboard/documents',
    icon: FolderOpen,
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
  },
  {
    label: 'Reports',
    desc: 'Analytics, continuity signals, and institutional insights',
    href: '/dashboard/reports',
    icon: BarChart3,
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
  },
  {
    label: 'Settings',
    desc: 'Profile, notifications, and preferences',
    href: '/dashboard/profile',
    icon: Settings,
    iconBg: 'bg-slate-500/15',
    iconColor: 'text-slate-400',
  },
];

const DEFAULT_TILES: Tile[] = [
  {
    label: 'Dashboard',
    desc: 'Your operational overview',
    href: '/dashboard',
    icon: LayoutDashboard,
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
  },
  {
    label: 'Cases',
    desc: 'Active representation files',
    href: '/dashboard/cases',
    icon: BriefcaseBusiness,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
  },
  {
    label: 'Agreements',
    desc: 'Collective agreement library',
    href: '/dashboard/agreements',
    icon: BookOpen,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
  },
  {
    label: 'Calendar',
    desc: 'Deadlines and upcoming commitments',
    href: '/dashboard/calendar',
    icon: CalendarDays,
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
  },
  {
    label: 'Documents',
    desc: 'Secure file library and evidence',
    href: '/dashboard/documents',
    icon: FolderOpen,
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
  },
  {
    label: 'Reports',
    desc: 'Analytics and institutional insights',
    href: '/dashboard/reports',
    icon: BarChart3,
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
  },
  {
    label: 'Settings',
    desc: 'Profile and preferences',
    href: '/dashboard/profile',
    icon: Settings,
    iconBg: 'bg-slate-500/15',
    iconColor: 'text-slate-400',
  },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type Props = {
  locale: string;
  displayName: string;
  email: string;
  isCupeDemo: boolean;
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } },
};

const itemVariant = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export function PortalHome({ locale, displayName, email, isCupeDemo }: Props) {
  const [greeting, setGreeting] = useState('Welcome');

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const tiles = isCupeDemo ? DEMO_TILES : DEFAULT_TILES;
  const withLocale = (href: string) => `/${locale}${href}`;

  return (
    <div
      className="relative min-h-screen overflow-hidden font-poppins"
      style={{ background: '#060d14' }}
    >
      {/* Background gradient orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 12% 8%, rgba(56,189,248,0.10) 0%, transparent 55%), ' +
            'radial-gradient(ellipse 55% 50% at 88% 88%, rgba(99,102,241,0.09) 0%, transparent 55%), ' +
            'radial-gradient(ellipse 45% 35% at 50% 48%, rgba(16,185,129,0.05) 0%, transparent 50%)',
        }}
      />

      {/* Subtle dot-grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.018]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <Link href={withLocale('/')} className="flex items-center gap-2.5">
          <Image
            src="/images/brand/icon.png"
            alt="UnionEyes"
            width={32}
            height={32}
            className="h-8 w-8 rounded-md"
          />
          <Image
            src="/images/brand/logo.png"
            alt="UnionEyes"
            width={120}
            height={30}
            className="hidden h-6 object-contain brightness-0 invert md:block"
          />
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href={withLocale('/dashboard')}
            className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white sm:flex"
          >
            Go to Dashboard
            <ArrowUpRight size={14} />
          </Link>
          <Link
            href="/sign-out"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-sky-600/30 text-xs font-bold uppercase text-sky-300 transition-all hover:border-sky-500/40 hover:bg-sky-600/50"
          >
            {(displayName?.slice(0, 2) ?? 'ME').toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-8 md:px-10 md:pt-14">

        {/* Demo context badge */}
        {isCupeDemo && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-sky-300"
          >
            <ShieldCheck size={12} />
            CUPE Local 4373 · Healthcare Steward Operations · Demo
          </motion.div>
        )}

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14"
        >
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/60">
            {greeting}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
            {displayName}
          </h1>
          <p className="mt-3 text-sm text-white/35">{email}</p>
        </motion.div>

        {/* Section label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28, duration: 0.4 }}
          className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/20"
        >
          Where would you like to go?
        </motion.p>

        {/* Tile grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <motion.div key={tile.href} variants={itemVariant}>
                <Link
                  href={withLocale(tile.href)}
                  className="group relative flex flex-col gap-3.5 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.032] p-4 transition-all duration-200 hover:border-white/[0.13] hover:bg-white/[0.065] hover:shadow-xl hover:shadow-black/30"
                >
                  {/* Icon */}
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${tile.iconBg}`}
                  >
                    <Icon size={17} className={tile.iconColor} />
                  </div>

                  {/* Label + desc */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-white/85 transition-colors group-hover:text-white">
                      {tile.label}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-white/30 transition-colors group-hover:text-white/45">
                      {tile.desc}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ArrowUpRight
                    size={12}
                    className="absolute right-3.5 top-3.5 text-white/10 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/45"
                  />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Footer tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="mt-20 text-center text-xs text-white/12"
        >
          Union Eyes · Governance-safe institutional intelligence for Canadian labour
        </motion.p>
      </main>
    </div>
  );
}
