"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { liveConnectors, notificationCenterItems, ownerHandoffs, shellNotifications } from '@/lib/shopmoica-pilot-data'
import { actorOptions, actorBadge, canAccessModule, getVisibleModules, ownerDefaultCockpit, type OwnerPersona } from '@/lib/access-control'
import { getCommerceModulesByLane } from '@/lib/shopmoica-commerce'
import { useAccessContext } from './AccessProvider'
import styles from '../experience.module.css'

type AppShellProps = {
  locale: string
  children: ReactNode
}

const labels = {
  'en-CA': {
    workspace: 'Shop Moi Ça workspace',
    ownerMode: 'Owner mode',
    notifications: 'Notifications',
    personaModes: 'Persona lens',
    quickActions: 'Quick actions',
    mobileOwner: 'Owner',
  },
  'fr-CA': {
    workspace: 'Espace Shop Moi Ça',
    ownerMode: 'Mode direction',
    notifications: 'Notifications',
    personaModes: 'Perspective persona',
    quickActions: 'Actions rapides',
    mobileOwner: 'Direction',
  },
} as const

export default function AppShell({ locale, children }: AppShellProps) {
  const pathname = usePathname()
  const isMarketingRoute = pathname.includes(`/${locale}/marketing`)
  const { actor, actorKey, withActor, personaMode, setPersonaMode } = useAccessContext()
  const copy = labels[locale === 'fr-CA' ? 'fr-CA' : 'en-CA']
  const visibleInternal = getVisibleModules(actor, getCommerceModulesByLane('internal'))
  const visibleClient = getVisibleModules(actor, getCommerceModulesByLane('client'))
  const handoffCount = ownerHandoffs.filter((handoff) => handoff.to === actor.displayName || actor.role === 'owner').length
  const degradedConnectors = liveConnectors.filter((connector) => connector.status !== 'healthy').length
  const quickActionLinks = [
    { label: 'Cash', path: '/internal/finance-surface', gate: () => canAccessModule(actor, 'internal', 'finance-surface') },
    { label: 'Ads', path: '/internal/google-ads-command-center', gate: () => canAccessModule(actor, 'internal', 'google-ads-command-center') },
    { label: 'Production', path: '/internal/production-tracker', gate: () => canAccessModule(actor, 'internal', 'production-tracker') },
    { label: 'Shipping', path: '/internal/shipping-center', gate: () => canAccessModule(actor, 'internal', 'shipping-center') },
    { label: 'Builder', path: '/client/guided-gift-builder', gate: () => canAccessModule(actor, 'client', 'guided-gift-builder') },
    { label: 'Client Tracking', path: '/client/order-tracking-experience', gate: () => canAccessModule(actor, 'client', 'order-tracking-experience') },
    { label: 'Demo', path: '/demo/shopmoica', gate: () => true },
  ].filter((item) => item.gate())

  const ownerCockpit = actor.role === 'owner' && actor.ownerPersona
    ? ownerDefaultCockpit[actor.ownerPersona as OwnerPersona]
    : null

  if (isMarketingRoute) {
    return <div className={styles.appContent}>{children}</div>
  }

  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <span className={styles.sidebarEyebrow}>{copy.workspace}</span>
          <strong className={styles.sidebarTitle}>Maestria Commerce</strong>
          <p className={styles.sidebarText}>Premium operating system for the Shop Moi Ça flagship edition.</p>
        </div>

        <nav className={styles.sidebarNav}>
          <Link href={withActor(`/${locale}`)} className={styles.sidebarLink}>Overview</Link>
          {ownerCockpit ? <Link href={withActor(`/${locale}${ownerCockpit}`)} className={styles.sidebarLink}>Owner cockpit</Link> : null}
          {visibleInternal.map((module) => (
            <Link key={module.slug} href={withActor(`/${locale}${module.path}`)} className={styles.sidebarLink}>{module.title}</Link>
          ))}
          {visibleClient.map((module) => (
            <Link key={module.slug} href={withActor(`/${locale}${module.path}`)} className={styles.sidebarLink}>{module.title}</Link>
          ))}
          <Link href={withActor(`/${locale}/demo/shopmoica`)} className={styles.sidebarLink}>Demo Mode</Link>
        </nav>

        <div className={styles.ownerModeCard}>
          <span className={styles.cardKicker}>{copy.ownerMode}</span>
          <strong>{actor.displayName}</strong>
          <p className={styles.cardText}>{actorBadge(actor)}</p>
          <div className={styles.modeToggleRow}>
            <button
              type="button"
              className={personaMode === 'mission-control' ? styles.primaryFilter : styles.secondaryFilter}
              onClick={() => setPersonaMode('mission-control')}
            >
              Mission control
            </button>
            <button
              type="button"
              className={personaMode === 'concierge' ? styles.primaryFilter : styles.secondaryFilter}
              onClick={() => setPersonaMode('concierge')}
            >
              Concierge
            </button>
          </div>
          <div className={styles.pillRow}>
            {actorOptions.map((option) => (
              <Link
                key={option.key}
                href={`/${locale}?as=${option.key}`}
                className={option.key === actorKey ? styles.primaryFilter : styles.secondaryFilter}
              >
                {option.label}
              </Link>
            ))}
          </div>
          <div className={styles.metaList}>
            <span>Saved lens: {copy.personaModes} / {personaMode}</span>
            <span>{handoffCount} owner handoff(s) waiting</span>
            <span>{degradedConnectors} connector alert(s)</span>
          </div>
        </div>
      </aside>

      <div className={styles.appMain}>
        <header className={styles.topNav}>
          <div>
            <span className={styles.cardKicker}>{copy.quickActions}</span>
            <div className={styles.navRow}>
              {quickActionLinks.map((action) => (
                <Link key={action.path} href={withActor(`/${locale}${action.path}`)} className={styles.navLink}>{action.label}</Link>
              ))}
            </div>
          </div>

          <div className={styles.topNavMeta}>
            <div className={styles.notificationTray}>
              <div className={styles.notificationHeader}>
                <span className={styles.cardKicker}>{copy.notifications}</span>
                <span className={styles.badgeCounter}>{notificationCenterItems.length}</span>
              </div>
              {(personaMode === 'mission-control' ? notificationCenterItems.slice(0, 3) : notificationCenterItems.slice(0, 2)).map((notification) => (
                <div key={notification.id} className={styles.notificationItem}>
                  <strong>{notification.title} {notification.mention ? `@${notification.mention}` : ''}</strong>
                  <span>{notification.note}</span>
                  <span className={styles.notificationMeta}>{notification.owner} · {notification.channel} · {notification.priority}</span>
                </div>
              ))}
              <div className={styles.notificationFooter}>
                <span>{shellNotifications.length} shell alerts live</span>
                <span>{handoffCount} handoff(s)</span>
              </div>
            </div>
            <div className={styles.operatorPill}>
              <span>{actor.displayName.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{actor.displayName}</strong>
                <p>{actorBadge(actor)}</p>
              </div>
            </div>
          </div>
        </header>

        <div className={styles.appContent}>{children}</div>
      </div>

      <nav className={styles.mobileOwnerNav}>
        <Link href={withActor(`/${locale}`)} className={styles.mobileOwnerLink}>Overview</Link>
        <Link href={withActor(`/${locale}/internal`)} className={styles.mobileOwnerLink}>Ops</Link>
        <Link href={withActor(`/${locale}/client`)} className={styles.mobileOwnerLink}>Clients</Link>
        <Link href={withActor(`/${locale}/demo/shopmoica`)} className={styles.mobileOwnerLink}>Demo</Link>
        <Link href={withActor(`/${locale}${ownerCockpit ?? '/internal/executive-dashboard'}`)} className={styles.mobileOwnerLink}>{copy.mobileOwner}</Link>
      </nav>
    </div>
  )
}
