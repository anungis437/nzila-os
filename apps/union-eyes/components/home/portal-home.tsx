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
  Upload,
  FileText,
  AlarmClock,
  Sparkles,
  ChevronRight,
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
    desc: 'Analytics, continuity signals, and organizational insights',
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
    desc: 'Analytics and organizational insights',
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

// ─── Demo enrichment data ─────────────────────────────────────────────────────

const DEMO_PULSE: Array<{
  label: string;
  value: number;
  color: string;
  bg: string;
  border: string;
}> = [
  { label: 'Open Cases',         value: 4,  color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { label: 'Active Grievances',  value: 2,  color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20'  },
  { label: 'Deadline in 3 days', value: 1,  color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20'   },
  { label: 'Documents',          value: 12, color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20'   },
];

const DEMO_URGENT = {
  title:  'Response Due in 3 Days',
  detail: 'Grievance GRV-2024-014 · Ahmed Al-Rashid · Employer response deadline: May 22, 2026',
  href:   '/dashboard/grievances',
};

const DEMO_QUICK_ACTIONS: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: 'File Grievance',  href: '/dashboard/grievances', icon: Scale            },
  { label: 'Open Case',       href: '/dashboard/cases',      icon: BriefcaseBusiness },
  { label: 'Upload Evidence', href: '/dashboard/documents',  icon: Upload            },
];

const DEMO_RECENT: Array<{ label: string; sub: string; href: string; icon: LucideIcon }> = [
  { label: 'GRV-2024-014 · Ahmed Al-Rashid', sub: 'Wrongful Discipline · Updated 2 days ago',   href: '/dashboard/grievances', icon: Scale            },
  { label: 'CASE-2024-089 · Maria Santos',   sub: 'Leave Entitlement · Updated 4 days ago',     href: '/dashboard/cases',      icon: BriefcaseBusiness },
  { label: 'CUPE 4373 CBA 2023–2025.pdf',    sub: 'Collective Agreement · Uploaded 1 week ago', href: '/dashboard/documents',  icon: FileText          },
];

const DEMO_SPOTLIGHT = {
  title: 'Agreement Advisor',
  sub:   'Ask about any clause in the CUPE Local 4373 Collective Agreement — leave entitlements, discipline procedures, Article 17.3 and beyond.',
  cta:   'Ask a question',
  href:  '/dashboard/agreements',
};

// ─────────────────────────────────────────────────────────────────────────────

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
          className="mb-10"
        >
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/60">
            {greeting}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
            {displayName}
          </h1>
          <p className="mt-3 text-sm text-white/35">{email}</p>
        </motion.div>

        {/* Quick actions */}
        {isCupeDemo && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.4, ease: 'easeOut' }}
            className="mb-8 flex flex-wrap gap-2.5"
          >
            {DEMO_QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={withLocale(href)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-semibold text-white/65 transition-all hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
              >
                <Icon size={12} />
                {label}
              </Link>
            ))}
          </motion.div>
        )}

        {/* Operational pulse strip */}
        {isCupeDemo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.4, ease: 'easeOut' }}
            className="mb-8 flex flex-wrap gap-2"
          >
            {DEMO_PULSE.map(({ label, value, color, bg, border }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-full border ${border} ${bg} px-3.5 py-1.5 text-xs`}
              >
                <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
                <span className="text-white/40">{label}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Urgent callout */}
        {isCupeDemo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.46, duration: 0.4, ease: 'easeOut' }}
            className="mb-10"
          >
            <Link
              href={withLocale(DEMO_URGENT.href)}
              className="group flex items-center gap-3.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3.5 transition-all hover:border-amber-500/50 hover:bg-amber-500/[0.11]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                <AlarmClock size={14} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-300">{DEMO_URGENT.title}</p>
                <p className="mt-0.5 truncate text-xs text-white/40">{DEMO_URGENT.detail}</p>
              </div>
              <ChevronRight
                size={14}
                className="shrink-0 text-amber-500/35 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </motion.div>
        )}

        {/* Section label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.54, duration: 0.4 }}
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

        {/* Recent items */}
        {isCupeDemo && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.5, ease: 'easeOut' }}
            className="mt-14"
          >
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/20">
              Recently accessed
            </p>
            <div className="flex flex-col gap-2">
              {DEMO_RECENT.map(({ label, sub, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={withLocale(href)}
                  className="group flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 transition-all hover:border-white/[0.11] hover:bg-white/[0.05]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                    <Icon size={14} className="text-white/35" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-white/70 transition-colors group-hover:text-white/90">
                      {label}
                    </p>
                    <p className="truncate text-xs text-white/28">{sub}</p>
                  </div>
                  <ArrowUpRight
                    size={12}
                    className="shrink-0 text-white/10 transition-all group-hover:text-white/35"
                  />
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Spotlight card */}
        {isCupeDemo && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.08, duration: 0.5, ease: 'easeOut' }}
            className="mt-5"
          >
            <Link
              href={withLocale(DEMO_SPOTLIGHT.href)}
              className="group relative flex items-center gap-5 overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-600/10 via-violet-600/8 to-sky-600/10 px-6 py-5 transition-all hover:border-indigo-500/35 hover:shadow-xl hover:shadow-indigo-950/30"
            >
              {/* glow orb */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-indigo-500/[0.07] blur-2xl"
              />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/25 bg-indigo-600/20">
                <Sparkles size={18} className="text-indigo-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/85">{DEMO_SPOTLIGHT.title}</p>
                <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-white/32">
                  {DEMO_SPOTLIGHT.sub}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-500/22 bg-indigo-600/18 px-3.5 py-2 text-xs font-semibold text-indigo-300 transition-all group-hover:border-indigo-500/38 group-hover:bg-indigo-600/28">
                {DEMO_SPOTLIGHT.cta}
                <ArrowUpRight size={11} />
              </div>
            </Link>
          </motion.div>
        )}

        {/* Footer tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-20 text-center text-xs text-white/12"
        >
          UnionEyes · Governance-safe organizational intelligence for Canadian labour
        </motion.p>
      </main>
    </div>
  );
}
