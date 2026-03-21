/**
 * Dashboard Layout — Authenticated shell for Zonga.
 * Sidebar + header + content with music-platform navigation.
 */
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

const sidebarLinks = [
  { href: 'dashboard', label: 'Overview', icon: '📊' },
  { href: 'dashboard/browse', label: 'Browse', icon: '🌍' },
  { href: 'dashboard/search', label: 'Search', icon: '🔍' },
  { href: 'dashboard/catalog', label: 'Catalog', icon: '🎵' },
  { href: 'dashboard/releases', label: 'Releases', icon: '📀' },
  { href: 'dashboard/playlists', label: 'Playlists', icon: '📋' },
  { href: 'dashboard/events', label: 'Events', icon: '🎪' },
  { href: 'dashboard/revenue', label: 'Revenue', icon: '💰' },
  { href: 'dashboard/payouts', label: 'Payouts', icon: '⚡' },
  { href: 'dashboard/creators', label: 'Creators', icon: '🎤' },
  { href: 'dashboard/analytics', label: 'Analytics', icon: '📈' },
  { href: 'dashboard/listener', label: 'My Music', icon: '🎧' },
  { href: 'dashboard/notifications', label: 'Notifications', icon: '🔔' },
  { href: 'dashboard/moderation', label: 'Moderation', icon: '🛡️' },
  { href: 'dashboard/integrity', label: 'Integrity', icon: '🔒' },
  { href: 'dashboard/subscription', label: 'Subscription', icon: '💎' },
];

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

  return (
    <DashboardShell>
    <div className="flex min-h-screen bg-gray-50">
      {/* ─── Sidebar ─── */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-navy text-white">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
            <div className="w-8 h-8 rounded-lg bg-electric flex items-center justify-center shadow-md shadow-electric/25">
              <span className="text-white font-bold text-xs">Z</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Zonga</span>
          </div>

          <div className="px-4 py-4 border-b border-white/10">
            <OrganizationSwitcher
              hidePersonal
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  organizationSwitcherTrigger: 'w-full bg-white/5 hover:bg-white/10 rounded-lg py-2 px-3 text-white text-sm transition-colors',
                },
              }}
            />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-scrollbar">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={`/${locale}/${link.href}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span className="text-base">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="px-4 py-4 border-t border-white/10">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: { avatarBox: 'w-8 h-8' },
              }}
            />
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="md:hidden w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <span className="text-xs text-gray-500">☰</span>
            </div>
            <h2 className="text-lg font-semibold text-navy">Dashboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 pb-24">{children}</main>
      </div>
    </div>
    </DashboardShell>
  );
}
