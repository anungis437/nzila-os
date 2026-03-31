/**
 * Dashboard Layout — Authenticated shell for Zonga.
 * Role-aware sidebar + header + content with music-platform navigation.
 */
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { SidebarOrgSwitcher, SidebarAccountFooter, MobileAccountFooter } from '@/components/dashboard/clerk-widgets';
import { Sidebar } from '@/components/dashboard/sidebar';
import { resolveNavContext } from '@/lib/resolve-nav';

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

  const user = await currentUser();
  const isListener = (user?.publicMetadata as { zongaRole?: string } | undefined)?.zongaRole === 'listener';

  return (
    <DashboardShell>
    <div className="flex min-h-screen bg-background">
      {/* ─── Sidebar ─── */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-navy text-white h-screen sticky top-0">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
            <div className="w-8 h-8 rounded-lg bg-electric flex items-center justify-center shadow-md shadow-electric/25">
              <span className="text-white font-bold text-xs">Z</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Zonga</span>
          </div>

          <div className="px-4 py-4 border-b border-white/10">
            {hasCreatorProfile ? (
              <SidebarOrgSwitcher />
            ) : (
              <p className="text-xs text-gray-500 text-center py-1">Personal account</p>
            )}
          </div>

          <Sidebar role={role} locale={locale} isPlatformOrg={isPlatformOrg} hasCreatorProfile={hasCreatorProfile} />

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
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isListener && (
              <h2 className="text-lg font-semibold text-foreground pl-12 md:pl-0">Dashboard</h2>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <MobileAccountFooter locale={locale} />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 pb-24">{children}</main>
      </div>
    </div>
    </DashboardShell>
  );
}
