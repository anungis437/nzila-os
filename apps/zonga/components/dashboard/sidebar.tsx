/**
 * Zonga — Role-aware Sidebar Navigation
 *
 * Spotify-style sidebar with navigation sections gated by ZongaRole.
 * Follows UE pattern: sections → items → roles array filtering.
 *
 * Navigation tiers:
 *   - Platform admin (Nzila org): platform ops, org browser, system config
 *   - When viewing a client org: label management, moderation, analytics
 *   - Creator role: catalog, releases, revenue, payouts
 *   - Listener/viewer role: browse, search, playlists, my music
 */
'use client'

import {
  Home,
  Search,
  Globe,
  Music,
  Disc3,
  ListMusic,
  CalendarDays,
  DollarSign,
  Zap,
  Mic2,
  BarChart3,
  Headphones,
  Bell,
  Shield,
  Lock,
  Gem,
  Settings,
  Users,
  Activity,
  FileBarChart,
  Building2,
  CreditCard,
  ChevronDown,
  Menu,
  X,
  Podcast,
  PlusCircle,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import type { ZongaRole } from '@nzila/zonga-core/types'
import { MobileAccountFooter } from './account-widgets'
import { WorkspaceIdentity } from '@/components/branding'
import { LanguageSwitcher } from '@/components/language-switcher'

// ── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
  roles: string[]
}

interface NavSection {
  title: string
  items: NavItem[]
}

interface SidebarProps {
  role: ZongaRole
  locale: string
  isPlatformOrg: boolean
  /** Whether the user has a creator profile (even without an org). */
  hasCreatorProfile: boolean
}

// ── Role groups ──────────────────────────────────────────────────────────────

const allRoles: ZongaRole[] = ['admin', 'manager', 'creator', 'viewer']
const adminOnly: ZongaRole[] = ['admin']
const adminManager: ZongaRole[] = ['admin', 'manager']
const creatorAndAbove: ZongaRole[] = ['admin', 'manager', 'creator']

// ── Collapsible section sub-component ────────────────────────────────────────

function NavSectionGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full mb-1 px-3 flex items-center justify-between group cursor-pointer"
      >
        <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider select-none group-hover:text-gray-300 transition-colors">
          {title}
        </h3>
        <ChevronDown
          size={12}
          className={`text-gray-500 group-hover:text-gray-300 transition-transform duration-200 ${
            open ? '' : '-rotate-90'
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Build sections ───────────────────────────────────────────────────────────

function buildPlatformSections(locale: string, t: (key: string) => string): NavSection[] {
  const p = `/${locale}/dashboard`
  return [
    {
      title: 'Platform',
      items: [
        { href: p, icon: <Home size={16} />, label: t('home'), roles: allRoles },
        { href: `${p}/operations`, icon: <Activity size={16} />, label: 'Operations', roles: ['admin'] },
        { href: `${p}/operations/playback-health`, icon: <Activity size={16} />, label: 'Playback Health', roles: ['admin'] },
        { href: `${p}/admin/organizations`, icon: <Building2 size={16} />, label: 'Organizations', roles: allRoles },
        { href: `${p}/analytics`, icon: <BarChart3 size={16} />, label: t('analytics'), roles: adminManager },
        { href: `${p}/moderation`, icon: <Shield size={16} />, label: t('moderation'), roles: adminManager },
        { href: `${p}/integrity`, icon: <Lock size={16} />, label: t('integrity'), roles: adminManager },
        { href: `${p}/creators`, icon: <Users size={16} />, label: t('creators'), roles: adminManager },
        { href: `${p}/revenue`, icon: <DollarSign size={16} />, label: t('revenue'), roles: ['admin'] },
        { href: `${p}/payouts`, icon: <Zap size={16} />, label: t('payouts'), roles: ['admin'] },
      ],
    },
    {
      title: 'System',
      items: [
        { href: `${p}/compliance`, icon: <FileBarChart size={16} />, label: 'Compliance', roles: ['admin'] },
        { href: `${p}/notifications`, icon: <Bell size={16} />, label: 'Notifications', roles: allRoles },
        { href: `${p}/settings`, icon: <Settings size={16} />, label: 'Settings', roles: allRoles },
      ],
    },
  ]
}

function buildLabelSections(locale: string, t: (key: string) => string): NavSection[] {
  const p = `/${locale}/dashboard`
  return [
    {
      title: 'Discover',
      items: [
        { href: p, icon: <Home size={16} />, label: t('home'), roles: allRoles },
        { href: `${p}/browse`, icon: <Globe size={16} />, label: t('browse'), roles: allRoles },
        { href: `${p}/search`, icon: <Search size={16} />, label: t('search'), roles: allRoles },
      ],
    },
    {
      title: 'Your Library',
      items: [
        { href: `${p}/playlists`, icon: <ListMusic size={16} />, label: t('playlists'), roles: allRoles },
        { href: `${p}/listener`, icon: <Headphones size={16} />, label: t('myMusic'), roles: allRoles },
        { href: `${p}/subscription`, icon: <Gem size={16} />, label: 'Subscription', roles: allRoles },
      ],
    },
    {
      title: 'Events',
      items: [
        { href: `${p}/events`, icon: <CalendarDays size={16} />, label: t('events'), roles: allRoles },
      ],
    },
    {
      title: 'Podcasts',
      items: [
        { href: `${p}/podcasts`, icon: <Podcast size={16} />, label: 'Podcasts', roles: allRoles },
      ],
    },
    {
      title: 'Business',
      items: [
        { href: `${p}/revenue`, icon: <DollarSign size={16} />, label: t('revenue'), roles: adminManager },
        { href: `${p}/payouts`, icon: <Zap size={16} />, label: t('payouts'), roles: adminOnly },
        { href: `${p}/analytics`, icon: <BarChart3 size={16} />, label: t('analytics'), roles: adminManager },
        { href: `${p}/analytics/label`, icon: <FileBarChart size={16} />, label: 'Label Dashboard', roles: adminManager },
        { href: `${p}/creators`, icon: <Users size={16} />, label: t('creators'), roles: adminManager },
        { href: `${p}/pilot`, icon: <Activity size={16} />, label: 'Pilot Dashboard', roles: adminManager },
        { href: `${p}/admin/billing`, icon: <CreditCard size={16} />, label: 'Billing', roles: adminManager },
      ],
    },
    {
      title: 'Creator Studio',
      items: [
        { href: `${p}/catalog`, icon: <Music size={16} />, label: t('catalog'), roles: creatorAndAbove },
        { href: `${p}/catalog/label-console`, icon: <FileBarChart size={16} />, label: 'Label Upload Console', roles: creatorAndAbove },
        { href: `${p}/releases`, icon: <Disc3 size={16} />, label: t('releases'), roles: creatorAndAbove },
        { href: `${p}/artists`, icon: <Mic2 size={16} />, label: t('creators'), roles: adminManager },
        { href: `${p}/tracks`, icon: <Music size={16} />, label: t('catalog'), roles: creatorAndAbove },
        { href: `${p}/rights`, icon: <Lock size={16} />, label: t('integrity'), roles: adminOnly },
        { href: `${p}/events/new`, icon: <PlusCircle size={16} />, label: t('events'), roles: creatorAndAbove },
        { href: `${p}/podcasts/new`, icon: <PlusCircle size={16} />, label: 'Podcast', roles: creatorAndAbove },
      ],
    },
    {
      title: 'Admin',
      items: [
        { href: `${p}/notifications`, icon: <Bell size={16} />, label: t('notifications'), roles: allRoles },
        { href: `${p}/settings`, icon: <Settings size={16} />, label: 'Settings', roles: allRoles },
      ],
    },
  ]
}

// ── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar({ role, locale, isPlatformOrg, hasCreatorProfile }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const t = useTranslations('nav')

  const isActive = (href: string) => {
    // Exact match for dashboard home, startsWith for sub-pages
    if (href.endsWith('/dashboard')) return pathname === href
    return pathname?.startsWith(href) ?? false
  }

  // Build sections based on org type
  const rawSections = isPlatformOrg
    ? buildPlatformSections(locale, t)
    : buildLabelSections(locale, t)

  // Filter items by role
  const sections = rawSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0)

  const navContent = (
    <>
      {sections.map((section) => (
        <NavSectionGroup key={section.title} title={section.title}>
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-electric/20 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className={isActive(item.href) ? 'text-electric' : ''}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </NavSectionGroup>
      ))}

      {/* CTA for listeners who haven't applied as creators yet */}
      {role === 'viewer' && !hasCreatorProfile && (
        <div className="px-3 pt-4">
          <Link
            href={`/${locale}/dashboard/creators/apply`}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-xl border border-electric/30 bg-electric/5 px-3 py-3 text-sm font-semibold text-white hover:bg-electric/10 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric/20">
              <Mic2 size={16} className="text-electric" />
            </div>
            <div>
              <p className="text-sm font-semibold">Become a Creator</p>
              <p className="text-[10px] text-gray-400">Distribute your music on Zonga</p>
            </div>
          </Link>
        </div>
      )}

      {/* CTA for creators without an org — nudge them to join/create a label */}
      {role === 'viewer' && hasCreatorProfile && (
        <div className="px-3 pt-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={14} className="text-amber-500" />
              <p className="text-xs font-semibold text-white">Join a Label</p>
            </div>
            <p className="text-[10px] text-gray-400">
              Create or join an organization to unlock Creator Studio, uploads, and payouts.
            </p>
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* ── Mobile hamburger trigger ── */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 rounded-lg bg-navy flex items-center justify-center shadow-lg"
        aria-label="Open navigation"
      >
        <Menu size={20} className="text-white" />
      </button>

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 bg-navy text-white flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <WorkspaceIdentity placement="app_sidebar" size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X size={20} className="text-gray-400 hover:text-white" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto sidebar-scrollbar">
                {navContent}
              </nav>
              <div className="px-4 py-3 border-t border-white/10">
                <LanguageSwitcher currentLocale={locale} variant="dark" dropDirection="up" />
              </div>
              <div className="px-4 py-4 border-t border-white/10">
                <MobileAccountFooter locale={locale} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop nav (rendered inside layout's <aside>) ── */}
      <nav className="hidden md:block flex-1 px-3 py-4 space-y-3 overflow-y-auto sidebar-scrollbar">
        {navContent}
      </nav>
    </>
  )
}
