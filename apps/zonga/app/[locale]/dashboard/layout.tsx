/**
 * Dashboard Layout — Authenticated shell for Zonga.
 * Role-aware sidebar + header + content with music-platform navigation.
 */
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { SidebarAccountFooter } from '@/components/dashboard/account-widgets';
import { ExternalBrandMark } from '@/components/branding';
import { Sidebar } from '@/components/dashboard/sidebar';
import { resolveNavContext } from '@/lib/resolve-nav';
import { WorkspaceIdentity } from '@/components/branding';
import { CLIENT_BRAND } from '@/lib/branding/brand-config';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * Sidebar navigation configuration — canonical route registry.
 * Sidebar component reads role-based sections from this definition.
 */
export const SIDEBAR_NAV = [
  { href: 'dashboard', label: 'Home' },
  { href: 'dashboard/browse', label: 'Browse' },
  { href: 'dashboard/search', label: 'Search' },
  { href: 'dashboard/catalog', label: 'Catalog' },
  { href: 'dashboard/releases', label: 'Releases' },
  { href: 'dashboard/playlists', label: 'Playlists' },
  { href: 'dashboard/events', label: 'Events' },
  { href: 'dashboard/revenue', label: 'Revenue' },
  { href: 'dashboard/payouts', label: 'Payouts' },
  { href: 'dashboard/creators', label: 'Creators' },
  { href: 'dashboard/analytics', label: 'Analytics' },
  { href: 'dashboard/notifications', label: 'Notifications' },
  { href: 'dashboard/integrity', label: 'Integrity' },
  { href: 'dashboard/listener', label: 'My Music' },
  { href: 'dashboard/moderation', label: 'Moderation' },
] as const;

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { userId } = await auth();
  const { locale } = await params;

  if (!userId) {
    redirect('/sign-in');
  }

  const navCtx = await resolveNavContext(locale);
  const role = navCtx?.role ?? 'viewer';
  const isPlatformOrg = navCtx?.isPlatformOrg ?? false;
  const hasCreatorProfile = navCtx?.hasCreatorProfile ?? false;

  return (
    <DashboardShell>
    <div className="flex min-h-screen bg-background">
      {/* ─── Sidebar ─── */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-navy text-white h-screen sticky top-0">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
            <WorkspaceIdentity placement="app_sidebar" size="sm" />
          </div>

          {hasCreatorProfile && (
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <ExternalBrandMark asset={CLIENT_BRAND} placement="app_sidebar" maxHeight={24} />
              <span className="text-xs font-medium text-white/60 truncate">Workspace</span>
            </div>
          )}

          <Sidebar role={role} locale={locale} isPlatformOrg={isPlatformOrg} hasCreatorProfile={hasCreatorProfile} />

          <div className="px-4 py-3 border-t border-white/10">
            <LanguageSwitcher currentLocale={locale} variant="dark" dropDirection="up" />
          </div>
          <div className="px-4 py-4 border-t border-white/10">
            <SidebarAccountFooter locale={locale} />
          </div>
        </div>
      </aside>

      {/* ─── Mobile sidebar (rendered by Sidebar component) ─── */}
      <div className="md:hidden">
        <Sidebar role={role} locale={locale} isPlatformOrg={isPlatformOrg} hasCreatorProfile={hasCreatorProfile} />
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 pb-24">{children}</main>
      </div>
    </div>
    </DashboardShell>
  );
}
